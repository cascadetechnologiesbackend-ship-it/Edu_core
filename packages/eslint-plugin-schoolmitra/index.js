/**
 * ESLint Rule: require-server-auth
 * Enforces that any file starting with 'use server' must call requireAuth()
 * or requireSession() in its exported async functions, unless marked with // PUBLIC:
 */
const requireServerAuth = {
  meta: {
    type: "problem",
    docs: {
      description: "Ensure Server Actions in 'use server' files call requireAuth or requireSession",
      category: "Security",
      recommended: true,
    },
    schema: [],
    messages: {
      missingAuthCheck:
        "Server Action '{{ name }}' in 'use server' file must call requireAuth() or requireSession() before DB operations, or be explicitly annotated with '// PUBLIC: <reason>'.",
    },
  },
  create(context) {
    const sourceCode = context.getSourceCode ? context.getSourceCode() : context.sourceCode;
    const text = sourceCode.getText();

    // Check if the file has 'use server'
    const hasUseServer = /^["']use server["'];?/m.test(text);
    if (!hasUseServer) {
      return {};
    }

    // Check if entire file has a file-level public bypass comment
    if (text.includes("// PUBLIC:")) {
      return {};
    }

    return {
      ExportNamedDeclaration(node) {
        if (!node.declaration) return;

        let fnNode = null;
        let fnName = "anonymous";

        if (node.declaration.type === "FunctionDeclaration") {
          fnNode = node.declaration;
          fnName = fnNode.id ? fnNode.id.name : "anonymous";
        } else if (
          node.declaration.type === "VariableDeclaration" &&
          node.declaration.declarations.length > 0
        ) {
          const decl = node.declaration.declarations[0];
          if (
            decl.init &&
            (decl.init.type === "ArrowFunctionExpression" ||
              decl.init.type === "FunctionExpression")
          ) {
            fnNode = decl.init;
            fnName = decl.id.name;
          }
        }

        if (!fnNode || !fnNode.body) return;

        // Check if there is a function-level comment containing // PUBLIC:
        const comments = sourceCode.getCommentsBefore(node);
        const hasPublicComment = comments.some((c) => c.value.includes("PUBLIC:"));
        if (hasPublicComment) return;

        // Check body for requireAuth or requireSession or auth() check
        const bodyText = sourceCode.getText(fnNode.body);
        const hasAuthCall =
          /requireAuth\s*\(/.test(bodyText) ||
          /requireSession\s*\(/.test(bodyText) ||
          /(?:await\s+)?auth\s*\(/.test(bodyText);

        if (!hasAuthCall) {
          context.report({
            node,
            messageId: "missingAuthCheck",
            data: { name: fnName },
          });
        }
      },
    };
  },
};

module.exports = {
  rules: {
    "require-server-auth": requireServerAuth,
  },
};
