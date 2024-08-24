# NASM Tools By Muhammad Taha Ali

[Github Repo](https://github.com/NotTahaAli/NASM-Tools)
[VSCode Extension](https://marketplace.visualstudio.com/items?itemName=nottahaali.nasm-tools)

## Features

- Automatically Install NASM and DOSBOX-X (Windows Only using Winget)
- Command and Keybind (Ctrl + Shift + B) to Assemble NASM file.
- Command and Keybind (Ctrl + Alt + D) to Open DOSBOX.
- Command and Keybind (F5) to Assemble and Run NASM file.
- Command and Keybind (Ctrl+F5) to Assemble and Debug NASM file using AFD.

## Known Issues
- Install Option available for Windows Only [#4](https://github.com/NotTahaAli/NASM-Tools/issues/4) and [#6](https://github.com/NotTahaAli/NASM-Tools/issues/6)

## Requirements

If you have any requirements or dependencies, add a section describing those and how to install and configure them.

- NASM Required
- DOSBOX or DOSBOX-X Required
  The Above Dependencies need to be added to Path. If you do not have these installed, you will get a popup with the opiton to download from winget.

## Extension Settings

This extension contributes the following settings:

- `nasm-tools.dosboxCommand`: Command to Run DOSBOX or DOSBOX-X (e.g. dosbox or dosbox-x if in PATH)
- `nasm-tools.nasmCommand`: Command to Run NASM (e.g. nasm if in PATH)

## Release Notes

### 1.0.0
- Initial release of NASM Tools

### 1.0.1
#### Docs
- Added Known Issues to README.md

### 1.0.2
#### Fixes
- Fixed Extension not working with Command Prompt (Removed any windows shell dependency)
#### Docs
- Updated Known Issues in README.md

### 1.0.3
#### Fixes
- Fixed Long Names and Names with Spaces not Working
#### Docs
- Updated Known Issues in README.md

### 1.0.4
#### Refactor
- Changed Delete to use unlinkSync instead of shell commands to remove shell dependency.

## 1.1.0
### Features
- Linux and MacOS can now use the extension (No Auto install available)
### Fix
- Fixed Install with Winget Option showing even if no winget.
### Docs
- Fixed Docs that were reverted due to previous linking.