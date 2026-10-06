/**
 * ESLint Rule: no-unguarded-server-action
 * Detects files where all four conditions are met (per GAP-003 spec):
 * 1. "use server" directive is present
 * 2. Database import is present (@/db or @schoolmitra/database)
 * 3. No requireAuth / requireSession / auth import from serverAuth
 * 4. No file-level // PUBLIC: <reason> comment
 *
 * Reports at line 1, column 0 with an actionable message.
 */
const noUnguardedServerAction = {
  meta: {
    type: "problem",
    docs: {
      description: "Enforce requireAuth in Server Action files accessing the database",
      category: "Security",
      recommended: true,
    },
    schema: [],
    messages: {
      missingAuthGuard:
        "Server Action file accessing the database must import and call requireAuth() from serverAuth, or be explicitly annotated with '// PUBLIC: <reason>'.",
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode ? context.getSourceCode() : context.sourceCode;
    const text = sourceCode.getText();

    // Condition 1: "use server" directive present
    const hasUseServer = /^["']use server["'];?/m.test(text);
    if (!hasUseServer) return {};

    // Condition 4: No // PUBLIC: comment
    if (text.includes("// PUBLIC:")) return {};

    // Condition 2: Database import present
    const hasDbImport =
      /from\s+["']@\/db(?:["'\/]|$)/.test(text) ||
      /from\s+["']@schoolmitra\/database(?:["'\/]|$)/.test(text) ||
      /import\s+.*(?:db|provisionTenant).*\s+from/.test(text);

    if (!hasDbImport) return {};

    // Condition 3: No requireAuth/requireSession/auth import from serverAuth / auth / checkAuth
    const hasAuthGuard =
      /requireAuth/.test(text) ||
      /requireSession/.test(text) ||
      /checkAuth/.test(text) ||
      /from\s+["'].*serverAuth["']/.test(text) ||
      /from\s+["'].*auth-helper["']/.test(text);

    if (!hasAuthGuard) {
      return {
        Program(node) {
          context.report({
            node,
            loc: { line: 1, column: 0 },
            messageId: "missingAuthGuard",
          });
        },
      };
    }

    return {};
  },
};

module.exports = {
  rules: {
    "no-unguarded-server-action": noUnguardedServerAction,
    "require-server-auth": noUnguardedServerAction,
  },
};
