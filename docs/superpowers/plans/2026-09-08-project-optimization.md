# Safe JSP Formatter 全方位優化實作計畫

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 為 safe-jsp-formatter 構建輕量語境感知 Lexer 解決字串內 `%>` 與 EL 表達式被破壞問題、修復單元測試中的單行註解吃括號回歸問題、校正 `%>` 縮排對齊、新增 VS Code 設定項並透過 `.vscodeignore` 瘦身 VSIX 打包。

**Architecture:** 
1. 實作獨立無依賴的 `src/lexer.ts` 字元掃描器，具備字串/引號/註解感知的 JSP 標籤與 EL 表達式抽取，以及安全的註解括號分離。
2. 重構 `src/formatter.ts` 對接 Lexer，並在還原時實作多行相對 Base Indentation 對齊。
3. 在 `package.json` 註冊設定項，在 `src/extension.ts` 注入設定。
4. 加入 `.vscodeignore` 排除 `tmp/` 與本機除錯腳本，清理根目錄雜檔並消除 ESLint 警告。

**Tech Stack:** TypeScript 5.9, VS Code Extension API, esbuild, Mocha, js-beautify, Prettier, prettier-plugin-java.

## Global Constraints

- 不引入新的非必要 runtime 外部依賴（Lexer 必須純字元比對，零第三方依賴）。
- 嚴格維持向後相容：不得破壞現有 17 個單元測試案例的預期格式化行為。
- 排版需保證非破壞性：未識別或無效 Java 區塊必須安全回退（Safe Indentation Mode）。
- ESLint 必須零警告（解決所有 `curly` 警告）。
- TypeScript 編譯與型別檢查 `npm run check-types` 必須 100% 通過。

---

### Task 1: 實作語境感知 Lexer (`src/lexer.ts`) 與獨立單元測試

**Files:**
- Create: `src/lexer.ts`
- Create: `src/test/lexer.test.ts`

**Interfaces:**
- Produces:
  ```ts
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

  export function scanJspAndEl(text: string): LexerResult;
  export function protectAndSplitComments(javaCode: string): string;
  ```

- [ ] **Step 1: 撰寫 Lexer 失敗測試 (`src/test/lexer.test.ts`)**

```ts
import * as assert from "assert";
import { scanJspAndEl, protectAndSplitComments } from "../lexer";

suite("Lexer Scanner Tests", () => {
  test("Should not break JSP tag when Java string literal contains %>", () => {
    const input = '<% String s = "test %> test"; int x = 10; %>';
    const result = scanJspAndEl(input);
    assert.strictEqual(result.jspTags.length, 1);
    assert.strictEqual(result.jspTags[0].fullMatch, input);
    assert.strictEqual(result.jspTags[0].type, "scriptlet");
  });

  test("Should identify and extract EL expressions without breaking quotes", () => {
    const input = '<div class="${active ? "btn-primary" : "btn-secondary"}"></div>';
    const result = scanJspAndEl(input);
    assert.strictEqual(result.elExpressions.length, 1);
    assert.strictEqual(result.elExpressions[0].fullMatch, '${active ? "btn-primary" : "btn-secondary"}');
  });

  test("Should correctly protect single line comment and separate trailing braces", () => {
    const code = "private void test() { try { } catch(Exception e) { // comment } }";
    const protectedCode = protectAndSplitComments(code);
    assert.ok(protectedCode.includes("/* comment */"));
    assert.ok(protectedCode.trim().endsWith("} }"));
    assert.ok(!protectedCode.includes("/* comment } } */"));
  });
});
```

- [ ] **Step 2: 執行測試確認失敗**

Run: `npm run compile-tests && npx mocha --ui tdd out/test/lexer.test.js`
Expected: FAIL with "Cannot find module '../lexer'"

- [ ] **Step 3: 實作 `src/lexer.ts`**

```ts
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
        const braceMatch = text.match(/^(.*?)(\s*[}\]]+\s*)$/);
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
```

- [ ] **Step 4: 執行單元測試驗證通過**

Run: `npm run compile-tests && npx mocha --ui tdd out/test/lexer.test.js`
Expected: PASS (3 passing)

---

### Task 2: 重構 `src/formatter.ts` 對接 Lexer 並實作縮排重組對齊

**Files:**
- Modify: `src/formatter.ts`

**Interfaces:**
- Consumes: `scanJspAndEl`, `protectAndSplitComments` from `./lexer`
- Produces:
  ```ts
  export interface FormatOptions {
    tabSize: number;
    insertSpaces: boolean;
    enableJavaFormatting?: boolean;
    enableHtmlFormatting?: boolean;
    printWidth?: number;
    htmlOptions?: Record<string, unknown>;
  }

  export async function formatJsp(text: string, options: FormatOptions): Promise<string>;
  ```

- [ ] **Step 1: 重寫 `src/formatter.ts`**

改用 Lexer 抽取標籤與 EL 表達式，修復縮排對齊與 ESLint curly 警告：

```ts
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
        lines[lineIdx] = line.replace(placeholder, formattedContent);
      } else {
        const baseIndentMatch = line.substring(0, phIndex).match(/^(\s*)/);
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

        lines[lineIdx] = line.replace(placeholder, alignedLines.join("\n"));
      }
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
```

- [ ] **Step 2: 執行編譯確認型別無誤**

Run: `npm run check-types`
Expected: PASS with 0 errors

- [ ] **Step 3: 執行 ESLint 確認警告消除**

Run: `npm run lint`
Expected: PASS with 0 errors and 0 warnings

---

### Task 3: 驗證回歸測試並增加邊界案例測試 (`src/test/formatter.test.ts`)

**Files:**
- Modify: `src/test/formatter.test.ts`

- [ ] **Step 1: 新增邊界案例測試至 `src/test/formatter.test.ts`**

在 `src/test/formatter.test.ts` 末尾增加以下測試：

```ts
  // === New Optimization Edge Cases ===

  test("Should NOT break JSP tag when Java string contains %>", async () => {
    const input = `<%
    String message = "Notice: %> symbol inside string";
    System.out.println(message);
%>`;
    const result = await formatJsp(input, defaultOptions);
    assert.ok(result.includes('String message = "Notice: %> symbol inside string";'));
    assert.ok(result.includes("System.out.println(message);"));
    assert.strictEqual((result.match(/<%/g) || []).length, 1);
    assert.strictEqual((result.match(/%>/g) || []).length, 1);
  });

  test("Should preserve EL expression inside HTML attributes without inserting spaces", async () => {
    const input = '<div class="${active ? "btn-primary" : "btn-secondary"}"><span>${user.name}</span></div>';
    const result = await formatJsp(input, defaultOptions);
    assert.ok(
      result.includes('class="${active ? "btn-primary" : "btn-secondary"}"'),
      "EL expression inside attribute must preserve exact spacing",
    );
    assert.ok(result.includes("<span>${user.name}</span>"));
  });

  test("Should align closing %> with outer HTML indentation", async () => {
    const input = `<div>
    <%
    if (true) {
        doSomething();
    }
    %>
</div>`;
    const result = await formatJsp(input, defaultOptions);
    const lines = result.split("\n");
    const closingTagLine = lines.find((l) => l.trim() === "%>");
    assert.ok(closingTagLine, "Must find closing tag line");
    assert.ok(
      closingTagLine.startsWith("    "),
      `Closing tag should have 4 spaces indent, got: "${closingTagLine}"`,
    );
  });
```

- [ ] **Step 2: 執行全部單元測試**

Run: `npm run test:unit`
Expected: ALL PASS (20 passing, 0 failing)

---

### Task 4: VS Code Settings 擴充 (`package.json` & `src/extension.ts`)

**Files:**
- Modify: `package.json`
- Modify: `src/extension.ts`

- [ ] **Step 1: 在 `package.json` 註冊 `contributes.configuration`**

在 `package.json` 的 `contributes` 區塊加入：

```json
    "configuration": {
      "title": "Safe JSP Formatter",
      "properties": {
        "safeJspFormatter.enableJavaFormatting": {
          "type": "boolean",
          "default": true,
          "description": "Enable Prettier Google Java Style formatting inside JSP scriptlets and declarations."
        },
        "safeJspFormatter.enableHtmlFormatting": {
          "type": "boolean",
          "default": true,
          "description": "Enable HTML beautification via js-beautify."
        },
        "safeJspFormatter.printWidth": {
          "type": "number",
          "default": 100,
          "description": "Maximum line width for formatted Java code inside JSP."
        },
        "safeJspFormatter.htmlOptions": {
          "type": "object",
          "default": {},
          "description": "Custom options passed to js-beautify for HTML formatting."
        }
      }
    }
```

- [ ] **Step 2: 更新 `src/extension.ts` 讀取設定並傳遞給 `formatJsp`**

```ts
import * as vscode from "vscode";
import { formatJsp, FormatOptions } from "./formatter";
import * as packageJson from "../package.json";

function getFormatOptions(vsOptions: vscode.FormattingOptions): FormatOptions {
  const config = vscode.workspace.getConfiguration("safeJspFormatter");
  return {
    tabSize: vsOptions.tabSize,
    insertSpaces: vsOptions.insertSpaces,
    enableJavaFormatting: config.get<boolean>("enableJavaFormatting", true),
    enableHtmlFormatting: config.get<boolean>("enableHtmlFormatting", true),
    printWidth: config.get<number>("printWidth", 100),
    htmlOptions: config.get<Record<string, unknown>>("htmlOptions", {}),
  };
}

export function activate(context: vscode.ExtensionContext) {
  const version = packageJson.version;
  const activateTime = new Date().toLocaleString();
  console.log(`[Safe JSP Formatter v${version}] Activated at ${activateTime}`);

  context.subscriptions.push(
    vscode.languages.registerDocumentFormattingEditProvider(
      { language: "jsp", scheme: "file" },
      {
        async provideDocumentFormattingEdits(
          document: vscode.TextDocument,
          options: vscode.FormattingOptions,
        ): Promise<vscode.TextEdit[]> {
          try {
            const text = document.getText();
            const range = new vscode.Range(
              document.positionAt(0),
              document.positionAt(text.length),
            );

            const formatOptions = getFormatOptions(options);
            const formatted = await formatJsp(text, formatOptions);
            return [vscode.TextEdit.replace(range, formatted)];
          } catch (err) {
            console.error("[Safe JSP Formatter] Error during formatting:", err);
            return [];
          }
        },
      },
    ),
  );

  context.subscriptions.push(
    vscode.languages.registerDocumentRangeFormattingEditProvider(
      { language: "jsp", scheme: "file" },
      {
        async provideDocumentRangeFormattingEdits(
          document: vscode.TextDocument,
          range: vscode.Range,
          options: vscode.FormattingOptions,
        ): Promise<vscode.TextEdit[]> {
          try {
            const text = document.getText(range);
            const formatOptions = getFormatOptions(options);
            const formatted = await formatJsp(text, formatOptions);
            return [vscode.TextEdit.replace(range, formatted)];
          } catch (err) {
            console.error(
              "[Safe JSP Formatter] Error during range formatting:",
              err,
            );
            return [];
          }
        },
      },
    ),
  );
}

export function deactivate() {}
```

- [ ] **Step 3: 執行編譯與檢查**

Run: `npm run compile`
Expected: PASS with no errors or warnings

---

### Task 5: 專案清理、`.vscodeignore` 設定與打包驗證

**Files:**
- Create: `.vscodeignore`
- Delete: `test_split.js`, `test_comments.js`, `verify_format.js`, `migrate_test.js`

- [ ] **Step 1: 建立 `.vscodeignore`**

```
.vscode/**
out/**
src/**
tmp/**
docs/**
test_*.js
verify_*.js
migrate_*.js
*.vsix
tsconfig.json
eslint.config.mjs
**/*.map
```

- [ ] **Step 2: 清理根目錄除錯腳本**

Run: `rm -f test_split.js test_comments.js verify_format.js migrate_test.js`

- [ ] **Step 3: 驗證整體構建與測試流程**

Run: `npm run check-types && npm run lint && npm run test:unit && npm run compile`
Expected: ALL PASS with 0 errors and 0 warnings.
