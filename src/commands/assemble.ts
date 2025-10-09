import * as vscode from 'vscode';
import { readFileSync, writeFileSync, copyFileSync, existsSync, unlinkSync } from 'fs';
import path from 'path';
import { ToolchainManager } from '../managers/toolchainManager';

export async function assemble(outputFileBaseNameWithoutExt?: string, createELF = false, context?: vscode.ExtensionContext) {
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

    // Check if NASM assembly succeeded (check both exit code and file existence)
    if (!(terminal.exitStatus && terminal.exitStatus.code === 0 && existsSync(path.join(outputFileNameWithoutExt + ".com")))) {
        vscode.window.showErrorMessage('Assembly Failed, See LST File for Details');
        if (existsSync(path.join(outputFileNameWithoutExt + ".lst"))) {
            vscode.workspace.openTextDocument(path.join(outputFileNameWithoutExt + ".lst")).then(doc => {
                vscode.window.showTextDocument(doc);
            });
        }
        return false;
    }

    // COM file assembled successfully, now validate ELF creation requirements
    if (createELF) {
        if (!context) {
            vscode.window.showErrorMessage('Extension context required for ELF creation');
            return false;
        }

        const toolchain = new ToolchainManager(context);
        
        // Check if GDB is available (required for ELF debugging)
        const gdbAvailable = await toolchain.isGdbAvailable();
        if (!gdbAvailable) {
            // Continue with normal COM file assembly only - AFD debugging still available
            vscode.window.showInformationMessage('Assembly Successful (GDB not available - AFD debugging still possible)');
            return true;
        }

        // Backup original file
        const backupFile = path.join(fileNameWithoutExt + ".bak");
        let backupCreated = false;
        let elfCreationFailed = false;
        
        try {
            copyFileSync(document.fileName, backupFile);
            backupCreated = true;

            // Replace [org 0x0100] and org 0x0100 with [bits 16] and bits 16
            let asmContent = readFileSync(document.fileName, 'utf8');
            asmContent = asmContent.replace(/\[org 0x0100\]/gi, '[bits 16]');
            asmContent = asmContent.replace(/org 0x0100/gi, 'bits 16');
            writeFileSync(document.fileName, asmContent, 'utf8');

            // Check toolchain availability (works on all supported platforms)
            const toolchainAvailable = toolchain.isToolchainInstalled();
            if (!toolchainAvailable) {
                // Try to auto-setup (download for Windows/macOS, system ld for Linux)
                vscode.window.showInformationMessage('Setting up toolchain for ELF support. Please Wait...');
                const setupSuccess = await toolchain.ensureToolchainAvailable();
                if (!setupSuccess) {
                    throw new Error('i386-elf toolchain setup failed');
                }
            }
            
            const linkerCommand = toolchain.getLinkerPath();
            console.log(`Using toolchain: ${linkerCommand}`);
                
            // Assemble to ELF using NASM and i386-elf-ld
            let term = vscode.window.createTerminal('ELF Assemble', nasmCommand as string, [
                "-f", "elf32", 
                "-g3", "-F", "dwarf", `${document.fileName}`, 
                "-o", `${fileNameWithoutExt}.o`
            ]);
            while (term.exitStatus === undefined) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Check if ELF assembly succeeded
            if (term.exitStatus && term.exitStatus.code !== 0) {
                vscode.window.showErrorMessage('ELF assembly failed. Check terminal output for details.');
                throw new Error('ELF assembly failed');
            }

            // Check if object file was created
            if (!existsSync(`${fileNameWithoutExt}.o`)) {
                vscode.window.showErrorMessage('ELF assembly failed - object file not created');
                throw new Error('Object file not created');
            }

            // Link the object file
            const linkerArgs = toolchain.getLinkerArgs(`${fileNameWithoutExt}.o`, `${outputFileNameWithoutExt}.elf`);
            term = vscode.window.createTerminal('ELF Link', linkerCommand, linkerArgs);
            while (term.exitStatus === undefined) {
                await new Promise(resolve => setTimeout(resolve, 500));
            }

            // Check if linking succeeded
            if (term.exitStatus && term.exitStatus.code !== 0) {
                vscode.window.showErrorMessage('ELF linking failed. Check terminal output for details.');
                throw new Error('ELF linking failed');
            }

            // Check if ELF file was created
            if (!existsSync(`${outputFileNameWithoutExt}.elf`)) {
                vscode.window.showErrorMessage('ELF linking failed - ELF file not created');
                throw new Error('ELF file not created');
            }

            // Clean up object file
            if (existsSync(`${fileNameWithoutExt}.o`)) {
                unlinkSync(path.join(fileNameWithoutExt + ".o"));
            }

        } catch (error) {
            // Restore original file if backup was created
            if (backupCreated && existsSync(backupFile)) {
                try {
                    copyFileSync(backupFile, document.fileName);
                } catch (restoreError) {
                    vscode.window.showErrorMessage('Failed to restore original file after ELF creation error');
                }
            }
            
            // Clean up any partial files
            if (existsSync(`${fileNameWithoutExt}.o`)) {
                unlinkSync(`${fileNameWithoutExt}.o`);
            }
            
            console.error('ELF creation failed:', error);
            
            // Show error message with specific reason
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            vscode.window.showErrorMessage(`ELF creation failed: ${errorMessage}. COM file created successfully.`);
            
            // If toolchain download failed specifically, offer to switch to AFD as default
            if (errorMessage.includes('toolchain download failed')) {
                const choice = await vscode.window.showWarningMessage(
                    'Toolchain download failed. Would you like to set AFD as the default debugger to avoid this issue?',
                    'Set AFD as Default',
                    'Keep Current Settings'
                );
                
                if (choice === 'Set AFD as Default') {
                    await vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
                    vscode.window.showInformationMessage('Default debugger changed to AFD. Start a new debug session to use AFD debugging.');
                }
            }
            
            // Return false - ELF creation failed, user should start new session for AFD debugging
            elfCreationFailed = true;
        } finally {
            // Always restore original file and clean up backup
            if (backupCreated && existsSync(backupFile)) {
                try {
                    copyFileSync(backupFile, document.fileName);
                    unlinkSync(backupFile);
                } catch (cleanupError) {
                    console.error('Failed to clean up backup file:', cleanupError);
                }
            }
        }

        if (elfCreationFailed) {
            return false;
        }
    }

    // Show appropriate success message based on what was created
    if (createELF && existsSync(path.join(outputFileNameWithoutExt + ".elf"))) {
        vscode.window.showInformationMessage('Assembly Successful - COM and ELF files created for GDB debugging');
    } else {
        vscode.window.showInformationMessage('Assembly Successful - COM file created');
    }
    return true;
}