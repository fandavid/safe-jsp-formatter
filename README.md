# Safe JSP Formatter

A Visual Studio Code extension that provides **non-destructive** formatting for JSP (Java Server Pages) files.

[![Visual Studio Marketplace Version](https://img.shields.io/visual-studio-marketplace/v/your-publisher.safe-jsp-formatter)](https://marketplace.visualstudio.com/items?itemName=your-publisher.safe-jsp-formatter)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)

## 🎯 Features

Traditional HTML formatters often break JSP special tags (like Scriptlets `<% ... %>`, Expressions `<%= ... %>`, etc.). This extension uses a special placeholder mechanism to ensure JSP syntax is completely preserved while formatting the HTML structure.

**Key Features:**
- ✅ **Preserves all JSP tags** - Directives, scriptlets, expressions, and comments remain intact
- ✅ **Formats Java code** - Scriptlet content gets proper indentation and formatting
- ✅ **No attribute value breaks** - JSP expressions in HTML attributes stay on the same line
- ✅ **Clean HTML structure** - Proper indentation for HTML elements
- ✅ **Idempotent formatting** - Multiple format passes produce consistent results
- ✅ **Zero configuration** - Works out of the box

## 📦 Installation

### From VSIX file
1. Download the latest `.vsix` file from the [Releases](https://github.com/your-username/safe-jsp-formatter/releases) page
2. Open VS Code
3. Go to Extensions view (`Ctrl+Shift+X` / `Cmd+Shift+X`)
4. Click on the "..." menu at the top right
5. Select "Install from VSIX..."
6. Choose the downloaded `.vsix` file

### From VS Code Marketplace (coming soon)
Search for "Safe JSP Formatter" in the VS Code Extensions marketplace.

## 🚀 Usage

1. Open any `.jsp`, `.jspf`, or `.jspx` file
2. Format the document using one of these methods:
   - **Right-click** → Select "Format Document"
   - **Keyboard shortcut**:
     - Windows/Linux: `Shift+Alt+F`
     - Mac: `Shift+Option+F`
   - **Command Palette**: `Format Document`

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

## 🛠️ Development

### Prerequisites
- Node.js (v18 or later)
- npm

### Setup
```bash
git clone https://github.com/your-username/safe-jsp-formatter.git
cd safe-jsp-formatter
npm install
```

### Commands
```bash
npm run compile     # Compile TypeScript
npm run watch       # Watch mode for development
npm test            # Run tests
npm run package     # Build production bundle
```

### Testing
Press `F5` in VS Code to launch the Extension Development Host and test the extension.

## 🐛 Known Issues

None currently. Please report any issues on the [GitHub Issues](https://github.com/your-username/safe-jsp-formatter/issues) page.

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🤝 Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📝 Release Notes

### 0.0.1 (2026-01-13)

Initial release of Safe JSP Formatter:
- ✅ Non-destructive JSP formatting
- ✅ Java code formatting in scriptlets with proper indentation
- ✅ Prevents line breaks in JSP expressions within attribute values
- ✅ HTML structure formatting with correct indentation
- ✅ Preserves all JSP directives, expressions, scriptlets, and comments
- ✅ Idempotent formatting (consistent results on multiple passes)

## 🙏 Acknowledgments

- Built with [js-beautify](https://github.com/beautify-web/js-beautify) for HTML and JavaScript formatting
- Developed using the [VS Code Extension API](https://code.visualstudio.com/api)

---

**Enjoy formatting your JSP files!** 🎉

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
