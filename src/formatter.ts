import * as beautify from "js-beautify";
import * as prettier from "prettier";
// @ts-ignore
const javaPlugin = require("prettier-plugin-java");

export async function formatJsp(
  text: string,
  options: { tabSize: number; insertSpaces: boolean },
): Promise<string> {
  const placeholders: string[] = [];

  // Use a unique marker
  const marker = `ZJSP${Math.random().toString(36).substring(2, 6).toUpperCase()}Z`;

  // 1. Identify and Pre-format JSP Tags
  // Pre-process: Normalize JSP tags (e.g. <% ! -> <%!, <% = -> <%=)
  // 此步驟解決 error_v1.jsp 這類因標籤寫法不標準導致的格式化問題
  let processedText = text
    .replace(/<%\s+!/g, "<%!")
    .replace(/<%\s+=/g, "<%=")
    .replace(/<%\s+@/g, "<%@");

  const jspPattern = /<%[\s\S]*?%>/g;
  const matches: {
    fullMatch: string;
    index: number;
    length: number;
    formatted: string;
  }[] = [];

  // 使用 while loop 和 exec 來收集所有匹配項
  let match;
  while ((match = jspPattern.exec(processedText)) !== null) {
    matches.push({
      fullMatch: match[0],
      index: match.index,
      length: match[0].length,
      formatted: match[0], // Pre-fill with original, will be updated
    });
  }

  // 並行處理所有 JSP 區塊的格式化
  await Promise.all(
    matches.map(async (item) => {
      const matchText = item.fullMatch;

      // Detect tag type
      const tagChar = matchText.length > 2 ? matchText[2] : "";
      const isDirective = tagChar === "@";
      // Check for <%--
      const isComment = tagChar === "-" && matchText[3] === "-";
      const isExpression = tagChar === "=";
      const isDeclaration = tagChar === "!";
      const isScriptlet =
        !isDirective && !isComment && !isExpression && !isDeclaration;

      // Format Java Scriptlets AND Declarations
      if (isScriptlet || isDeclaration) {
        const headerLength = isDeclaration ? 3 : 2; // <%! vs <%
        let innerCode = matchText.substring(headerLength, matchText.length - 2);

        // 嘗試使用 Prettier 進行 Google Java Style 格式化
        try {
          const formattedJava = await tryFormatJava(
            innerCode,
            isDeclaration,
            options.tabSize,
            options.insertSpaces,
          );
          const startTag = isDeclaration ? "<%!" : "<%";
          item.formatted = `${startTag}\n${formattedJava}\n%>`;
        } catch (e) {
          // Fallback to safe indentation-only mode
          if (innerCode.startsWith("\n")) {
            innerCode = innerCode.substring(1);
          }
          if (innerCode.endsWith("\n")) {
            innerCode = innerCode.substring(0, innerCode.length - 1);
          }

          const lines = innerCode.split("\n");
          const nonEmptyLines = lines.filter((line) => line.trim() !== "");
          const minIndent =
            nonEmptyLines.length > 0
              ? Math.min(
                  ...nonEmptyLines.map((line) => {
                    const match = line.match(/^(\s*)/);
                    return match ? match[1].length : 0;
                  }),
                )
              : 0;

          const baseIndent = options.insertSpaces
            ? " ".repeat(options.tabSize)
            : "\t";
          const cleanedLines = lines
            .map((line) => line.trimEnd())
            .filter((line, index, arr) => {
              if (
                line.trim() === "" &&
                index > 0 &&
                arr[index - 1].trim() === ""
              ) {
                return false;
              }
              return true;
            })
            .map((line) => {
              if (line.trim() === "") {
                return "";
              }
              const stripped = line.substring(minIndent);
              return baseIndent + stripped;
            });

          const startTag = isDeclaration ? "<%!" : "<%";
          item.formatted = `${startTag}\n${cleanedLines.join("\n")}\n%>`;
        }
      }
    }),
  );

  // 重組字串：使用 placeholders 機制
  let newText = "";
  let lastIndex = 0;

  for (const item of matches) {
    // 加回中間的 HTML
    newText += processedText.substring(lastIndex, item.index);

    // 生成 placeholder
    const placeholder = `${marker}${placeholders.length}${marker}`;
    placeholders.push(item.formatted);
    newText += placeholder;

    lastIndex = item.index + item.length;
  }
  // 加回最後剩餘的部分
  newText += processedText.substring(lastIndex);
  processedText = newText;

  // 2. Format HTML
  const beautifyOptions: beautify.HTMLBeautifyOptions = {
    indent_size: options.tabSize,
    indent_char: options.insertSpaces ? " " : "\t",
    max_preserve_newlines: 2,
    preserve_newlines: true,
    indent_scripts: "keep",
    end_with_newline: true,
    wrap_line_length: 0,
    indent_inner_html: false,
    indent_empty_lines: false,
    templating: ["erb"],
    unformatted: ["pre", "code", "textarea"],
    content_unformatted: ["title"],
    // Ensure that top-level JSP tags (placeholders) are treated as block-ish
    extra_liners: [],
  };

  let formattedText = beautify.html(processedText, beautifyOptions);

  // 3. Restore JSP Tags
  for (let i = 0; i < placeholders.length; i++) {
    const placeholder = `${marker}${i}${marker}`;
    formattedText = formattedText.split(placeholder).join(placeholders[i]);
  }

  // 4. Post-processing Cleanup
  formattedText = formattedText.replace(
    /<title>([\s\S]*?)<\/title>/gi,
    (match, p1) => {
      if (typeof p1 !== "string") {
        return match;
      }
      const cleanContent = p1.replace(/\s+/g, " ").trim();
      return `<title>${cleanContent}</title>`;
    },
  );

  // Ensure directives at the top stay on their own lines and aren't squashed
  formattedText = formattedText.replace(/(<%@[^%]*%>)(?![\r\n])/g, "$1\n");

  // Fix mangled < script
  formattedText = formattedText.replace(/<\s+script/g, "<script");

  // Fix JSP tag mangling
  formattedText = formattedText.replace(/%\s+>/g, "%>");

  return formattedText;
}

async function tryFormatJava(
  code: string,
  isDeclaration: boolean,
  tabSize: number,
  insertSpaces: boolean,
): Promise<string> {
  const wrapperClassStart = "class Dummy {";
  const wrapperMethodStart = "void dummy() {";
  const wrapperEnd = "}";

  // Smart Fix: 如果代碼是單行且包含 "//" 註解後面跟著 "}"，這通常意味著註解吃掉了閉合括號
  // 將其轉換為 block comment 以修復語法錯誤
  // e.g. "... // comment } ..." -> "... /* comment */ } ..."
  if (code.includes("//")) {
    code = code.replace(/\/\/([^\n]*?)}/g, "/*$1*/ }");
  }

  let wrappedCode = "";
  if (isDeclaration) {
    // 聲明區塊通常是類別成員 (方法/變數)，所以包在 class 中
    wrappedCode = `${wrapperClassStart}\n${code}\n${wrapperEnd}`;
  } else {
    // Scriptlet 通常是語句，所以包在方法中
    wrappedCode = `${wrapperClassStart}\n${wrapperMethodStart}\n${code}\n${wrapperEnd}\n${wrapperEnd}`;
  }

  // @ts-ignore
  const pluginToUse = javaPlugin.default || javaPlugin;
  const formattedWrapped = await prettier.format(wrappedCode, {
    parser: "java",
    plugins: [pluginToUse],
    tabWidth: tabSize,
    useTabs: !insertSpaces,
    printWidth: 100,
  });

  // Unwrap code
  let content = formattedWrapped.trim();

  // Remove class wrapper
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) throw new Error("Unwrap failed");

  content = content.substring(firstBrace + 1, lastBrace).trim();

  if (!isDeclaration) {
    // Remove method wrapper
    const methodFirstBrace = content.indexOf("{");
    const methodLastBrace = content.lastIndexOf("}");
    if (methodFirstBrace === -1 || methodLastBrace === -1)
      throw new Error("Unwrap method failed");

    content = content.substring(methodFirstBrace + 1, methodLastBrace).trim();
  }

  // Remove extra indentation level added by wrapper
  // Prettier indents everything inside class one level.
  const lines = content.split("\n");
  const indentStr = insertSpaces ? " ".repeat(tabSize) : "\t";

  // Detect if the first non-empty line has indentation to decide stripping strategy
  // But generally, we can just strip `tabSize` characters if they are whitespace.
  const unindentedLines = lines.map((line) => {
    if (line.startsWith(indentStr)) {
      return line.substring(indentStr.length);
    }
    // If line doesn't start with indentStr, could be blank line or a line starting at column 0
    return line;
  });

  // Re-add base indentation (for JSP context)
  const baseIndent = indentStr;
  return unindentedLines
    .map((l) => {
      // Don't indent blank lines
      if (l.trim() === "") return "";
      return baseIndent + l;
    })
    .join("\n");
}
