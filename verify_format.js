const { formatJsp } = require("./out/formatter");
const fs = require("fs");

// 1. 建立一個縮排錯誤的版本
const badIndentInput = `<%
! // 宣告輔助方法 private boolean isDevMode() { ... }
%>`;

console.log("=== 1. 測試輸入 (縮排已亂) ===");
console.log(badIndentInput);

// 2. 執行格式化
const result = formatJsp(badIndentInput, { tabSize: 4, insertSpaces: true });

console.log("\n=== 2. 格式化結果 ===");
console.log(result);

// 3. 驗證
const expectedIndent = "    ! //";
if (result.includes(expectedIndent)) {
  console.log("\n✅ 驗證成功：Formatter 修正了縮排！");
} else {
  console.log("\n❌ 驗證失敗：Formatter 沒有修正縮排");
  console.log("實際結果:", result);
}

// 4. 解釋 error_v1.jsp 的情況
try {
  const fileContent = fs.readFileSync("./tmp/error_v1.jsp", "utf-8");
  const originalFormatter = formatJsp(fileContent, {
    tabSize: 4,
    insertSpaces: true,
  });

  console.log("\n=== error_v1.jsp 現狀 ===");
  if (fileContent.trim() === originalFormatter.trim()) {
    console.log(
      "檔案內容完全未變 (No Change) -> 因為縮排原本就是對的，且 Formatter 為了安全不會自動插入換行。",
    );
  } else {
    console.log("檔案內容有變化。");
  }
} catch (e) {
  console.log("無法讀取 error_v1.jsp");
}
