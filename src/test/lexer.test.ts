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
