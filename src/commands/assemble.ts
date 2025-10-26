import * as vscode from 'vscode';
import { existsSync, unlinkSync } from 'fs';
import path from 'path';

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

    const fileDir = path.dirname(document.fileName);
    const extension = path.extname(document.fileName);
    const fileNameWithoutExt = document.fileName.slice(0, -extension.length);
    let outputFileNameWithoutExt = outputFileBaseNameWithoutExt ? path.join(fileDir, outputFileBaseNameWithoutExt) : fileNameWithoutExt;
    // Delete Previous Files
    if (existsSync(path.join(outputFileNameWithoutExt + ".com"))) {
        unlinkSync(path.join(outputFileNameWithoutExt+".com"));
    }
    if (existsSync(path.join(outputFileNameWithoutExt + ".lst"))) {
        unlinkSync(path.join(outputFileNameWithoutExt+".lst"));;
    }
    const terminal = vscode.window.createTerminal('NASM Assemble', nasmCommand as string, [
        `${document.fileName}`,
        "-o", `${outputFileNameWithoutExt}.com`,
        "-l", `${outputFileNameWithoutExt}.lst`
    ]);
    while (terminal.exitStatus === undefined) {
        await new Promise(resolve => setTimeout(resolve, 500));
    }
    if (existsSync(path.join(outputFileNameWithoutExt + ".com"))) {
        vscode.window.showInformationMessage('Assembly Successful');
        return true;
    } else {
        vscode.window.showErrorMessage('Assembly Failed, See LST File for Details');
        vscode.workspace.openTextDocument(path.join(outputFileNameWithoutExt + ".lst")).then(doc => {
            vscode.window.showTextDocument(doc);
        });
        return false;
    }
}