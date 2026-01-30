# Change Log

All notable changes to the "safe-jsp-formatter" extension will be documented in this file.

Check [Keep a Changelog](http://keepachangelog.com/) for recommendations on how to structure this file.

## [0.0.3] - 2026-01-30

### Fixed
- Fixed an issue where JSP declarations `<%!` were being incorrectly formatted as scriptlets.
- Fixed an issue where multiline Java code inside scriptlets was being compressed into a single line.
- Fixed indentation behavior to preserve relative indentation of Java code blocks (e.g., inside `if` or `try/catch` blocks).

## [0.0.2] - 2026-01-22

- Initial release