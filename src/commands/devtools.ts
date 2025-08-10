import * as vscode from 'vscode';
import commandExists from 'command-exists';
import { existsSync } from 'fs';

export interface DevToolsResult {
    gdbAvailable: boolean;
    linkerAvailable: boolean;
    shouldUseModernDebugger: boolean;
}

export async function checkDevTools(): Promise<DevToolsResult> {
    const configs = vscode.workspace.getConfiguration('nasm-tools');
    
    // Check for gdb
    let gdbCommand = configs.get('gdbCommand') as string;
    let gdbAvailable = false;
    
    if (gdbCommand && commandExists.sync(gdbCommand)) {
        gdbAvailable = true;
    } else if (commandExists.sync('gdb')) {
        gdbAvailable = true;
        configs.update('gdbCommand', 'gdb', vscode.ConfigurationTarget.Global);
    }
    
    // Check for i386-elf-ld
    let linkerCommand = configs.get('i386ElfLdCommand') as string;
    let linkerAvailable = false;
    
    if (linkerCommand && commandExists.sync(linkerCommand)) {
        linkerAvailable = true;
    } else if (commandExists.sync('i386-elf-ld')) {
        linkerAvailable = true;
        configs.update('i386ElfLdCommand', 'i386-elf-ld', vscode.ConfigurationTarget.Global);
    }
    
    const shouldUseModernDebugger = configs.get('useModernDebugger') as boolean;
    
    return {
        gdbAvailable,
        linkerAvailable,
        shouldUseModernDebugger: shouldUseModernDebugger && gdbAvailable
    };
}

export async function promptInstallDevTools(): Promise<boolean> {
    const os = process.platform;
    
    if (os !== 'win32') {
        vscode.window.showInformationMessage('GDB and cross-compilation tools installation is platform-specific. Please install manually for your platform.');
        return false;
    }
    
    const choices = [
        'Install GDB and i386-elf tools',
        'Use AFD debugger only',
        'Install manually later'
    ];
    
    const choice = await vscode.window.showInformationMessage(
        'GDB and/or i386-elf-ld are not installed. These tools provide modern debugging capabilities for assembly code.',
        ...choices
    );
    
    if (choice === 'Install GDB and i386-elf tools') {
        return await installDevToolsWindows();
    } else if (choice === 'Use AFD debugger only') {
        // Set preference to use AFD
        vscode.workspace.getConfiguration('nasm-tools').update('useModernDebugger', false, vscode.ConfigurationTarget.Global);
        return true;
    }
    
    return true; // Continue with AFD if user chooses to install manually later
}

async function installDevToolsWindows(): Promise<boolean> {
    const installChoice = await vscode.window.showInformationMessage(
        'Choose installation method for development tools:',
        'Install via MSYS2 (Recommended)',
        'Install GDB only via winget',
        'Manual Installation Guide'
    );
    
    if (installChoice === 'Install via MSYS2 (Recommended)') {
        return await installViaMSYS2();
    } else if (installChoice === 'Install GDB only via winget') {
        return await installGDBViaWinget();
    } else if (installChoice === 'Manual Installation Guide') {
        showManualInstallationGuide();
        return true;
    }
    
    return false;
}

async function installViaMSYS2(): Promise<boolean> {
    // Check if MSYS2 is installed
    const msys2Paths = [
        'C:\\msys64\\usr\\bin\\bash.exe',
        'C:\\tools\\msys64\\usr\\bin\\bash.exe'
    ];
    
    let msys2Path = '';
    for (const path of msys2Paths) {
        try {
            if (existsSync(path)) {
                msys2Path = path;
                break;
            }
        } catch (e) {
            // Continue checking
        }
    }
    
    if (!msys2Path) {
        const installMSYS2 = await vscode.window.showInformationMessage(
            'MSYS2 is not installed. Would you like to install it first?',
            'Yes, install MSYS2',
            'No, use alternative method'
        );
        
        if (installMSYS2 === 'Yes, install MSYS2') {
            const terminal = vscode.window.createTerminal('Install MSYS2');
            terminal.show();
            terminal.sendText('winget install -e --id MSYS2.MSYS2');
            
            vscode.window.showInformationMessage(
                'MSYS2 installation started. After it completes, restart VS Code and try enabling the extension again.'
            );
            return false;
        } else {
            return await installGDBViaWinget();
        }
    }
    
    // Install development tools via MSYS2
    const terminal = vscode.window.createTerminal('Install Dev Tools');
    terminal.show();
    terminal.sendText(`"${msys2Path}" -l -c "pacman -Sy --noconfirm mingw-w64-x86_64-gdb mingw-w64-i686-binutils"`);
    
    // Wait for installation
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Update configuration with MSYS2 paths
    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const msys2BinPath = msys2Path.replace('usr\\bin\\bash.exe', 'mingw64\\bin');
    
    configs.update('gdbCommand', `${msys2BinPath}\\gdb.exe`, vscode.ConfigurationTarget.Global);
    configs.update('i386ElfLdCommand', `${msys2BinPath.replace('mingw64', 'mingw32')}\\i686-w64-mingw32-ld.exe`, vscode.ConfigurationTarget.Global);
    configs.update('useModernDebugger', true, vscode.ConfigurationTarget.Global);
    
    vscode.window.showInformationMessage('Development tools installed successfully!');
    return true;
}

async function installGDBViaWinget(): Promise<boolean> {
    if (!commandExists.sync('winget')) {
        vscode.window.showErrorMessage('Winget is not available. Please install tools manually.');
        return false;
    }
    
    const terminal = vscode.window.createTerminal('Install GDB');
    terminal.show();
    terminal.sendText('winget install -e --id GNU.GDB');
    
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    // Check if GDB is now available
    if (commandExists.sync('gdb')) {
        const configs = vscode.workspace.getConfiguration('nasm-tools');
        configs.update('gdbCommand', 'gdb', vscode.ConfigurationTarget.Global);
        configs.update('useModernDebugger', true, vscode.ConfigurationTarget.Global);
        
        vscode.window.showInformationMessage('GDB installed successfully! Note: i386-elf-ld is not available, some advanced features may be limited.');
        return true;
    } else {
        vscode.window.showErrorMessage('GDB installation failed or is not in PATH.');
        return false;
    }
}

function showManualInstallationGuide(): void {
    const message = `
Manual Installation Guide:

1. For GDB:
   - Install via winget: winget install GNU.GDB
   - Or download from: https://www.gnu.org/software/gdb/

2. For i386-elf cross-compilation tools:
   - Install MSYS2 from https://www.msys2.org/
   - Run: pacman -S mingw-w64-i686-binutils
   - Add MSYS2 bin directory to PATH

3. Alternative: Install a complete cross-compilation toolchain
   - Consider installing a pre-built toolchain for i386-elf

After installation, restart VS Code and enable the extension again.
    `;
    
    vscode.window.showInformationMessage(message, 'Open MSYS2 Website', 'Open GDB Website')
        .then(selection => {
            if (selection === 'Open MSYS2 Website') {
                vscode.env.openExternal(vscode.Uri.parse('https://www.msys2.org/'));
            } else if (selection === 'Open GDB Website') {
                vscode.env.openExternal(vscode.Uri.parse('https://www.gnu.org/software/gdb/'));
            }
        });
} 