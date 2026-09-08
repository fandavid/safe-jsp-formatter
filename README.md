# Safe JSP Formatter

A Visual Studio Code extension providing **non-destructive** formatting for JSP (Java Server Pages) files.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/davidfan.safe-jsp-formatter)](https://marketplace.visualstudio.com/items?itemName=davidfan.safe-jsp-formatter)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Why Safe JSP Formatter?

Traditional HTML formatters often break JSP-specific tags (like Scriptlets `<% ... %>`, Expressions `<%= ... %>`, etc.), leading to broken code or messy indentation.

This extension uses a specialized **placeholder mechanism** to ensure JSP syntax is perfectly preserved while beautifying both the HTML structure and the Java code within scriptlets.

### ✨ Key Features
- ✅ **Preserves JSP Tags & EL Expressions** - Directives, declarations (`<%!`), scriptlets, expressions (`<%=`), comments (`<%--`), and EL expressions (`${...}`) remain completely intact.
- ✅ **Context-Aware Lexer** - Robust syntax scanning that handles string literals containing `%>` (e.g. `String s = "test %> test";`) without tag truncation.
- ✅ **Beautifies Java Code** - Java code inside scriptlets and declarations is formatted with Google Java Style (Prettier), with a graceful fallback to safe indentation mode for incomplete or legacy code.
- ✅ **Safe Comment Handling** - Automatically isolates trailing braces from single-line comments so legacy squashed code formats cleanly.
- ✅ **Prevents Attribute Breaks** - Ensures JSP expressions and EL expressions inside HTML attributes preserve exact spacing and stay intact.
- ✅ **Clean HTML Structure & Proper Alignment** - Precise indentation for HTML elements, with nested JSP tags and closing `%>` aligned to surrounding HTML.
- ✅ **Configurable** - Works out of the box with sensible defaults, while offering granular settings to customize Java and HTML formatting.

## 🚀 Usage

1. Open any `.jsp`, `.jspf`, or `.jspx` file.
2. Format the document using one of these methods:
   - **Right-click** → Select "Format Document".
   - **Keyboard Shortcut**:
     - Windows/Linux: `Shift+Alt+F`
     - Mac: `Shift+Option+F`
   - **Command Palette**: Type `Format Document`.

## 📝 Example

**Before formatting:**
```jsp
<%@ page language="java" import="java.util.*" pageEncoding="UTF-8"%> <%@ page import="tw.gov.sipa.domain.SSOUser" %> <% String path = request.getContextPath(); String assetsPath = path + "/resources/assets/"; %>
<html><head><link rel="stylesheet" href="<%=assetsPath%>css/bootstrap.min.css" /></head></html>
```

**After formatting:**
```jsp
<%@ page language="java" import="java.util.*" pageEncoding="UTF-8"%>
<%@ page import="tw.gov.sipa.domain.SSOUser" %>
<%
  String path = request.getContextPath();
  String assetsPath = path + "/resources/assets/";
%>
<html>
  <head>
    <link rel="stylesheet" href="<%=assetsPath%>css/bootstrap.min.css" />
  </head>
</html>
```

## ⚙️ Extension Settings

This extension contributes the following settings:

- `safeJspFormatter.enableJavaFormatting`: Enable Prettier Google Java Style formatting inside JSP scriptlets and declarations (default: `true`).
- `safeJspFormatter.enableHtmlFormatting`: Enable HTML structure beautification via `js-beautify` (default: `true`).
- `safeJspFormatter.printWidth`: Maximum line width for formatted Java code inside JSP (default: `100`).
- `safeJspFormatter.htmlOptions`: Custom options object passed directly to `js-beautify` (default: `{}`).

## 🔧 Supported File Types
- `.jsp` - Java Server Pages
- `.jspf` - JSP Fragments
- `.jspx` - JSP XML

## 🐛 Issues & Feedback

If you encounter any issues or have suggestions, please report them on the [GitHub Issues](https://github.com/davidfan/safe-jsp-formatter/issues) page.

## 📄 License

This project is licensed under the [MIT License](LICENSE).

---

**Happy Coding!** 🎉
