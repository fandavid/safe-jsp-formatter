# Change Log

All notable changes to the "safe-jsp-formatter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.1.2] - 2026-01-30

### Verified
- Confirmed full Google Java Style formatting works correctly for valid Java code in `<%! ... %>` declarations.
- Single-line compressed Java code is now properly expanded into readable multi-line format.

## [0.1.1] - 2026-01-30

### Improved
- Added smart heuristic to automatically fix "broken" single-line Java code where line comments (`//`) accidentally comment out closing braces. The formatter now converts these to block comments (`/* ... */`) on the fly, enabling successful formatting of previously unformattable legacy code.

## [0.1.0] - 2026-01-30

### Fixed
- Fixed critical issue where `prettier-plugin-java` was not resolving correctly in the packaged extension, causing formatting to fail silently and fallback to safe mode.
- Corrected the plugin loading mechanism to handle both CommonJS and ESM export structures (`javaPlugin.default || javaPlugin`).

## [0.0.9] - 2026-01-30

### Added
- Integrated **Prettier** with **Java Plugin** to provide full Google Java Style formatting for JSP code blocks via a hybrid mode.
- Complete blocks (like methods in `<%! ... %>` or full statements in `<% ... %>`) are now reformatted, reflowed, and styled according to Google Java Style conventions.
- Fragmented or incomplete code blocks (e.g. `<% } else { %>`) automatically fallback to the safe, indentation-only mode.

## [0.0.8] - 2026-01-30

### Added
- Added automatic normalization for non-standard JSP tags. For example, `<% !` is now automatically fixed to `<%!`, `<% =` to `<%=`, and `<% @` to `<%@`.
- Enabled formatting support for JSP Declarations (`<%!`). Previously, declarations were ignored to ensure safety, but now they benefit from indentation correction while preserving structure.

## [0.0.7] - 2026-01-30

### Fixed
- Fixed a critical bug where the "attribute spacing fix" logic was incorrectly modifying Java code inside scriptlets (e.g., changing `String s = "val"` to `String s="val"`). This regex has been removed to ensure Java code integrity.

## [0.0.6] - 2026-01-30

### Added
- Added comprehensive regression tests to prevent `<%!` from being incorrectly split into `<% !`.
- Added regression tests to ensure multiline Java code is never compressed into a single line.
- Added full `error.jsp` integration test covering declarations, scriptlets, and HTML together.

### Fixed
- Fixed eslint curly brace warning in formatter.ts.

## [0.0.3] - 2026-01-30

### Fixed
- Fixed an issue where JSP declarations `<%!` were being incorrectly formatted as scriptlets.
- Fixed an issue where multiline Java code inside scriptlets was being compressed into a single line.
- Fixed indentation behavior to preserve relative indentation of Java code blocks (e.g., inside `if` or `try/catch` blocks).

## [0.0.2] - 2026-01-22

- Initial release