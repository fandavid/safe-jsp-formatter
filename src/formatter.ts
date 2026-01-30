import * as beautify from "js-beautify";

export function formatJsp(
  text: string,
  options: { tabSize: number; insertSpaces: boolean },
): string {
  const placeholders: string[] = [];

  // Use a unique marker
  const marker = `ZJSP${Math.random().toString(36).substring(2, 6).toUpperCase()}Z`;

  // 1. Identify and Pre-format JSP Tags
  const jspPattern = /<%[\s\S]*?%>/g;

  let processedText = text.replace(jspPattern, (match) => {
    let finalContent = match;

    // Format Java Scriptlets (excluding directives <%@, expressions <%=, declarations <%!, and comments <%--)
    // 注意：<%! 是 JSP 宣告區塊，包含方法/變數宣告，不應被格式化處理
    if (match.startsWith("<%") && !["@", "=", "-", "!"].includes(match[2])) {
      // 取出 <% 和 %> 之間的內容（不要 trim，保留縮排結構）
      let innerCode = match.substring(2, match.length - 2);
      // 只移除開頭的第一個換行（如果有的話）
      if (innerCode.startsWith("\n")) {
        innerCode = innerCode.substring(1);
      }
      // 只移除結尾的最後一個換行（如果有的話）
      if (innerCode.endsWith("\n")) {
        innerCode = innerCode.substring(0, innerCode.length - 1);
      }

      // 保守策略：只清理多餘空行，保留原本的換行結構
      // 不使用 js-beautify，因為它是給 JavaScript 用的，無法正確處理 Java 語法
      const lines = innerCode.split("\n");

      // 計算最小縮排（忽略空行），作為基準縮排
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

      // 移除基準縮排，並加上新的基礎縮排
      const baseIndent = options.insertSpaces
        ? " ".repeat(options.tabSize)
        : "\t";
      const cleanedLines = lines
        .map((line) => line.trimEnd()) // 移除行尾空白
        .filter((line, index, arr) => {
          // 移除連續空行（保留最多一行空行）
          if (line.trim() === "" && index > 0 && arr[index - 1].trim() === "") {
            return false;
          }
          return true;
        })
        .map((line) => {
          if (line.trim() === "") return "";
          // 移除基準縮排，保留相對縮排
          const stripped = line.substring(minIndent);
          return baseIndent + stripped;
        });

      finalContent = `<%\n${cleanedLines.join("\n")}\n%>`;
    }

    const placeholder = `${marker}${placeholders.length}${marker}`;
    placeholders.push(finalContent);
    return placeholder;
  });

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
  // Force <title> to be a single line
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
  // Only match directives (<%@ ... %>), not expressions (<%=) or scriptlets (<%)
  // Use a more specific pattern that doesn't cross into other JSP tags
  formattedText = formattedText.replace(/(<%@[^%]*%>)(?![\r\n])/g, "$1\n");

  // Fix mangled < script
  formattedText = formattedText.replace(/<\s+script/g, "<script");

  // Fix attribute spacing
  formattedText = formattedText.replace(
    /(\s[a-zA-Z0-9_-]+)\s*=\s*(["'])/g,
    "$1=$2",
  );

  // Fix JSP tag mangling
  formattedText = formattedText.replace(/%\s+>/g, "%>");

  return formattedText;
}
