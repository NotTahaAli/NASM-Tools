import * as vscode from 'vscode';
import { BaseWebViewProvider } from './baseWebView';

export class MemoryWebViewProvider extends BaseWebViewProvider {
    public static readonly viewType = 'nasm-tools.memory-view';
    private _registerValues: {[key: string]: number} = {}; // Store register values for memory examination

    constructor(extensionUri: vscode.Uri) {
        super(extensionUri);
    }

    // Implement abstract methods from base class
    public get viewType(): string {
        return MemoryWebViewProvider.viewType;
    }

    protected getHtmlFilename(): string {
        return 'memory.html';
    }

    protected getCssFilename(): string {
        return 'memory.css';
    }

    protected getCssTemplateVariableName(): string {
        return 'styleMemoryUri';
    }

    protected getViewFocusCommand(): string {
        return 'nasm-tools.memory-view.focus';
    }

    protected handleWebviewMessage(data: any): void {
        switch (data.type) {
            case 'refreshMemory':
                this.handleRefreshMemory();
                break;
            case 'examineMemory':
                this.handleMemoryExamine(data.segment, data.offset, data.sectionId);
                break;
            case 'modifyMemory':
                this.handleMemoryModify(data.address, data.value, data.segmentedAddress);
                break;
        }
    }

    public updateRegisterValues(registerValues: {[key: string]: number}) {
        this._registerValues = registerValues;
    }

    public setDebuggerPaused(paused: boolean) {
        // Call parent implementation
        super.setDebuggerPaused(paused);
    }

    protected updateWebviewState() {
        // Call parent implementation - this sends setPausedState to webview
        super.updateWebviewState();

        // Let the webview decide what memory locations to request
        // The webview will automatically request memory when it receives setPausedState
    }

    private handleRefreshMemory() {
        console.log('Refreshing memory...');
        const session = vscode.debug.activeDebugSession;
        if (session && this._isDebuggerPaused) {
            // Refresh current memory sections
            // TODO: Implement memory refresh logic
        }
    }

    private async handleMemoryExamine(segment: string, offset: string, sectionId: string) {
        const session = vscode.debug.activeDebugSession;
        
        if (!session || !this._isDebuggerPaused) {
            return;
        }

        try {
            // Convert segment:offset to linear address
            // For 16-bit real mode: linear = (segment << 4) + offset
            let segmentValue: number;
            let offsetValue: number;
            
            // Handle register names (DS, ES, SI, DI, etc.) vs hex values
            if (/^[0-9A-Fa-f]+$/.test(segment)) {
                segmentValue = parseInt(segment, 16);
            } else {
                // Look up register value from stored register values
                const regName = segment.toUpperCase();
                segmentValue = this._registerValues[regName] || 0x1000; // Default fallback
                console.log(`Segment ${segment} -> ${regName} = 0x${segmentValue.toString(16).toUpperCase()}`);
            }
            
            if (/^[0-9A-Fa-f]+$/.test(offset)) {
                offsetValue = parseInt(offset, 16);
            } else {
                // Look up register value from stored register values
                const regName = offset.toUpperCase();
                offsetValue = this._registerValues[regName] || 0x0000; // Default fallback
                console.log(`Offset ${offset} -> ${regName} = 0x${offsetValue.toString(16).toUpperCase()}`);
            }
            
            const linearAddress = (segmentValue << 4) + offsetValue;
            
            // Examine 32 bytes (0x20) of memory starting at the linear address
            // Using format: x/32xb for 32 bytes in hex format
            const memoryResult = await session.customRequest('evaluate', {
                expression: `-exec x/32xb 0x${linearAddress.toString(16)}`,
                context: 'repl'
            });

            console.log(memoryResult);
            
            // Parse the memory result and send to webview
            const memoryData = this.parseMemoryExamine(memoryResult.result);
            
            if (this._view && this._webviewReady) {
                this._view.webview.postMessage({
                    type: 'updateMemorySection',
                    sectionId: sectionId,
                    memoryData: memoryData,
                    baseAddress: linearAddress
                });
            }
            
        } catch (error) {
            console.log('Error examining memory:', error);
        }
    }

    private parseMemoryExamine(gdbResult: string): number[] {
        if (!gdbResult) {
            return Array(32).fill(0);
        }

        // Parse GDB memory examination result: "0x1000: 0x12 0x34 0x56 ..."
        const bytes: number[] = [];
        const lines = gdbResult.split('\n').filter(line => line.trim());
        
        for (const line of lines) {
            // Look for hex bytes in the format: "0x1000: 0x12 0x34 0x56 0x78 ..."
            const match = line.match(/0x[0-9a-fA-F]+:\s+((?:0x[0-9a-fA-F]+\s*)+)/);
            if (match) {
                const byteMatches = match[1].match(/0x([0-9a-fA-F]+)/g);
                if (byteMatches) {
                    for (const byteMatch of byteMatches) {
                        const byteValue = parseInt(byteMatch.substring(2), 16);
                        bytes.push(byteValue);
                    }
                }
            }
        }
        
        // Ensure we have exactly 32 bytes, pad with zeros if needed
        while (bytes.length < 32) {
            bytes.push(0);
        }
        
        return bytes.slice(0, 32);
    }

    private async handleMemoryModify(address: number, value: number, segmentedAddress: string) {
        const session = vscode.debug.activeDebugSession;
        
        if (!session || !this._isDebuggerPaused) {
            console.log('Cannot modify memory: no active debug session or not paused');
            return;
        }

        try {
            console.log(`Modifying memory at address 0x${address.toString(16)} (${segmentedAddress}) with value 0x${value.toString(16)}`);
            
            // Use GDB's memory modification command: set {unsigned char} address = value
            const modifyResult = await session.customRequest('evaluate', {
                expression: `-exec set {char}0x${address.toString(16)} = ${value}`,
                context: 'repl'
            });

            console.log('Memory modification result:', modifyResult);
            
            // Send confirmation back to webview
            if (this._view && this._webviewReady) {
                this._view.webview.postMessage({
                    type: 'memoryModified',
                    address: address,
                    value: value,
                    segmentedAddress: segmentedAddress,
                    success: true
                });
            }
            
        } catch (error) {
            console.log('Error modifying memory:', error);
            
            // Send error confirmation back to webview
            if (this._view && this._webviewReady) {
                this._view.webview.postMessage({
                    type: 'memoryModified',
                    address: address,
                    value: value,
                    segmentedAddress: segmentedAddress,
                    success: false,
                    error: error instanceof Error ? error.message : 'Unknown error'
                });
            }
        }
    }
}