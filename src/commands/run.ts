import * as vscode from 'vscode';
import { assemble } from "./assemble";
import { join } from 'path';

export async function run(debugMode = false) {
    if (!await assemble()) {
        return false;
    }

    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const dosboxCommand = configs.get('dosboxCommand');

    const editor = vscode.window.activeTextEditor;

    let document = editor!.document;
    const fileDir = document.fileName.split('\\').slice(0, -1).join('\\');
    const fileBaseName = document.fileName.split('\\').slice(-1)[0];
    const fileBaseNameWithoutExt = fileBaseName.split('.').slice(0, -1).join('.');

    if (debugMode) {
        const path = join(vscode.extensions.getExtension("nottahaali.nasm-tools")!.extensionPath, "public");
        vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
            "-c", `MOUNT C "${fileDir}"`,
            "-c", "C:",
            "-c", `MOUNT A "${path}"`,
            "-c", `A:\\AFD ${fileBaseNameWithoutExt}.com`
        ]);
    } else {
        vscode.window.createTerminal('DOSBOX', dosboxCommand as string, [
            "-c", `MOUNT C "${fileDir}"`,
            "-c", "C:",
            "-c", `${fileBaseNameWithoutExt}.com`
        ]);
    }
    return true;
}