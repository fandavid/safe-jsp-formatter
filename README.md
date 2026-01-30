# Safe JSP Formatter

A Visual Studio Code extension providing **non-destructive** formatting for JSP (Java Server Pages) files.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/davidfan.safe-jsp-formatter)](https://marketplace.visualstudio.com/items?itemName=davidfan.safe-jsp-formatter)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Why Safe JSP Formatter?

Traditional HTML formatters often break JSP-specific tags (like Scriptlets `<% ... %>`, Expressions `<%= ... %>`, etc.), leading to broken code or messy indentation.

This extension uses a specialized **placeholder mechanism** to ensure JSP syntax is perfectly preserved while beautifying both the HTML structure and the Java code within scriptlets.

### ✨ Key Features
- ✅ **Preserves JSP Tags** - Directives, declarations (`<%!`), scriptlets, expressions, and comments remain completely intact.
- ✅ **Beautifies Java Code** - Java code inside scriptlets is automatically indented and formatted (Declarations are kept untouched).
- ✅ **Prevents Attribute Breaks** - Ensures JSP expressions inside HTML attributes stay on the same line.
- ✅ **Clean HTML Structure** - Provides precise indentation for HTML elements.
- ✅ **Idempotent** - Multiple formatting passes produce consistent results.
- ✅ **Zero Configuration** - Works perfectly out of the box.

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
