import * as assert from "assert";
import { formatJsp } from "../formatter";

suite("JSP Formatter Logic Tests", () => {
  const defaultOptions = {
    tabSize: 4,
    insertSpaces: true,
  };

  test("Should format basic HTML", async () => {
    const input = "<div>\n<span>Hello</span>\n</div>";
    const expected = "<div>\n    <span>Hello</span>\n</div>\n";
    assert.strictEqual(await formatJsp(input, defaultOptions), expected);
  });

  test("Should preserve JSP scriptlets", async () => {
    const input =
      "<div>\n<% if (true) { %>\n<span>True</span>\n<% } %>\n</div>";
    const result = await formatJsp(input, defaultOptions);

    assert.ok(
      result.includes("if (true) {"),
      "Should contain the if statement",
    );
    assert.ok(result.includes("}"), "Should contain the closing brace");
    assert.ok(result.includes("<span>True</span>"), "Should contain the span");
    assert.ok(
      result.match(/<%[\s\S]*?if \(true\)[\s\S]*?%>/),
      "Should have scriptlet with if statement",
    );
    assert.ok(
      result.match(/<%[\s\S]*?}[\s\S]*?%>/),
      "Should have scriptlet with closing brace",
    );
  });

  test("Should preserve JSP expressions", async () => {
    const input = '<input value="<%= request.getParameter("name") %>" />';
    const result = await formatJsp(input, defaultOptions);
    assert.ok(result.includes('<%= request.getParameter("name") %>'));
  });

  test("Should preserve JSP directives", async () => {
    const input =
      '<%@ page language="java" contentType="text/html; charset=UTF-8" %>\n<html></html>';
    const result = await formatJsp(input, defaultOptions);
    assert.ok(
      result.includes(
        '<%@ page language="java" contentType="text/html; charset=UTF-8" %>',
      ),
    );
  });

  test("Should preserve JSP comments", async () => {
    const input = "<%-- This is a comment --%>\n<div></div>";
    const result = await formatJsp(input, defaultOptions);
    assert.ok(result.includes("<%-- This is a comment --%>"));
  });

  test("Should handle mixed content correctly", async () => {
    const input = `<%@ page import="java.util.*" %>
<html>
<body>
<% 
    Date now = new Date();
%>
    <h1>Current Date: <%= now %></h1>
</body>
</html>`;

    const result = await formatJsp(input, defaultOptions);

    assert.ok(result.includes('<%@ page import="java.util.*" %>'));
    assert.ok(result.includes("Date now = new Date();"));
    assert.ok(result.includes("<h1>Current Date: <%= now %></h1>"));

    const h1Line = result
      .split("\n")
      .find((line: string) => line.trim().startsWith("<h1>"));
    assert.ok(h1Line?.includes("    <h1>"), "H1 should be indented");
  });

  test("Should NOT break JSP expressions in attribute values", async () => {
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

    const result = await formatJsp(input, defaultOptions);

    assert.ok(
      !result.includes('href="<%=assetsPath%>\ncss'),
      "JSP expression should not have newline after it in attribute value",
    );
    assert.ok(
      !result.includes('href="<%=assetsPath%>\n  css'),
      "JSP expression should not have newline after it in attribute value",
    );
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

  test("Should preserve JSP declarations (<%!)", async () => {
    const input = `<%!
    private boolean isDevMode() {
        return true;
    }
%>`;
    const result = await formatJsp(input, defaultOptions);

    assert.ok(result.includes("<%!"), "Should contain declaration start tag");
    assert.ok(
      result.includes("private boolean isDevMode() {"),
      "Should contain method declaration",
    );
    assert.ok(result.includes("return true;"), "Should contain method body");
    assert.ok(result.includes("}"), "Should contain closing brace");
    assert.ok(
      !result.includes("< % !"),
      "Declaration tag should not be mangled",
    );
  });

  test("Should preserve Java indentation in scriptlets", async () => {
    const input = `<%
    String url = request.getRequestURI();
    if (url == null) {
        url = "/";
    }
%>`;
    const result = await formatJsp(input, defaultOptions);

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

  test("Should handle complex Java logic structures", async () => {
    const input = `<%
    try {
        if (true) {
            doSomething();
        }
    } catch (Exception e) {
        e.printStackTrace();
    }
%>`;
    const result = await formatJsp(input, defaultOptions);

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

  test("Should preserve JSP declaration with complete method (error.jsp scenario)", async () => {
    const input = `<%@ page language="java" pageEncoding="UTF-8" %>
<%@ page import="org.apache.struts2.StrutsConstants" %>
<%!
    private boolean isDevMode() {
        try {
            Dispatcher dispatcher = Dispatcher.getInstance();
            if (dispatcher != null && dispatcher.getContainer() != null) {
                String devModeStr = dispatcher.getContainer().getInstance(String.class, StrutsConstants.STRUTS_DEVMODE);
                return "true".equalsIgnoreCase(devModeStr);
            }
        } catch (Exception e) {
            // 無法取得時預設為 false
        }
        return false;
    }
%>
<html></html>`;

    const result = await formatJsp(input, defaultOptions);

    assert.ok(result.includes("<%!"), "Declaration tag <%! must be preserved");
    assert.ok(
      !result.includes("<%\n    !"),
      "Declaration tag must NOT be split into <% and !",
    );
    assert.ok(
      result.includes("private boolean isDevMode()"),
      "Method signature must be preserved",
    );
    assert.ok(result.includes("try {"), "Try block must be preserved");
    assert.ok(
      result.includes("} catch (Exception e) {"),
      "Catch block must be preserved",
    );
    assert.ok(
      result.includes("return false;"),
      "Return statement must be preserved",
    );
    assert.ok(
      result.includes(
        "if (dispatcher != null && dispatcher.getContainer() != null)",
      ),
      "Nested if condition must be preserved",
    );
  });

  test("Should preserve scriptlet with complex control flow (error.jsp scenario)", async () => {
    const input = `<%
    String requestedUrl = (String) request.getAttribute("jakarta.servlet.forward.request_uri");
    if (requestedUrl == null) {
        requestedUrl = request.getRequestURI();
    }
    pageContext.setAttribute("requestedUrl", requestedUrl);
    if (!isDevMode()) {
        response.sendRedirect(request.getContextPath() + "/error.html");
        return;
    }
%>`;

    const result = await formatJsp(input, defaultOptions);
    const lines = result.split("\n");

    assert.ok(
      lines.length > 10,
      "Scriptlet should NOT be compressed to single line",
    );
    assert.ok(
      result.includes(
        'String requestedUrl = (String) request.getAttribute("jakarta.servlet.forward.request_uri");',
      ),
      "Variable declaration must be preserved",
    );
    // Indentation checks
    const ifDevModeLine = lines.find((l: string) =>
      l.includes("if (!isDevMode())"),
    );
    const sendRedirectLine = lines.find((l: string) =>
      l.includes("response.sendRedirect"),
    );
    const ifIndent = ifDevModeLine?.match(/^\s*/)?.[0].length || 0;
    const redirectIndent = sendRedirectLine?.match(/^\s*/)?.[0].length || 0;
    assert.ok(
      redirectIndent > ifIndent,
      "sendRedirect should be indented inside if block",
    );
  });

  test("Should handle full error.jsp with declaration and scriptlet together", async () => {
    const input = `<%@ page language="java" pageEncoding="UTF-8" %>
<%@ page import="org.apache.struts2.StrutsConstants" %>
<%@ page import="org.apache.struts2.dispatcher.Dispatcher" %>
<%!
    private boolean isDevMode() {
        return true;
    }
%>
<%
    String url = request.getRequestURI();
    if (url == null) {
        url = "/";
    }
%>
<!DOCTYPE html>
<html>
<head><title>Error</title></head>
<body>
    <h1>404 Not Found</h1>
</body>
</html>`;

    const result = await formatJsp(input, defaultOptions);
    assert.ok(
      result.includes('<%@ page language="java" pageEncoding="UTF-8" %>'),
    );
    assert.ok(result.includes("<%!"));
    assert.strictEqual((result.match(/<%!/g) || []).length, 1);
    assert.strictEqual((result.match(/<%\n/g) || []).length, 1);
  });

  test("REGRESSION: <%! must NEVER be split into <% !", async () => {
    const input = `<%!
    private void myMethod() {
        System.out.println("test");
    }
%>`;
    const result = await formatJsp(input, defaultOptions);
    assert.ok(!result.includes("<% !"));
    assert.ok(result.includes("<%!"));
  });

  test("REGRESSION: Multiline Java code must NOT be compressed to single line", async () => {
    const input = `<%
    String url = request.getRequestURI();
    if (url == null) {
        url = "/";
    }
    return url;
%>`;
    const result = await formatJsp(input, defaultOptions);
    const scriptletMatch = result.match(/<%[\s\S]*?%>/);
    assert.ok(scriptletMatch);
    const lines = scriptletMatch[0].split("\n").filter((l) => l.trim() !== "");
    assert.ok(lines.length >= 5);
  });

  test("REGRESSION: Full error.jsp structure must format correctly", async () => {
    const input = `<%@ page language="java" pageEncoding="UTF-8" %>
<%@ page import="org.apache.struts2.StrutsConstants" %>
<%@ page import="org.apache.struts2.dispatcher.Dispatcher" %>
<%!
    private boolean isDevMode() {
        try {
            Dispatcher dispatcher = Dispatcher.getInstance();
            if (dispatcher != null && dispatcher.getContainer() != null) {
                String devModeStr = dispatcher.getContainer().getInstance(String.class, StrutsConstants.STRUTS_DEVMODE);
                return "true".equalsIgnoreCase(devModeStr);
            }
        } catch (Exception e) {
            // 無法取得時預設為 false
        }
        return false;
    }
%>
<%
    String requestedUrl = (String) request.getAttribute("jakarta.servlet.forward.request_uri");
    if (requestedUrl == null) {
        requestedUrl = request.getRequestURI();
    }
    pageContext.setAttribute("requestedUrl", requestedUrl);
    if (!isDevMode()) {
        response.sendRedirect(request.getContextPath() + "/error.html");
        return;
    }
%>
<!DOCTYPE html>
<html lang="zh-Hant">
<head>
    <meta charset="UTF-8">
    <title>頁面不存在 - 開發模式</title>
</head>
<body>
    <h1>404 Not Found</h1>
</body>
</html>`;
    const result = await formatJsp(input, defaultOptions);
    assert.ok(!result.includes("<% !"));
    assert.ok(result.includes("private boolean isDevMode()"));
    assert.ok(result.includes("try {"));
  });

  test("Should normalize JSP tags (e.g., <% ! -> <%!) and format Declarations", async () => {
    const input = `
    <%
       !   
       private boolean test() {
       return true;
       }
    %>
    `;
    const result = await formatJsp(input, defaultOptions);
    assert.ok(result.includes("<%!"));
    // Indentation check
    const lines = result.split("\n");
    const methodLine = lines.find((l) =>
      l.trim().startsWith("private boolean"),
    );
    assert.ok(methodLine?.startsWith("    "));
  });

  // === Prettier Integration Tests ===

  test("Should SMARTLY FIX and FORMAT broken single-line Java code (e.g. comment eating braces)", async () => {
    // 模擬 error_v2.jsp 的壞代碼：單行註解把 closing brace 吃掉了
    // 必須使用合法的 Java (catch(Exception e))
    const input = `<%!
    private void test() { try { } catch(Exception e) { // comment } }
%>`;
    const result = await formatJsp(input, defaultOptions);

    // 1. 註解被轉換為 block comment
    assert.ok(
      result.includes("/*") && result.includes("*/"),
      "Should convert line comment to block comment",
    );

    // 2. 代碼被展開 (不再是單行)
    const declMatch = result.match(/<%![\s\S]*?%>/)?.[0] || "";
    const lines = declMatch.split("\n").filter((l) => l.trim() !== "");

    // class Dummy { ... } 展開後會有與多行
    assert.ok(
      lines.length > 5,
      `Expected code to be expanded by Prettier, but got ${lines.length} lines. Content: ${declMatch}`,
    );

    // 3. 驗證結構正確性
    assert.ok(
      result.includes("catch (Exception e) {"),
      "Should format catch block correctly",
    );
  });

  test("Should use Prettier to FORMAT valid single-line Java code", async () => {
    const input = `<%!
    private void test() { try { if(true) { return; } } catch(Exception e) { } }
%>`;
    const result = await formatJsp(input, defaultOptions);

    const declMatch = result.match(/<%![\s\S]*?%>/)?.[0] || "";
    const lines = declMatch.split("\n").filter((l) => l.trim() !== "");
    assert.ok(lines.length > 5, "Expected code to be expanded");
    assert.ok(
      result.includes("catch (Exception e) {"),
      "Should have space after catch",
    );
  });
});
