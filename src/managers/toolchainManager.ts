import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as https from 'https';
import { promisify } from 'util';
import { pipeline } from 'stream';
import { createWriteStream } from 'fs';
import { exec } from 'child_process';

const pipelineAsync = promisify(pipeline);
const execAsync = promisify(exec);

export class ToolchainManager {
    private context: vscode.ExtensionContext;
    private toolchainPath: string;

    constructor(context: vscode.ExtensionContext) {
        this.context = context;
        this.toolchainPath = path.join(context.globalStorageUri.fsPath, 'i386-elf-binutils');
    }

    /**
     * Check if the toolchain is already installed
     */
    public isToolchainInstalled(): boolean {
        // For Linux, system ld is always available
        if (process.platform === 'linux') {
            return true;
        }

        // For other platforms, check downloaded toolchain
        // Check if base storage directory exists
        if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
            return false;
        }
        
        // Check if toolchain directory exists
        if (!fs.existsSync(this.toolchainPath)) {
            return false;
        }
        
        const binPath = this.getToolchainBinPath();
        
        // Check if bin directory exists
        if (!fs.existsSync(binPath)) {
            return false;
        }
        
        const linkerPath = this.getLinkerPath();
        
        return fs.existsSync(linkerPath);
    }

    /**
     * Get the path to the toolchain binaries
     */
    public getToolchainBinPath(): string {
        return path.join(this.toolchainPath, 'bin');
    }

    /**
     * Get the full path to linker command (platform-specific)
     */
    public getLinkerPath(): string {
        // For Linux, use system ld with i386 target
        if (process.platform === 'linux') {
            return 'ld';
        }

        // For other platforms, use downloaded i386-elf-ld
        const binPath = this.getToolchainBinPath();
        let linkerPath: string;
        
        switch (process.platform) {
            case 'win32':
                linkerPath = path.join(binPath, 'i386-elf-ld.exe');
                break;
            case 'darwin':
                linkerPath = path.join(binPath, 'i386-elf-ld');
                break;
            default:
                linkerPath = path.join(binPath, 'i386-elf-ld');
                break;
        }
        
        return linkerPath;
    }

    /**
     * Get the linker arguments for i386 target
     */
    public getLinkerArgs(inputFile: string, outputFile: string): string[] {
        if (process.platform === 'linux') {
            // For Linux system ld, use -m elf_i386 flag
            return ['-m', 'elf_i386', '-Ttext=0x0100', inputFile, '-o', outputFile];
        } else {
            // For i386-elf-ld, use standard arguments
            return ['-Ttext=0x0100', inputFile, '-o', outputFile];
        }
    }

    /**
     * Check if auto-download is supported on this platform
     * Note: Ubuntu uses system ld instead of downloads
     */
    public isAutoDownloadSupported(): boolean {
        return process.platform === 'win32' || process.platform === 'darwin';
    }

    /**
     * Get direct download URL for platform-specific toolchain
     */
    private getDirectDownloadUrl(): string | null {
        switch (process.platform) {
            case 'win32':
                return 'https://github.com/nativeos/i386-elf-toolchain/releases/download/preview/i386-elf-binutils-windows-x86_64.zip';
            case 'darwin':
                return 'https://github.com/nativeos/i386-elf-toolchain/releases/download/preview/i386-elf-binutils-macos-x86_64.tar.gz';
            default:
                return null;
        }
    }

    /**
     * Download and install the i386-elf toolchain
     */
    public async downloadAndInstallToolchain(): Promise<boolean> {
        try {
            // Check if platform is supported
            if (!this.isAutoDownloadSupported()) {
                const platformName = process.platform;
                vscode.window.showErrorMessage(
                    `Toolchain auto-download is not supported on ${platformName}. Please install manually.`
                );
                return false;
            }

            // Create storage directory if it doesn't exist
            if (!fs.existsSync(this.context.globalStorageUri.fsPath)) {
                fs.mkdirSync(this.context.globalStorageUri.fsPath, { recursive: true });
            }

            // Show progress
            return await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "NASM Tools: Setting up i386-elf toolchain",
                cancellable: false
            }, async (progress) => {
                try {
                    progress.report({ increment: 0, message: "Preparing toolchain download..." });

                    // Get the direct download URL for this platform
                    const downloadUrl = this.getDirectDownloadUrl();

                    if (!downloadUrl) {
                        throw new Error(`Direct download not available for ${process.platform}`);
                    }

                    progress.report({ increment: 20, message: "Downloading toolchain..." });

                    // Download the toolchain
                    const downloadPath = await this.downloadToolchain(downloadUrl);

                    progress.report({ increment: 60, message: "Extracting toolchain..." });

                    // Extract the toolchain
                    await this.extractToolchain(downloadPath);

                    progress.report({ increment: 90, message: "Cleaning up..." });

                    // Clean up downloaded archive
                    if (fs.existsSync(downloadPath)) {
                        fs.unlinkSync(downloadPath);
                    }

                    progress.report({ increment: 100, message: "Toolchain setup complete!" });

                    vscode.window.showInformationMessage(
                        'i386-elf toolchain has been successfully installed!'
                    );

                    return true;
                } catch (error) {
                    console.error('Error setting up toolchain:', error);
                    vscode.window.showErrorMessage(
                        `Failed to setup toolchain: ${error instanceof Error ? error.message : 'Unknown error'}`
                    );
                    return false;
                }
            });
        } catch (error) {
            console.error('Error in downloadAndInstallToolchain:', error);
            vscode.window.showErrorMessage(
                `Failed to setup toolchain: ${error instanceof Error ? error.message : 'Unknown error'}`
            );
            return false;
        }
    }

    /**
     * Download toolchain archive and return the path
     */
    private async downloadToolchain(downloadUrl: string): Promise<string> {
        const extension = process.platform === 'win32' ? '.zip' : '.tar.gz';
        const downloadPath = path.join(this.context.globalStorageUri.fsPath, `toolchain${extension}`);
        
        await this.downloadFile(downloadUrl, downloadPath);
        return downloadPath;
    }

    /**
     * Extract toolchain archive using platform-appropriate method
     */
    private async extractToolchain(archivePath: string): Promise<void> {
        const extractPath = this.context.globalStorageUri.fsPath;
        
        switch (process.platform) {
            case 'win32':
                await this.extractZip(archivePath, extractPath);
                break;
            case 'linux':
            case 'darwin':
                await this.extractTarGz(archivePath, extractPath);
                break;
            default:
                throw new Error(`Extraction not supported on ${process.platform}`);
        }
    }

    /**
     * Download a file from URL
     */
    private async downloadFile(url: string, outputPath: string): Promise<void> {
        return new Promise((resolve, reject) => {
            const file = createWriteStream(outputPath);
            
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Handle redirect
                    const redirectUrl = response.headers.location;
                    if (redirectUrl) {
                        https.get(redirectUrl, (redirectResponse) => {
                            pipelineAsync(redirectResponse, file)
                                .then(() => resolve())
                                .catch(reject);
                        }).on('error', reject);
                    } else {
                        reject(new Error('Redirect without location header'));
                    }
                } else if (response.statusCode === 200) {
                    pipelineAsync(response, file)
                        .then(() => resolve())
                        .catch(reject);
                } else {
                    reject(new Error(`HTTP ${response.statusCode}: ${response.statusMessage}`));
                }
            }).on('error', reject);
        });
    }

    /**
     * Extract a zip file using PowerShell (Windows)
     */
    private async extractZip(zipPath: string, extractPath: string): Promise<void> {
        const powershellCommand = `Expand-Archive -Path "${zipPath}" -DestinationPath "${extractPath}" -Force`;
        
        try {
            await execAsync(`powershell -Command "${powershellCommand}"`);
        } catch (error) {
            throw new Error(`Failed to extract toolchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Extract a tar.gz file using tar (Linux/macOS)
     */
    private async extractTarGz(tarPath: string, extractPath: string): Promise<void> {
        const tarCommand = `tar -xzf "${tarPath}" -C "${extractPath}"`;
        
        try {
            await execAsync(tarCommand);
        } catch (error) {
            throw new Error(`Failed to extract toolchain: ${error instanceof Error ? error.message : 'Unknown error'}`);
        }
    }

    /**
     * Check if GDB is available in the system PATH
     */
    public async isGdbAvailable(): Promise<boolean> {
        try {
            const gdbCommand = 'gdb --version';
            await execAsync(gdbCommand);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Ensure toolchain is available, download if necessary
     */
    public async ensureToolchainAvailable(): Promise<boolean> {
        // For Linux, system ld is always available - no download needed
        if (process.platform === 'linux') {
            console.log('Linux system ld with i386 support detected - no toolchain download needed');
            return true;
        }

        // For other platforms, check downloaded toolchain
        if (this.isToolchainInstalled()) {
            console.log('i386-elf toolchain already installed');
            return true;
        }

        if (this.isAutoDownloadSupported()) {
            console.log(`i386-elf toolchain not found on ${process.platform}, downloading...`);
            return await this.downloadAndInstallToolchain();
        } else {
            console.log(`Auto-download not supported on ${process.platform}`);
            vscode.window.showWarningMessage(
                `i386-elf toolchain not found. Auto-download is not supported on ${process.platform}. Please install manually.`
            );
            return false;
        }
    }
}
