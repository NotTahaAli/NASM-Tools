import * as vscode from 'vscode';
import { assemble } from "./assemble";
import { dirname, join } from 'path';
import { debug } from 'console';
import { DebugWebViewProvider } from '../views/debugWebView';

export async function run(debugMode = false, debugViewProvider?: DebugWebViewProvider) {

    // pass debug mode to assemble function and generate elf file for debugging if gdb
    if (!await assemble("runner", debugMode)) {
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

        if (debuggerType === 'gdb' /* and check availablity of gdb and i386 */) {

            // add check for debugger configuration
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