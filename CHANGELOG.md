# Change Log

## 1.0.0
- Initial release

## 1.0.1
### Docs
- Added Known Issues to README.md

## 1.0.2
### Fixes
- Fixed Extension not working with Command Prompt (Removed any windows shell dependency)
### Docs
- Updated Known Issues in README.md

## 1.0.3
### Fixes
- Fixed Long Names and Names with Spaces not Working
### Docs
- Updated Known Issues in README.md

## 1.0.4
### Refactor
- Changed Delete to use unlinkSync instead of shell commands to remove shell dependency.

## 1.1.0
### Features
- Linux and MacOS can now use the extension (No Auto install available)
### Fix
- Fixed Install with Winget Option showing even if no winget.
### Docs
- Fixed Docs that were reverted due to previous linking.

## 1.1.1
### Docs
- Changed 1.1.5 to 1.1.0 in README.md

## 1.1.2
### Fix
- Fixed Run and Debug not working on linux due to incorrect path calculation