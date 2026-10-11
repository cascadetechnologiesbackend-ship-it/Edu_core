import fs from "fs";
import path from "path";
import ts from "typescript";

const actionFiles = [];

function findActionFiles(dir) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      findActionFiles(fullPath);
    } else if (entry.isFile() && (entry.name.endsWith("actions.ts") || entry.name.endsWith(".actions.ts"))) {
      actionFiles.push(fullPath);
    }
  }
}

const targetDir = path.resolve("frontend/src/app");
findActionFiles(targetDir);

console.log(`Auditing ${actionFiles.length} server action files...`);

const findings = [];

// Whitelist tables that are known to not have schoolId column (e.g. users, sessions, or global platform tables)
const globalTables = new Set(["platformAdmins", "schools", "sessions"]);

for (const file of actionFiles) {
  const code = fs.readFileSync(file, "utf8");
  const sourceFile = ts.createSourceFile(file, code, ts.ScriptTarget.Latest, true);

  function checkNode(node) {
    if (ts.isCallExpression(node)) {
      const text = node.expression.getText(sourceFile);
      const cleanExpr = text.replace(/\s+/g, "");
      // Check specifically for db.update, tx.update, db.delete, tx.delete calls
      const isDbWrite = 
        cleanExpr === "db.update" || cleanExpr === "tx.update" ||
        cleanExpr === "db.delete" || cleanExpr === "tx.delete" ||
        cleanExpr.endsWith(".db.update") || cleanExpr.endsWith(".tx.update") ||
        cleanExpr.endsWith(".db.delete") || cleanExpr.endsWith(".tx.delete");

      if (isDbWrite) {
        // Find the parent call chain to see if .where(...) is chained
        let current = node.parent;
        let whereCall = null;
        let depth = 0;
        while (current && depth < 6) {
          if (ts.isCallExpression(current)) {
            const exprText = current.expression.getText(sourceFile);
            if (exprText.endsWith(".where")) {
              whereCall = current;
              break;
            }
          }
          current = current.parent;
          depth++;
        }

        const lineAndChar = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
        const line = lineAndChar.line + 1;
        const argText = node.arguments[0] ? node.arguments[0].getText(sourceFile) : "unknown";

        if (globalTables.has(argText)) {
          // Skip global tables
        } else if (!whereCall) {
          findings.push({
            file: path.relative(process.cwd(), file),
            line,
            type: text.endsWith(".update") ? "UPDATE" : "DELETE",
            table: argText,
            issue: "NO_WHERE_CLAUSE",
            snippet: node.parent ? node.parent.getText(sourceFile).slice(0, 100) : "",
          });
        } else {
          const whereText = whereCall.getText(sourceFile);
          if (!whereText.includes("schoolId") && !whereText.includes("school.id") && !whereText.includes("ctx.schoolId")) {
            findings.push({
              file: path.relative(process.cwd(), file),
              line,
              type: text.endsWith(".update") ? "UPDATE" : "DELETE",
              table: argText,
              issue: "UNSCOPED_WHERE_MISSING_SCHOOL_ID",
              whereSnippet: whereText.slice(0, 150),
            });
          }
        }
      }
    }
    ts.forEachChild(node, checkNode);
  }

  checkNode(sourceFile);
}

console.log(`\n--- Scan Completed: ${findings.length} findings found ---`);
console.log(JSON.stringify(findings, null, 2));

fs.writeFileSync(
  "scripts/unscoped-writes-report.json",
  JSON.stringify(findings, null, 2),
  "utf8"
);
