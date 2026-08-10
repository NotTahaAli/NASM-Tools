# NASM Tools By Muhammad Taha Ali

[Github Repo](https://github.com/NotTahaAli/NASM-Tools)
[VSCode Extension](https://marketplace.visualstudio.com/items?itemName=nottahaali.nasm-tools)

## Features

- Automatically Install NASM and DOSBOX-X
- Command and Keybind (Ctrl + Shift + B) to Assemble NASM file.
- Command and Keybind (Ctrl + Alt + D) to Open DOSBOX.
- Command and Keybind (F5) to Assemble and Run NASM file.
- Command and Keybind (Ctrl+F5) to Assemble and Debug NASM file using AFD.

## Known Issues
- Install Option for MAC Available only if Homebrew Installed [#6](https://github.com/NotTahaAli/NASM-Tools/issues/6)

## Requirements

- [NASM](https://www.nasm.us/) — must be on your PATH.
- [DOSBox](https://www.dosbox.com/) or [DOSBox-X](https://dosbox-x.com/) — must be on your PATH.

If either is missing, the extension offers to install them for you (winget on Windows; pacman, apt, yum, dnf, or brew on Linux/macOS, whichever is detected). Otherwise, install and add them to your PATH manually.

Also required: the [NASM Language Support](https://marketplace.visualstudio.com/items?itemName=doinkythederp.nasm-language-support) extension (installed automatically as a dependency) for assembly error validation.

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
#### Fix
- Fixed Extension not working with Command Prompt (Removed any windows shell dependency)
#### Docs
- Updated Known Issues in README.md

### 1.0.3
#### Fix
- Fixed Long Names and Names with Spaces not Working
#### Docs
- Updated Known Issues in README.md

### 1.0.4
#### Refactor
- Changed Delete to use unlinkSync instead of shell commands to remove shell dependency.

### 1.1.0
#### Features
- Linux and MacOS can now use the extension (No Auto install available)
#### Fix
- Fixed Install with Winget Option showing even if no winget.
#### Docs
- Fixed Docs that were reverted due to previous linking.

### 1.1.1
#### Docs
- Changed 1.1.5 to 1.1.0 in README.md

### 1.1.2
#### Fix
- Fixed Run and Debug not working on linux due to incorrect path calculation

### 1.1.3
#### Fix
- Fixed Extension not working with older versions. Now Works Back to 1.46.0

### 1.2.0
#### Fix
- Fixed Extension bypassing command check if nasm or dosbox were uninstalled after being installed.
#### Features
- Added support for the following package managers (mainly linux)
  - pacman
  - apt
  - yum
  - dnf
  - brew

### 1.3.0
#### Features
- Added Dependancy [NASM Language Support](https://marketplace.visualstudio.com/items?itemName=doinkythederp.nasm-language-support) for Assembly Error Validation