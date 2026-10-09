import { AsyncLocalStorage } from "node:async_hooks";
import type { Logger } from "drizzle-orm/logger";

/**
 * Normalizes SQL queries by replacing dynamic parameter literals, IDs,
 * numeric values, and excess whitespace to recognize query structural shapes.
 */
export function normalizeSql(sql: string): string {
  return sql
    // Replace UUID strings with ?
    .replace(/'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}'/gi, "?")
    // Replace quoted string literals with ?
    .replace(/'(?:[^'\\]|\\.)*'/g, "?")
    // Replace positional parameter placeholders $1, $2, etc with ?
    .replace(/\$\d+/g, "?")
    // Replace integer and float literals
    .replace(/\b\d+(\.\d+)?\b/g, "?")
    // Collapse all whitespace sequences into a single space
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export interface RecordedQuery {
  sql: string;
  params: unknown[];
  normalized: string;
  timestamp: number;
}

export interface QueryBudgetScope {
  id: string;
  label?: string | undefined;
  maxQueries: number;
  disallowNPlusOne: boolean;
  nPlusOneThreshold: number;
  queries: RecordedQuery[];
  violations: string[];
}

export class QueryBudgetExceededError extends Error {
  constructor(
    public readonly count: number,
    public readonly limit: number,
    public readonly label?: string,
    public readonly queries: RecordedQuery[] = []
  ) {
    super(
      `[QUERY_BUDGET_EXCEEDED] ${label ? `"${label}": ` : ""}Executed ${count} queries, exceeding the budget limit of ${limit}.`
    );
    this.name = "QueryBudgetExceededError";
  }
}

export class NPlusOneQueryError extends Error {
  constructor(
    public readonly normalizedQuery: string,
    public readonly occurrences: number,
    public readonly label?: string
  ) {
    super(
      `[N_PLUS_ONE_QUERY_DETECTED] ${label ? `"${label}": ` : ""}Query repeated ${occurrences} times in single scope: "${normalizedQuery}". Potential N+1 pattern detected.`
    );
    this.name = "NPlusOneQueryError";
  }
}

export const queryBudgetStorage = new AsyncLocalStorage<QueryBudgetScope>();

/**
 * Custom Drizzle Logger that intercepts queries to track budget limits (PF 1.2 <= 10 queries)
 * and detects N+1 loops (PF-R11) when executing within a QueryBudgetScope.
 */
export class BudgetQueryLogger implements Logger {
  logQuery(query: string, params: unknown[]): void {
    const store = queryBudgetStorage.getStore();
    const normalized = normalizeSql(query);

    if (store) {
      const record: RecordedQuery = {
        sql: query,
        params,
        normalized,
        timestamp: Date.now(),
      };
      store.queries.push(record);

      // Detect potential N+1 pattern
      const occurrences = store.queries.filter((q) => q.normalized === normalized).length;
      if (store.disallowNPlusOne && occurrences >= store.nPlusOneThreshold) {
        const violation = `N+1 detected (${occurrences}x): ${normalized}`;
        if (!store.violations.includes(violation)) {
          store.violations.push(violation);
        }
      }

      // Check query count budget
      if (store.queries.length > store.maxQueries) {
        const violation = `Query count budget exceeded (${store.queries.length}/${store.maxQueries})`;
        if (!store.violations.includes(violation)) {
          store.violations.push(violation);
        }
      }
    }

    if (process.env.DEBUG_DB === "true") {
      const prefix = store
        ? `[DB #${store.queries.length}/${store.maxQueries}${store.label ? ` ${store.label}` : ""}]`
        : "[DB]";
      console.log(`${prefix} ${query}`, params);
    }
  }
}

export interface QueryBudgetOptions {
  /** Maximum allowed queries in this scope (default: 10 per PF 1.2) */
  maxQueries?: number | undefined;
  /** Label for logging and error reporting */
  label?: string | undefined;
  /** Whether to flag N+1 query patterns (default: true) */
  disallowNPlusOne?: boolean | undefined;
  /** Number of occurrences of identical normalized queries before flagging N+1 (default: 3) */
  nPlusOneThreshold?: number | undefined;
}

/**
 * Executes an async operation inside a query budget scope and returns execution metrics.
 */
export async function withQueryBudget<T>(
  fn: () => Promise<T>,
  options: QueryBudgetOptions = {}
): Promise<{
  result: T;
  queryCount: number;
  queries: RecordedQuery[];
  violations: string[];
}> {
  const scope: QueryBudgetScope = {
    id: Math.random().toString(36).substring(7),
    label: options.label,
    maxQueries: options.maxQueries ?? 10,
    disallowNPlusOne: options.disallowNPlusOne ?? true,
    nPlusOneThreshold: options.nPlusOneThreshold ?? 3,
    queries: [],
    violations: [],
  };

  const result = await queryBudgetStorage.run(scope, fn);
  return {
    result,
    queryCount: scope.queries.length,
    queries: scope.queries,
    violations: scope.violations,
  };
}

/**
 * Asserts that an async operation executes within the normative query budget (<= 10 queries, PF 1.2)
 * and without N+1 query patterns (PF-R11). Throws if violated.
 */
export async function assertQueryBudget<T>(
  fn: () => Promise<T>,
  options: QueryBudgetOptions = {}
): Promise<T> {
  const { result, queryCount, queries } = await withQueryBudget(fn, options);
  const limit = options.maxQueries ?? 10;

  if (queryCount > limit) {
    throw new QueryBudgetExceededError(queryCount, limit, options.label, queries);
  }

  if (options.disallowNPlusOne !== false) {
    const counts = new Map<string, number>();
    for (const q of queries) {
      counts.set(q.normalized, (counts.get(q.normalized) || 0) + 1);
    }
    const threshold = options.nPlusOneThreshold ?? 3;
    for (const [normSql, count] of counts.entries()) {
      if (count >= threshold) {
        throw new NPlusOneQueryError(normSql, count, options.label);
      }
    }
  }

  return result;
}
