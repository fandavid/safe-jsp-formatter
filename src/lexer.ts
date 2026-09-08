export interface JspTagToken {
  type: "directive" | "comment" | "expression" | "declaration" | "scriptlet";
  fullMatch: string;
  startIndex: number;
  endIndex: number;
  innerContent: string;
  isSingleLine: boolean;
}

export interface ElToken {
  fullMatch: string;
  startIndex: number;
  endIndex: number;
}

export interface LexerResult {
  jspTags: JspTagToken[];
  elExpressions: ElToken[];
}

export function scanJspAndEl(text: string): LexerResult {
  const jspTags: JspTagToken[] = [];
  const elExpressions: ElToken[] = [];
  const len = text.length;
  let i = 0;

  while (i < len) {
    // 1. Check for JSP Tag: <%
    if (text[i] === "<" && i + 1 < len && text[i + 1] === "%") {
      const startIndex = i;
      i += 2; // skip <%

      // Determine Tag Type
      let type: JspTagToken["type"] = "scriptlet";
      if (i < len) {
        if (text[i] === "@") {
          type = "directive";
        } else if (text[i] === "=") {
          type = "expression";
        } else if (text[i] === "!") {
          type = "declaration";
        } else if (text[i] === "-" && i + 1 < len && text[i + 1] === "-") {
          type = "comment";
          i += 2; // skip --
        }
      }

      let inString: null | '"' | "'" = null;
      let inLineComment = false;
      let inBlockComment = false;
      let tagClosed = false;

      while (i < len) {
        if (type === "comment") {
          // JSP comment closes with --%>
          if (text[i] === "-" && text.startsWith("--%>", i)) {
            i += 4;
            tagClosed = true;
            break;
          }
          i++;
          continue;
        }

        const char = text[i];
        const nextChar = i + 1 < len ? text[i + 1] : "";

        // Handle escape characters inside strings
        if (inString && char === "\\") {
          i += 2;
          continue;
        }

        // Handle string literals
        if (!inLineComment && !inBlockComment) {
          if (!inString && (char === '"' || char === "'")) {
            inString = char;
            i++;
            continue;
          } else if (inString && char === inString) {
            inString = null;
            i++;
            continue;
          }
        }

        // Handle comments inside JSP scriptlet/declaration
        if (!inString) {
          if (!inLineComment && !inBlockComment) {
            if (char === "/" && nextChar === "/") {
              inLineComment = true;
              i += 2;
              continue;
            } else if (char === "/" && nextChar === "*") {
              inBlockComment = true;
              i += 2;
              continue;
            }
          } else if (inLineComment && (char === "\n" || char === "\r")) {
            inLineComment = false;
            i++;
            continue;
          } else if (inBlockComment && char === "*" && nextChar === "/") {
            inBlockComment = false;
            i += 2;
            continue;
          }
        }

        // Check for closing tag %> (only when not inside string)
        if (!inString && char === "%" && nextChar === ">") {
          i += 2;
          tagClosed = true;
          break;
        }

        i++;
      }

      if (tagClosed) {
        const fullMatch = text.substring(startIndex, i);
        let headerLen = 2;
        let footerLen = 2;
        if (type === "declaration" || type === "directive" || type === "expression") {
          headerLen = 3;
        } else if (type === "comment") {
          headerLen = 4;
          footerLen = 4;
        }
        const innerContent = fullMatch.substring(headerLen, fullMatch.length - footerLen);
        const isSingleLine = !fullMatch.includes("\n");

        jspTags.push({
          type,
          fullMatch,
          startIndex,
          endIndex: i,
          innerContent,
          isSingleLine,
        });
      }
      continue;
    }

    // 2. Check for EL Expression: ${
    if (text[i] === "$" && i + 1 < len && text[i + 1] === "{") {
      const startIndex = i;
      i += 2; // skip ${
      let inString: null | '"' | "'" = null;
      let depth = 1;
      let closed = false;

      while (i < len) {
        const char = text[i];
        if (char === "\\") {
          i += 2;
          continue;
        }

        if (!inString && (char === '"' || char === "'")) {
          inString = char;
        } else if (inString && char === inString) {
          inString = null;
        } else if (!inString) {
          if (char === "{") {
            depth++;
          } else if (char === "}") {
            depth--;
            if (depth === 0) {
              i++;
              closed = true;
              break;
            }
          }
        }
        i++;
      }

      if (closed) {
        elExpressions.push({
          fullMatch: text.substring(startIndex, i),
          startIndex,
          endIndex: i,
        });
      }
      continue;
    }

    i++;
  }

  return { jspTags, elExpressions };
}

export function protectAndSplitComments(javaCode: string): string {
  const scannerRegex =
    /("(?:\\.|[^"\\])*")|('(?:\\.|[^'\\])*')|(\/\*[\s\S]*?\*\/)|(\/\/([^\r\n]*))/g;

  return javaCode.replace(
    scannerRegex,
    (match, gDouble, gSingle, gBlock, gSingleComment, gCommentText) => {
      if (gDouble || gSingle || gBlock) {
        return match;
      }

      if (gSingleComment) {
        const text = String(gCommentText || "");
        // Check if there are trailing braces like "comment } }" or "comment }"
        const braceMatch = text.match(/^(.*?)(\s*(?:[}\]\);]\s*)+)$/);
        if (braceMatch) {
          const commentPart = braceMatch[1].trim();
          const codePart = braceMatch[2];
          return `/* ${commentPart} */ ${codePart}\n`;
        }
        return `/* ${text.trim()} */\n`;
      }

      return match;
    },
  );
}
