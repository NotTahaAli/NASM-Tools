import * as vscode from 'vscode';
import { BaseWebViewProvider } from './baseWebView';

export class DisassemblyWebViewProvider extends BaseWebViewProvider {
    public static readonly viewType = 'nasm-tools.disassembly-view';
    private _registerValues: {[key: string]: number} = {}; // Store register values for memory examination

    constructor(extensionUri: vscode.Uri) {
        super(extensionUri);
    }

    // Implement abstract methods from base class
    public get viewType(): string {
        return DisassemblyWebViewProvider.viewType;
    }

    protected getHtmlFilename(): string {
        return 'disassembly.html';
    }

    protected getCssFilename(): string {
        return 'disassembly.css';
    }

    protected getCssTemplateVariableName(): string {
        return 'styleDisassemblyUri';
    }

    protected getViewFocusCommand(): string {
        return 'nasm-tools.disassembly-view.focus';
    }

    protected handleWebviewMessage(data: any): void {
        switch (data.type) {
            case 'gotoAddress':
                this.handleGotoAddress(data.address);
                break;
            case 'setBreakpoint':
                this.handleSetBreakpoint(data.address);
                break;
            case 'refreshDisassembly':
                this.handleRefreshDisassembly();
                break;
            case 'toggleBreakpoints':
                this.handleToggleBreakpoints();
                break;
            case 'examineMemory':
                this.handleMemoryExamine(data.segment, data.offset, data.sectionId);
                break;
        }
    }

    public updateDisassembly(lines: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateDisassembly',
                lines: lines
            });
        }
    }

    public updateRegisterValues(registerValues: {[key: string]: number}) {
        this._registerValues = registerValues;
    }

    private handleRefreshDisassembly() {
        console.log('Refreshing disassembly...');
        // TODO: Implement actual disassembly refresh from GDB
        const session = vscode.debug.activeDebugSession;
        if (session && this._isDebuggerPaused) {
            this.extractDisassemblyInfo();
        }
    }

    private handleToggleBreakpoints() {
        console.log('Toggling breakpoints display...');
        // TODO: Implement breakpoint visibility toggle
    }

    private async extractDisassemblyInfo() {
        const session = vscode.debug.activeDebugSession;

        if (!session || !this._webviewReady || session.type !== 'cppdbg') {
            return;
        }

        try {
            // Get current instruction pointer
            const ipResult = await session.customRequest('evaluate', {
                expression: `-exec print $eip`,
                context: 'repl'
            });

            const currentIP = this.parseRegisterValue(ipResult.result, 'eip');

            // Disassemble around current instruction pointer (±8 instructions)
            const disasmResult = await session.customRequest('evaluate', {
                expression: `-exec disassemble $eip-16,$eip+32`,
                context: 'repl'
            });

            const disassemblyLines = this.parseDisassemblyResult(disasmResult.result, currentIP);
            
            if (this._view && this._webviewReady) {
                this._view.webview.postMessage({
                    type: 'updateDisassembly',
                    lines: disassemblyLines
                });
            }
        } catch (error) {
            console.log('Error extracting disassembly info:', error);
        }
    }

    private parseDisassemblyResult(gdbResult: string, currentIP: number): any[] {
        if (!gdbResult) {
            return [];
        }

        const lines = gdbResult.split('\n').filter(line => line.trim());
        const disassemblyLines: any[] = [];

        for (const line of lines) {
            // Parse GDB disassembly format: "=> 0x100 <main+4>: mov    %eax,%ebx"
            const match = line.match(/^\s*(=>)?\s*0x([0-9a-fA-F]+)\s*(?:<[^>]*>)?:\s*([^\s]+)\s*(.*)/);
            if (match) {
                const isCurrent = match[1] === '=>';
                const address = parseInt(match[2], 16);
                const instruction = match[3];
                const operands = match[4] || '';

                // Convert to 16-bit segment:offset format for display
                const segment = Math.floor(address / 16).toString(16).toUpperCase().padStart(4, '0');
                const offset = (address % 16).toString(16).toUpperCase().padStart(4, '0');

                disassemblyLines.push({
                    address: `${segment}:${offset}`,
                    bytes: '', // GDB doesn't provide bytes in disassemble output
                    instruction: instruction.toUpperCase(),
                    operands: operands,
                    current: isCurrent,
                    breakpoint: false // TODO: Track breakpoints
                });
            }
        }

        return disassemblyLines;
    }

    private parseRegisterValue(gdbResult: string, registerName: string): number {
        if (!gdbResult) {
            return 0;
        }

        // Handle ESP and EIP which come with hex values: "(void *) 0xffee" or "(void (*)()) 0x100 <start>"
        if (registerName === 'esp' || registerName === 'ebp' || registerName === 'eip') {
            const match = gdbResult.match(/0x([0-9a-fA-F]+)/);
            if (match) {
                return parseInt(match[1], 16) & 0xFFFF; // Mask to 16 bits
            }
        }

        // Handle regular registers which come as decimal: "$6 = 2332"
        const decMatch = gdbResult.match(/\$\d+\s*=\s*(\d+)/);
        if (decMatch) {
            return parseInt(decMatch[1], 10) & 0xFFFF; // Mask to 16 bits
        }

        console.log(`Could not parse register value for ${registerName}: ${gdbResult}`);
        return 0;
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

    private handleGotoAddress(address: string) {
        // TODO: Implement go to address functionality
        console.log('Go to address:', address);
    }

    private handleSetBreakpoint(address: string) {
        // TODO: Implement breakpoint setting
        console.log('Set breakpoint at:', address);
    }
}
