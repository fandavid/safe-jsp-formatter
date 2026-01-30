import * as assert from "assert";
import { formatJsp } from "../formatter";

suite("JSP Formatter Logic Tests", () => {
  const defaultOptions = {
    tabSize: 4,
    insertSpaces: true,
  };

  test("Should format basic HTML", () => {
    const input = "<div>\n<span>Hello</span>\n</div>";
    const expected = "<div>\n    <span>Hello</span>\n</div>\n";
    assert.strictEqual(formatJsp(input, defaultOptions), expected);
  });

  test("Should preserve JSP scriptlets", () => {
    const input =
      "<div>\n<% if (true) { %>\n<span>True</span>\n<% } %>\n</div>";
    // Scriptlets are formatted with proper indentation
    const result = formatJsp(input, defaultOptions);

    // Check that scriptlet Java code is preserved and properly formatted
    assert.ok(
      result.includes("if (true) {"),
      "Should contain the if statement",
    );
    assert.ok(result.includes("}"), "Should contain the closing brace");
    assert.ok(result.includes("<span>True</span>"), "Should contain the span");

    // Check that scriptlet tags are present
    assert.ok(
      result.match(/<%[\s\S]*?if \(true\)[\s\S]*?%>/),
      "Should have scriptlet with if statement",
    );
    assert.ok(
      result.match(/<%[\s\S]*?}[\s\S]*?%>/),
      "Should have scriptlet with closing brace",
    );
  });

  test("Should preserve JSP expressions", () => {
    const input = '<input value="<%= request.getParameter("name") %>" />';
    const result = formatJsp(input, defaultOptions);
    assert.ok(result.includes('<%= request.getParameter("name") %>'));
  });

  test("Should preserve JSP directives", () => {
    const input =
      '<%@ page language="java" contentType="text/html; charset=UTF-8" %>\n<html></html>';
    const result = formatJsp(input, defaultOptions);
    assert.ok(
      result.includes(
        '<%@ page language="java" contentType="text/html; charset=UTF-8" %>',
      ),
    );
  });

  test("Should preserve JSP comments", () => {
    const input = "<%-- This is a comment --%>\n<div></div>";
    const result = formatJsp(input, defaultOptions);
    assert.ok(result.includes("<%-- This is a comment --%>"));
  });

  test("Should handle mixed content correctly", () => {
    const input = `<%@ page import="java.util.*" %>
<html>
<body>
<% 
    Date now = new Date();
%>
    <h1>Current Date: <%= now %></h1>
</body>
</html>`;

    const result = formatJsp(input, defaultOptions);

    // Check for presence of key elements
    assert.ok(result.includes('<%@ page import="java.util.*" %>'));
    assert.ok(result.includes("Date now = new Date();"));
    assert.ok(result.includes("<h1>Current Date: <%= now %></h1>"));

    // Basic indentation check
    const h1Line = result
      .split("\n")
      .find((line: string) => line.trim().startsWith("<h1>"));
    assert.ok(h1Line?.includes("    <h1>"), "H1 should be indented");
  });

  test("Should NOT break JSP expressions in attribute values", () => {
    const input = `<%
  String assetsPath = "/assets/";
%>
<html>
<head>
  <link rel="stylesheet" href="<%=assetsPath%>css/bootstrap.min.css" />
  <link rel="stylesheet" href="<%=assetsPath%>css/style.css" />
  <script src="<%=assetsPath%>js/script.js"></script>
</head>
</html>`;

    const result = formatJsp(input, defaultOptions);

    // The critical check: JSP expressions should NOT be followed by newlines within attribute values
    // Check that href="<%=assetsPath%>css/..." stays on one line
    assert.ok(
      !result.includes('href="<%=assetsPath%>\ncss'),
      "JSP expression should not have newline after it in attribute value",
    );
    assert.ok(
      !result.includes('href="<%=assetsPath%>\n  css'),
      "JSP expression should not have newline after it in attribute value",
    );

    // Verify the correct format is present
    assert.ok(
      result.includes('href="<%=assetsPath%>css/bootstrap.min.css"'),
      "Attribute value should be on single line",
    );
    assert.ok(
      result.includes('href="<%=assetsPath%>css/style.css"'),
      "Attribute value should be on single line",
    );
    assert.ok(
      result.includes('src="<%=assetsPath%>js/script.js"'),
      "Attribute value should be on single line",
    );
  });

  test("Should preserve JSP declarations (<%!)", () => {
    const input = `<%!
    private boolean isDevMode() {
        return true;
    }
%>`;
    const result = formatJsp(input, defaultOptions);

    assert.ok(result.includes("<%!"), "Should contain declaration start tag");
    assert.ok(
      result.includes("private boolean isDevMode() {"),
      "Should contain method declaration",
    );
    assert.ok(result.includes("return true;"), "Should contain method body");
    assert.ok(result.includes("}"), "Should contain closing brace");

    // Ensure it's not mangled into < % !
    assert.ok(
      !result.includes("< % !"),
      "Declaration tag should not be mangled",
    );
  });

  test("Should preserve Java indentation in scriptlets", () => {
    const input = `<%
    String url = request.getRequestURI();
    if (url == null) {
        url = "/";
    }
%>`;
    const result = formatJsp(input, defaultOptions);

    // Check for correct indentation logic (relative indentation preserved)
    // Note: The formatter adds base indentation (4 spaces) to everything inside <% %>
    // Wait, the new logic preserves relative indentation.
    // Let's check that 'url = "/"' is indented more than 'if (url == null)'

    const lines = result.split("\n");
    const ifLine = lines.find((l: string) => l.includes("if (url == null)"));
    const assignmentLine = lines.find(
      (l: string) => l.includes('url="/";') || l.includes('url = "/";'),
    );

    assert.ok(ifLine, "Should enforce if condition");
    assert.ok(assignmentLine, "Should enforce assignment");

    const ifIndent = ifLine?.match(/^\s*/)?.[0].length || 0;
    const assignmentIndent = assignmentLine?.match(/^\s*/)?.[0].length || 0;

    assert.ok(
      assignmentIndent > ifIndent,
      "Assignment should be nested inside if block",
    );
  });

  test("Should handle complex Java logic structures", () => {
    const input = `<%
    try {
        if (true) {
            doSomething();
        }
    } catch (Exception e) {
        e.printStackTrace();
    }
%>`;
    const result = formatJsp(input, defaultOptions);

    const lines = result.split("\n");
    const tryLine = lines.find((l: string) => l.includes("try {"));
    const doLine = lines.find((l: string) => l.includes("doSomething();"));
    const catchLine = lines.find((l: string) =>
      l.includes("} catch (Exception e) {"),
    );

    assert.ok(tryLine, "Should contain try");
    assert.ok(doLine, "Should contain inner method call");
    assert.ok(catchLine, "Should contain catch");

    const tryIndent = tryLine?.match(/^\s*/)?.[0].length || 0;
    const doIndent = doLine?.match(/^\s*/)?.[0].length || 0;

    assert.ok(
      doIndent > tryIndent,
      "Inner method should be indented relative to try",
    );
  });
});
