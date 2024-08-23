import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';

export async function assemble() {
    const editor = vscode.window.activeTextEditor;
    if (!editor) {
        vscode.window.showErrorMessage('No active text editor found');
        return false;
    }

    let document = editor.document;
    const codeLanguage = document.languageId;
    if (codeLanguage !== 'nasm') {
        vscode.window.showErrorMessage('The current file is not a NASM file');
        return false;
    }
    if (document.isUntitled) {
        vscode.window.showErrorMessage('Can not Assemble Unsaved File, please save the file first');
        return false;
    }

    const configs = vscode.workspace.getConfiguration('nasm-tools');
    const nasmCommand = configs.get('nasmCommand');

    const terminal = vscode.window.createTerminal('NASM Assemble');
    const fileNameWithoutExt = document.fileName.split('.').slice(0, -1).join('.');
    const fileDir = fileNameWithoutExt.split('\\').slice(0, -1).join('\\');
    terminal.show();
    terminal.sendText(`cd "${fileDir}"`);
    // Delete Previous Files
    if (existsSync(join(fileNameWithoutExt + ".com"))) {
        terminal.sendText(`del "${fileNameWithoutExt}.com"`);
    }
    if (existsSync(join(fileNameWithoutExt + ".lst"))) {
        terminal.sendText(`del "${fileNameWithoutExt}.lst"`);
    }
    terminal.sendText(`& "${nasmCommand}" "${document.fileName}" -o "${fileNameWithoutExt}.com" -l "${fileNameWithoutExt}.lst"`);
    terminal.sendText('exit');
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (existsSync(join(fileNameWithoutExt + ".com"))) {
        vscode.window.showInformationMessage('Assembly Successful');
        return true;
    } else {
        vscode.window.showErrorMessage('Assembly Failed, See LST File for Details');
        vscode.workspace.openTextDocument(join(fileNameWithoutExt + ".lst")).then(doc => {
            vscode.window.showTextDocument(doc);
        });
        return false;
    }
}