import * as vscode from 'vscode';
import { assemble } from "./assemble";
import { dirname, join } from 'path';
import { checkDevTools } from './devtools';
import commandExists from 'command-exists';

export async function run(debugMode = false) {
    if (!await assemble("runner")) {
        return false;
    }

    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const dosboxCommand = configs.get('dosboxCommand');

    const editor = vscode.window.activeTextEditor;

    let document = editor!.document;
    const fileDir = dirname(document.fileName);
    const fileBaseNameWithoutExt = "runner";

    if (debugMode) {
        // Check if modern debugging tools are available and enabled
        const devToolsResult = await checkDevTools();
        
        if (devToolsResult.shouldUseModernDebugger && devToolsResult.gdbAvailable) {
            return await runWithGDB(fileDir, fileBaseNameWithoutExt);
        } else {
            // Fallback to AFD debugger
            return await runWithAFD(dosboxCommand as string, fileDir, fileBaseNameWithoutExt);
        }
    } else {
        vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
            "-c", `MOUNT C "${fileDir}"`,
            "-c", "C:",
            "-c", `${fileBaseNameWithoutExt}.com`
        ]);
    }
    return true;
}

async function runWithGDB(fileDir: string, fileBaseNameWithoutExt: string): Promise<boolean> {
    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const gdbCommand = configs.get('gdbCommand') as string;
    
    // Create a simple GDB script for debugging the COM file
    const gdbScript = `
# GDB script for debugging ${fileBaseNameWithoutExt}.com
file ${fileBaseNameWithoutExt}.com
set architecture i8086
target remote | qemu-system-i386 -gdb stdio -S -nographic -drive format=raw,file=${fileBaseNameWithoutExt}.com
break _start
continue
    `.trim();
    
    // Check if QEMU is available for emulation
    if (!commandExists.sync('qemu-system-i386')) {
        vscode.window.showWarningMessage(
            'QEMU is not available. GDB debugging requires QEMU for emulation. Falling back to AFD debugger.',
            'Install QEMU', 'Continue with AFD'
        ).then(choice => {
            if (choice === 'Install QEMU') {
                vscode.env.openExternal(vscode.Uri.parse('https://www.qemu.org/download/'));
            }
        });
        
        // Fallback to AFD
        const dosboxCommand = configs.get('dosboxCommand') as string;
        return await runWithAFD(dosboxCommand, fileDir, fileBaseNameWithoutExt);
    }
    
    // Create GDB terminal with script
    const terminal = vscode.window.createTerminal('GDB Debug');
    terminal.show();
    terminal.sendText(`cd "${fileDir}"`);
    terminal.sendText(`echo '${gdbScript}' > debug.gdb`);
    terminal.sendText(`${gdbCommand} -x debug.gdb`);
    
    vscode.window.showInformationMessage('Started GDB debugging session. Use GDB commands to debug your assembly code.');
    return true;
}

async function runWithAFD(dosboxCommand: string, fileDir: string, fileBaseNameWithoutExt: string): Promise<boolean> {
    const path = join(vscode.extensions.getExtension("nottahaali.nasm-tools")!.extensionPath, "public");
    vscode.window.createTerminal('DOSBOX (AFD Debug)', dosboxCommand, [
        "-c", `MOUNT C "${fileDir}"`,
        "-c", "C:",
        "-c", `MOUNT A "${path}"`,
        "-c", `A:\\AFD ${fileBaseNameWithoutExt}.com`
    ]);
    return true;
}