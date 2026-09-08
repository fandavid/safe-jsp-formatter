# Safe JSP Formatter 全方位優化設計規格書

- **日期**：2026-09-08
- **狀態**：Approved
- **專案**：safe-jsp-formatter

---

## 1. 背景與現有問題

`safe-jsp-formatter` 是一款專為 JSP 設計的非破壞性 VS Code 格式化擴充套件，採用「Placeholder 標記保護 + HTML Beautify + Prettier Java Style 混合排版」機制。

在當前版本（0.1.3）中，經過深入代碼與運行時檢視，存在以下關鍵缺陷與優化空間：

1. **單元測試回歸失敗**：`npm run test:unit` 中的 `Should SMARTLY FIX and FORMAT broken single-line Java code` 測試失敗。原因是 `protectSingleLineComments` 正則將 `// comment } }` 粗暴替換為 `/* comment } } */\n`，導致結尾的大括號被捲入區塊註解內，Prettier 解析語法報錯並降級，無法正常展開程式碼。
2. **字串內含 `%>` 破壞 JSP 標籤匹配**：現有正則 `const jspPattern = /<%[\s\S]*?%>/g;` 為非語境非貪婪匹配。若 Java 字串內出現 `"%>"`（例如 `String s = "test %> test";`），JSP 標籤會被提早腰斬，後半截 Java 代碼落入 HTML 被 `js-beautify` 破壞。
3. **JSP EL 表達式（`${...}`）未受保護**：HTML 屬性中的 `${...}` 直接交由 `js-beautify` 處理，容易在運算子或引號周圍被插入異常空格（例如 `<div class="${active ? " btn-primary" : "btn-secondary" }">`）。
4. **不完整/單行 Scriptlet 縮排歸零缺陷**：在 fallback 模式或簡單控制結構中，還原後的結尾 `%>` 總是從第 0 欄輸出，未繼承外層 HTML 的縮排層級。
5. **打包體積與發布衛生缺陷**：缺少 `.vscodeignore`，導致 `.vsix` 打包檔（4.4 MB）中夾帶了 `extension/tmp/*`、`extension/verify_format.js`、`extension/test_comments.js` 等開發除錯雜檔，且 `js-beautify` 被雙重打包（既進了 `dist/extension.js` 又出現在 `node_modules` 中）。
6. **缺乏使用者設定項**：`package.json` 未提供 `contributes.configuration`，使用者無法彈性設定 Java 格式化開關或自訂 HTML 排版選項。
7. **代碼規範警告**：ESLint 檢查報出 4 處 `curly` 警告。

---

## 2. 系統架構與設計目標

```
[原始 JSP 原始碼]
       │
       ▼
1. 語法掃描層 (Token-Aware Lexer)
   ├── 標籤標準化 (<% ! -> <%!, <% = -> <%=, <% @ -> <%@)
   ├── 語境感知掃描：字串、引號、跳脫字元、註解
   ├── 抽取 JSP 區塊 (<% ... %>) 與 EL 表達式 (${...})
   └── 註解安全升級：精準將 // comment 轉為 /* comment */，釋出後續程式碼/括號
       │
       ▼
2. 語法排版層 (Format Pipeline)
   ├── JSP Java 代碼以 Prettier (Google Java Style) 排版；失敗時進入智慧縮排 Fallback
   ├── 生成唯一 Placeholder (如 ___ZJSP_0___, ___ZEL_0___)
   └── HTML 以 js-beautify 執行結構化排版 (Placeholder 保持 inline/block 完整性)
       │
       ▼
3. 縮排重組層 (Indentation Restoration)
   ├── 偵測 Placeholder 在 HTML 中的實際縮排層級 (Base Indentation)
   ├── 將 JSP 區塊內部每一行與結尾 %> 依 Base Indentation 平移對齊
   └── 還原 EL 表達式與 JSP 區塊，執行安全後處理
       │
       ▼
[乾淨、安全的格式化結果]
```

---

## 3. 詳細模組設計規格

### 3.1 語境感知字元掃描器（Token-Aware Lexer）

取代原本易損壞的全局非貪婪正則，使用單次遍歷的狀態掃描器：

- **狀態定義**：
  - `TEXT`：一般 HTML 文本。
  - `JSP_TAG`：進入 `<%` 內部。
    - 子狀態：追蹤字串模式（雙引號 `"`、單引號 `'`）、字元轉義 `\`、單行註解 `//`、多行註解 `/* ... */`。
    - **規則**：只有在非字串、非註解狀態下遇到的 `%>`，才是 JSP 標籤的真正閉合點。若在字串 `"test %> test"` 中遇到 `%>`，狀態機維持在字串內，標籤不提前截斷。
  - `EL_EXPR`：進入 `${` 內部。
    - 追蹤引號與字串轉義，直到非引號狀態下的 `}` 閉合。
- **單行註解升級演算法（解決測試失敗與吃括號問題）**：
  - 當在 Java 腳本中遇到 `//` 時，讀取至行末。
  - 檢測該註解段落之後是否存在有效代碼或閉合大括號（例如 `// comment } }` 或 `// comment\n`）。
  - 將註解文字部分截取並包裹為 `/* ${commentText} */`，而後方緊隨的 `} }` 或代碼則置於註解區塊之外。
  - 範例轉換：`{ // comment } }` 轉為 `{ /* comment */ } }`。
  - 結果：Prettier 能識別完整的語法括號，成功展開並格式化，測試 `Should SMARTLY FIX and FORMAT broken single-line Java code` 順利通過。

### 3.2 縮排對齊校正器（Indentation Alignment）

- **問題解決**：原版在 `formattedText.split(placeholder).join(item.formatted)` 時，若 `item.formatted` 是多行文本，只有第一行吃到 HTML 的縮排，後續行（尤其是結尾 `%>`）落在第 0 欄。
- **對齊邏輯**：
  1. 在還原 placeholder 時，以行檢索 placeholder 出現的位置，取得該行在 placeholder 之前的空白字元作為 `lineBaseIndent`。
  2. 若替換內容為多行（如多行 `<%\n ... \n%>`），除第一行外，其餘每一行（含內部代碼與 `%>`）皆補上 `lineBaseIndent` 相對縮排。
  3. 對於單行控制語句（如 `<% if (true) { %>` 或 `<% } %>`），若原代碼為單行且不包含換行，保留為單行格式，不強制拆行。

### 3.3 VS Code Configuration 設定項 (`package.json`)

在 `package.json` 的 `contributes.configuration` 中新增以下設定：

```json
{
  "safeJspFormatter.enableJavaFormatting": {
    "type": "boolean",
    "default": true,
    "description": "啟用 Prettier Google Java Style 格式化 JSP 內部的 Java 程式碼。"
  },
  "safeJspFormatter.enableHtmlFormatting": {
    "type": "boolean",
    "default": true,
    "description": "啟用 HTML 結構化排版 (js-beautify)。"
  },
  "safeJspFormatter.printWidth": {
    "type": "number",
    "default": 100,
    "description": "Java 代碼排版的最大單行字元長度 (printWidth)。"
  },
  "safeJspFormatter.htmlOptions": {
    "type": "object",
    "default": {},
    "description": "自訂傳遞給 js-beautify 的 HTML 格式化選項。"
  }
}
```

在 `src/extension.ts` 與 `src/formatter.ts` 中讀取並傳入格式化選項。

### 3.4 工程瘦身與打包優化 (`.vscodeignore` & 專案清理)

1. **建立 `.vscodeignore`**：
   - 排除：
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
     .eslintrc*
     **/*.map
     ```
2. **依賴優化**：
   - `js-beautify` 已被 `esbuild` 完整打包進 `dist/extension.js`。確認打包外部依賴只保留 `prettier` 與 `prettier-plugin-java`，避免重複拷貝 `node_modules/js-beautify`。
3. **代碼清理**：
   - 清除或移轉根目錄之除錯腳本（`test_comments.js`, `test_split.js`, `verify_format.js`, `migrate_test.js`）。
   - 修復 `src/formatter.ts` 的 ESLint 警告（補齊 `if` 條件後的 `{}` 區塊括號）。

---

## 4. 測試與驗證計畫

1. **單元測試驗證**：
   - 執行 `npm run test:unit`，確保原有 17 個測試案例（包含之前失敗的 `broken single-line Java code`）全部 100% 通過。
2. **新邊界案例測試**：
   - **測試案例 A**：Java 字串內含 `%>`（如 `String s = "Hello %> World";`），驗證標籤不被破壞且代碼完整保留。
   - **測試案例 B**：HTML 屬性內含 EL 表達式（如 `<a href="${path}?id=${user.id}">`），驗證屬性無非預期空格插入。
   - **測試案例 C**：巢狀縮排驗證（如 `<div>` 縮排 4 空格內部的 `<% ... %>`），驗證結尾 `%>` 具有 4 空格對齊，不落於第 0 欄。
   - **測試案例 D**：單行控制標籤（如 `<% if (true) { %>`）保留單行或正確縮排。
3. **編譯與 Lint 驗證**：
   - `npm run check-types` 零錯誤。
   - `npm run lint` 零錯誤零警告。
   - `npm run compile` 建置成功。
4. **VSIX 打包驗證**：
   - 執行打包檢查打包清單，確認 `.vsix` 內不再含有 `tmp/` 與臨時測試腳本，體積顯著縮減。

---

## 5. 風險與對策

| 風險項目 | 潛在影響 | 應對對策 |
|---|---|---|
| 自行撰寫掃描器可能遺漏未知的特殊語法 | 某些特殊註解或跳脫字元導致解析異常 | 採用漸進式回退：掃描器遇異常直接安全回退至整塊保留，並補充完整單元測試覆蓋 |
| 使用者未安裝 Prettier 依賴 | VS Code 擴充套件執行時可能報找不到模組 | 保留 CommonJS/ESM 雙模式動態加載機制，Prettier 載入失敗時無縫降級為 Safe Indentation Mode |
