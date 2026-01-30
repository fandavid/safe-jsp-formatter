const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "src/test/formatter.test.ts");
let content = fs.readFileSync(filePath, "utf8");

// 1. Convert test callbacks to async
content = content.replace(
  /test\("([^"]+)", \(\) => \{/g,
  'test("$1", async () => {',
);
content = content.replace(
  /test\(`([^`]+)`, \(\) => \{/g,
  "test(`$1`, async () => {",
); // Handle backticks just in case

// 2. Await formatJsp
content = content.replace(/formatJsp\(/g, "await formatJsp(");

// 3. Fix potential double await (if any)
content = content.replace(/await await/g, "await");

fs.writeFileSync(filePath, content);
console.log("Updated formatter.test.ts to use async/await");
