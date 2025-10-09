import * as vscode from 'vscode';
import { assemble } from "./assemble";
import { dirname, join } from 'path';
import { existsSync } from 'fs';
import { DebugWebViewProvider } from '../views/debugWebView';
import { ToolchainManager } from '../managers/toolchainManager';

export async function run(debugMode = false, debugViewProvider?: DebugWebViewProvider, context?: vscode.ExtensionContext) {

    // pass debug mode to assemble function and generate elf file for debugging if gdb
    if (!await assemble("runner", debugMode, context)) {
        return false;
    }

    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const dosboxCommand = configs.get('dosboxCommand');

    const editor = vscode.window.activeTextEditor;

    let document = editor!.document;
    const fileDir = dirname(document.fileName);
    const fileBaseNameWithoutExt = "runner";

    if (debugMode) {
        const path = join(vscode.extensions.getExtension("nottahaali.nasm-tools")!.extensionPath, "public");
        const debuggerType = configs.get('debuggerType') || 'afd';
        const debuggerPort = configs.get('debuggerPort') || 1111;

        if (debuggerType === 'gdb') {
            // Check if ELF file exists (created by assemble function)
            const elfPath = join(fileDir, `${fileBaseNameWithoutExt}.elf`);
            if (!existsSync(elfPath)) {
                vscode.window.showErrorMessage('ELF file not found. GDB debugging requires ELF file creation.');
                return false;
            }

            // Validate GDB availability
            if (context) {
                const toolchain = new ToolchainManager(context);
                const gdbAvailable = await toolchain.isGdbAvailable();
                
                if (!gdbAvailable) {
                    const choice = await vscode.window.showErrorMessage(
                        'GDB not found in system PATH. Would you like to switch to AFD debugger?',
                        'Use AFD Debugger',
                        'Cancel'
                    );
                    
                    if (choice === 'Use AFD Debugger') {
                        // Switch to AFD debugger for this session and update configuration
                        await vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
                        vscode.window.showInformationMessage('Debugger type changed to AFD. Continuing with AFD debugger...');
                        
                        // Continue with AFD debugger by falling through to the else block
                        vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
                            "-c", `MOUNT C "${fileDir}"`,
                            "-c", "C:",
                            "-c", `MOUNT A "${path}"`,
                            "-c", `A:\\AFD ${fileBaseNameWithoutExt}.com`
                        ]);
                        return true;
                    } else {
                        return false;
                    }
                }
            }

            vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
                "-set", `serial1=nullmodem port:${debuggerPort}`,
                "-c", `MOUNT C "${fileDir}"`,
                "-c", "C:",
                "-c", `MOUNT A "${path}"`,
                "-c", `A:\\DEBUG.COM ${fileBaseNameWithoutExt}.com`
            ]);

            await vscode.debug.startDebugging(undefined, {
                name: "NASM Debug", 
                type: "cppdbg",
                request: "launch",
                cwd: fileDir,
                program: join(fileDir, `${fileBaseNameWithoutExt}.elf`),
                sourceFileMap: {
                    [fileDir]: fileDir
                }, 
                MIMode: "gdb",
                miDebuggerPath: "gdb", 
                miDebuggerServerAddress: `localhost:${debuggerPort}`,
                setupCommands: [
                    { "text": `cd ${fileDir}` }, 
                    { "text": `file ${fileBaseNameWithoutExt}.elf` }, 
                    { "text": `directory ${fileDir}` }, 
                    { "text": "set architecture i8086" }, 
                    { "text": "set disassembly-flavor intel" }
                ], 
                stopAtEntry: true,
                externalConsole: false,
                logging: {
                    engineLogging: true, 
                    trace: true, 
                    traceResponse: true
                }
            });

            // Listen for debug session termination
            const disposable = vscode.debug.onDidTerminateDebugSession((session) => {
                // Clean up when debugging ends
                disposable.dispose(); // Clean up the listener
            });

        } else {
            vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
                "-c", `MOUNT C "${fileDir}"`,
                "-c", "C:",
                "-c", `MOUNT A "${path}"`,
                "-c", `A:\\AFD ${fileBaseNameWithoutExt}.com`
            ]);
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