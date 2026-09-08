import * as beautify from "js-beautify";
import * as prettier from "prettier";
import { scanJspAndEl, protectAndSplitComments } from "./lexer";

// @ts-ignore
const javaPlugin = require("prettier-plugin-java");

export interface FormatOptions {
  tabSize: number;
  insertSpaces: boolean;
  enableJavaFormatting?: boolean;
  enableHtmlFormatting?: boolean;
  printWidth?: number;
  htmlOptions?: Record<string, unknown>;
}

export async function formatJsp(
  text: string,
  options: FormatOptions,
): Promise<string> {
  // 1. Pre-process: Normalize non-standard JSP tags
  let processedText = text
    .replace(/<%\s+!/g, "<%!")
    .replace(/<%\s+=/g, "<%=")
    .replace(/<%\s+@/g, "<%@");

  const marker = `ZJSP${Math.random().toString(36).substring(2, 6).toUpperCase()}Z`;
  const elMarker = `ZEL${Math.random().toString(36).substring(2, 6).toUpperCase()}Z`;

  const { jspTags, elExpressions } = scanJspAndEl(processedText);

  // 2. Format Java in JSP tags (Scriptlets and Declarations)
  const formattedJspMap = new Map<number, string>();
  const enableJava = options.enableJavaFormatting !== false;

  await Promise.all(
    jspTags.map(async (item, idx) => {
      if (item.type === "scriptlet" || item.type === "declaration") {
        const isDeclaration = item.type === "declaration";
        let innerCode = item.innerContent;

        // Upgrade single line comments safely
        innerCode = protectAndSplitComments(innerCode);

        if (enableJava) {
          try {
            const formattedJava = await tryFormatJava(
              innerCode,
              isDeclaration,
              options.tabSize,
              options.insertSpaces,
              options.printWidth || 100,
            );
            const startTag = isDeclaration ? "<%!" : "<%";
            formattedJspMap.set(idx, `${startTag}\n${formattedJava}\n%>`);
            return;
          } catch (e) {
            // Fallback to safe indentation mode below
          }
        }

        // Safe Fallback Mode
        const fallbackFormatted = formatSafeIndentation(
          innerCode,
          isDeclaration,
          options,
          item.isSingleLine,
        );
        formattedJspMap.set(idx, fallbackFormatted);
      } else {
        formattedJspMap.set(idx, item.fullMatch);
      }
    }),
  );

  // 3. Replace JSP Tags and EL Expressions with Placeholders
  const allTokens: Array<{
    type: "jsp" | "el";
    startIndex: number;
    endIndex: number;
    placeholder: string;
    content: string;
  }> = [];

  jspTags.forEach((tag, idx) => {
    const placeholder = `${marker}${idx}${marker}`;
    allTokens.push({
      type: "jsp",
      startIndex: tag.startIndex,
      endIndex: tag.endIndex,
      placeholder,
      content: formattedJspMap.get(idx) || tag.fullMatch,
    });
  });

  elExpressions.forEach((el, idx) => {
    const placeholder = `${elMarker}${idx}${elMarker}`;
    allTokens.push({
      type: "el",
      startIndex: el.startIndex,
      endIndex: el.endIndex,
      placeholder,
      content: el.fullMatch,
    });
  });

  // Sort tokens by startIndex ascending
  allTokens.sort((a, b) => a.startIndex - b.startIndex);

  let newText = "";
  let lastIndex = 0;
  for (const token of allTokens) {
    if (token.startIndex < lastIndex) {
      continue; // Overlapping protection
    }
    newText += processedText.substring(lastIndex, token.startIndex);
    newText += token.placeholder;
    lastIndex = token.endIndex;
  }
  newText += processedText.substring(lastIndex);
  processedText = newText;

  // 4. Format HTML with js-beautify
  if (options.enableHtmlFormatting !== false) {
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
      extra_liners: [],
      ...(options.htmlOptions || {}),
    };

    processedText = beautify.html(processedText, beautifyOptions);
  }

  // 5. Restore EL Expressions
  for (let i = 0; i < elExpressions.length; i++) {
    const placeholder = `${elMarker}${i}${elMarker}`;
    processedText = processedText.split(placeholder).join(elExpressions[i].fullMatch);
  }

  // 6. Restore JSP Tags with Indentation Alignment
  const lines = processedText.split("\n");
  for (let i = 0; i < jspTags.length; i++) {
    const placeholder = `${marker}${i}${marker}`;
    const formattedContent = formattedJspMap.get(i) || jspTags[i].fullMatch;
    const contentLines = formattedContent.split("\n");

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      const phIndex = line.indexOf(placeholder);
      if (phIndex === -1) {
        continue;
      }

      if (contentLines.length <= 1) {
        lines[lineIdx] = line.replace(placeholder, () => formattedContent);
      } else {
        const lastNewline = line.lastIndexOf("\n", phIndex);
        const currentLinePrefix =
          lastNewline === -1
            ? line.substring(0, phIndex)
            : line.substring(lastNewline + 1, phIndex);
        const baseIndentMatch = currentLinePrefix.match(/^(\s*)/);
        const baseIndent = baseIndentMatch ? baseIndentMatch[1] : "";

        const alignedLines = contentLines.map((cL, cIdx) => {
          if (cIdx === 0) {
            return cL;
          }
          if (cL.trim() === "") {
            return "";
          }
          return baseIndent + cL;
        });

        const aligned = alignedLines.join("\n");
        lines[lineIdx] = line.replace(placeholder, () => aligned);
      }
      break;
    }
  }
  let formattedText = lines.join("\n");

  // 7. Post-processing Cleanup
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

  formattedText = formattedText.replace(/(<%@[^%]*%>)(?![\r\n])/g, "$1\n");
  formattedText = formattedText.replace(/<\s+script/g, "<script");
  formattedText = formattedText.replace(/%\s+>/g, "%>");

  return formattedText;
}

function formatSafeIndentation(
  innerCode: string,
  isDeclaration: boolean,
  options: FormatOptions,
  isSingleLine: boolean,
): string {
  const startTag = isDeclaration ? "<%!" : "<%";
  let code = innerCode;

  if (isSingleLine && !code.includes("\n")) {
    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return `${startTag} %>`;
    }
    return `${startTag} ${trimmed} %>`;
  }

  if (code.startsWith("\n")) {
    code = code.substring(1);
  }
  if (code.endsWith("\n")) {
    code = code.substring(0, code.length - 1);
  }

  const rawLines = code.split("\n");
  const nonEmptyLines = rawLines.filter((l) => l.trim() !== "");
  const minIndent =
    nonEmptyLines.length > 0
      ? Math.min(
          ...nonEmptyLines.map((l) => {
            const m = l.match(/^(\s*)/);
            return m ? m[1].length : 0;
          }),
        )
      : 0;

  const baseIndent = options.insertSpaces ? " ".repeat(options.tabSize) : "\t";
  const cleanedLines = rawLines
    .map((l) => l.trimEnd())
    .filter((l, idx, arr) => {
      if (l.trim() === "" && idx > 0 && arr[idx - 1].trim() === "") {
        return false;
      }
      return true;
    })
    .map((l) => {
      if (l.trim() === "") {
        return "";
      }
      const stripped = l.substring(minIndent);
      return baseIndent + stripped;
    });

  return `${startTag}\n${cleanedLines.join("\n")}\n%>`;
}

async function tryFormatJava(
  code: string,
  isDeclaration: boolean,
  tabSize: number,
  insertSpaces: boolean,
  printWidth: number,
): Promise<string> {
  const wrapperClassStart = "class Dummy {";
  const wrapperMethodStart = "void dummy() {";
  const wrapperEnd = "}";

  let wrappedCode = "";
  if (isDeclaration) {
    wrappedCode = `${wrapperClassStart}\n${code}\n${wrapperEnd}`;
  } else {
    wrappedCode = `${wrapperClassStart}\n${wrapperMethodStart}\n${code}\n${wrapperEnd}\n${wrapperEnd}`;
  }

  // @ts-ignore
  const pluginToUse = javaPlugin.default || javaPlugin;
  const formattedWrapped = await prettier.format(wrappedCode, {
    parser: "java",
    plugins: [pluginToUse],
    tabWidth: tabSize,
    useTabs: !insertSpaces,
    printWidth,
  });

  let content = formattedWrapped.trim();
  const firstBrace = content.indexOf("{");
  const lastBrace = content.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1) {
    throw new Error("Unwrap failed");
  }

  content = content.substring(firstBrace + 1, lastBrace).trim();

  if (!isDeclaration) {
    const methodFirstBrace = content.indexOf("{");
    const methodLastBrace = content.lastIndexOf("}");
    if (methodFirstBrace === -1 || methodLastBrace === -1) {
      throw new Error("Unwrap method failed");
    }
    content = content.substring(methodFirstBrace + 1, methodLastBrace).trim();
  }

  const lines = content.split("\n");
  const indentStr = insertSpaces ? " ".repeat(tabSize) : "\t";

  const unindentedLines = lines.map((line) => {
    if (line.startsWith(indentStr)) {
      return line.substring(indentStr.length);
    }
    return line;
  });

  const baseIndent = indentStr;
  return unindentedLines
    .map((l) => {
      if (l.trim() === "") {
        return "";
      }
      return baseIndent + l;
    })
    .join("\n");
}
