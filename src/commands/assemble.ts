import * as vscode from 'vscode';
import { existsSync } from 'fs';
import { join } from 'path';

export async function assemble(outputFileBaseNameWithoutExt?: string) {
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

    const fileDir = document.fileName.split('\\').slice(0, -1).join('\\');
    const fileNameWithoutExt = document.fileName.split('.').slice(0, -1).join('.');
    let outputFileNameWithoutExt = outputFileBaseNameWithoutExt ? fileDir + "\\" + outputFileBaseNameWithoutExt : fileNameWithoutExt;
    let terminal = vscode.window.createTerminal('NASM Cleanup');
    terminal.sendText(`cd "${fileDir}"`);
    // Delete Previous Files
    if (existsSync(join(outputFileNameWithoutExt + ".com"))) {
        terminal.sendText(`del "${outputFileNameWithoutExt}.com"`);
    }
    if (existsSync(join(outputFileNameWithoutExt + ".lst"))) {
        terminal.sendText(`del "${outputFileNameWithoutExt}.lst"`);
    }
    terminal.sendText('exit');
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    terminal = vscode.window.createTerminal('NASM Assemble', nasmCommand as string, [
        `${document.fileName}`,
        "-o", `${outputFileNameWithoutExt}.com`,
        "-l", `${outputFileNameWithoutExt}.lst`
    ]);
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (existsSync(join(outputFileNameWithoutExt + ".com"))) {
        vscode.window.showInformationMessage('Assembly Successful');
        return true;
    } else {
        vscode.window.showErrorMessage('Assembly Failed, See LST File for Details');
        vscode.workspace.openTextDocument(join(outputFileNameWithoutExt + ".lst")).then(doc => {
            vscode.window.showTextDocument(doc);
        });
        return false;
    }
}