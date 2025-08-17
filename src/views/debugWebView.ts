// src/views/debugWebView.ts
import * as vscode from 'vscode';
import { BaseWebViewProvider } from './baseWebView';

export class DebugWebViewProvider extends BaseWebViewProvider {
    public static readonly viewType = 'nasm-tools.debug-view';
    private _registerValues: {[key: string]: number} = {};

    constructor(extensionUri: vscode.Uri) {
        super(extensionUri);
    }

    // Implement abstract methods from base class
    public get viewType(): string {
        return DebugWebViewProvider.viewType;
    }

    protected getHtmlFilename(): string {
        return 'debug.html';
    }

    protected getCssFilename(): string {
        return 'debug.css';
    }

    protected getCssTemplateVariableName(): string {
        return 'styleDebugUri';
    }

    protected getViewFocusCommand(): string {
        return 'nasm-tools.debug-view.focus';
    }

    protected handleWebviewMessage(data: any): void {
        switch (data.type) {
            case 'updateRegister':
                this.handleRegisterUpdate(data.register, data.value);
                break;
            case 'toggleFlag':
                this.handleFlagToggle(data.flag, data.value);
                break;
        }
    }

    public getRegisterValues(): {[key: string]: number} {
        return this._registerValues;
    }

    protected updateWebviewState() {
        // Call parent implementation first
        super.updateWebviewState();

        const session = vscode.debug.activeDebugSession;

        if (this._isDebuggerPaused && session && session.type === 'cppdbg') {
            console.log('Debugger paused with active session, extracting debug info');
            this.extractDebugInfo();
        } else {
            console.log('Not extracting debug info - paused:', this._isDebuggerPaused, 'session type:', session?.type || 'none');
        }
    }

    private async extractDebugInfo() {
        const session = vscode.debug.activeDebugSession;

        if (!session || !this._webviewReady || session.type !== 'cppdbg') {
            return;
        }

        try {
            // Use 32-bit register names for easier parsing (upper 16 bits will be zero for 16-bit values)
            const registers = ['eax', 'ebx', 'ecx', 'edx', 'esp', 'ebp', 'esi', 'edi', 'cs', 'ds', 'es', 'ss', 'eip'];
            const registerValues: {[key: string]: any} = {};
            
            for (const reg of registers) {
                const regResult = await session.customRequest('evaluate', {
                    expression: `-exec print $${reg}`,
                    context: 'repl'
                });
                
                // Parse the GDB result and convert to hex
                const parsedValue = this.parseRegisterValue(regResult.result, reg);
                
                // Convert register name for display (remove 'e' prefix for most registers)
                let displayName = reg.toUpperCase();

                // Remove 'e' prefix: eax -> AX, ebx -> BX, etc.
                if (reg !== 'es' && reg.startsWith('e')) {
                    displayName = displayName.substring(1);
                }
                
                registerValues[displayName] = parsedValue;
            }
            
            // Get flags register
            const flagsResult = await session.customRequest('evaluate', {
                expression: '-exec print $eflags',
                context: 'repl'
            });
            
            // Define flag bit positions
            const flagBitMap = {
                'CF': 0,   // Carry
                'PF': 2,   // Parity  
                'AF': 4,   // Auxiliary
                'ZF': 6,   // Zero
                'SF': 7,   // Sign
                'IF': 9,   // Interrupt
                'DF': 10,  // Direction
                'OF': 11   // Overflow
            };
            
            // Parse flags directly from the result: "$14 = [ PF AF IF NT ]\n"
            const flagsMatch = flagsResult.result.match(/\[\s*([^\]]*)\s*\]/);
            const activeFlagNames = flagsMatch ? flagsMatch[1].split(/\s+/).filter((f: string) => f.length > 0) : [];
            
            // Create flags object and calculate flags register value
            const flags: {[key: string]: boolean} = {};
            let flagsRegisterValue = 0;
            
            for (const [flagName, bitPosition] of Object.entries(flagBitMap)) {
                const isActive = activeFlagNames.includes(flagName);
                flags[flagName] = isActive;
                
                if (isActive) {
                    flagsRegisterValue |= (1 << bitPosition);
                }
            }
            
            // Add flags register value to register values
            registerValues['FL'] = flagsRegisterValue;
            
            // Store register values locally for sharing with disassembly view
            this._registerValues = registerValues;
            
            // Update the webview with real GDB data
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'updateRegisterInfo',
                    registers: registerValues,
                    flags: flags,
                    isPaused: this._isDebuggerPaused
                });
            }
            
        } catch (error) {
            console.log('Error fetching debug info:', error);
        }
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

    private async handleRegisterUpdate(registerName: string, value: string) {
        const session = vscode.debug.activeDebugSession;
        
        if (!session || !this._isDebuggerPaused) {
            return;
        }

        try {
            // ID sent which is already lowercased
            let gdbRegisterName = registerName;
            
            if (registerName === 'fl') {
                gdbRegisterName = 'eflags';
            } else if (!['cs', 'ds', 'es', 'ss'].includes(gdbRegisterName)) {
                // Add 'e' prefix for general purpose registers: ax -> eax, bx -> ebx, etc.
                gdbRegisterName = 'e' + gdbRegisterName;
            }
            
            // Send GDB command to update register
            await session.customRequest('evaluate', {
                expression: `-exec set $${gdbRegisterName}=0x${value}`,
                context: 'repl'
            });
            
            // Update local register storage
            this._registerValues[registerName.toUpperCase()] = parseInt(value, 16);
            
            // Refresh debug info after update
            this.updateWebviewState();
        } catch (error) {
            console.log('Error updating register:', error);
        }
    }

    private async handleFlagToggle(flagName: string, newValue: boolean) {
        const session = vscode.debug.activeDebugSession;
        
        if (!session || !this._isDebuggerPaused) {
            return;
        }

        try {
            // Use the same flag bit mapping as in refreshDebugInfo
            const flagBitMap: { [key: string]: number } = {
                'CF': 0,   // Carry
                'PF': 2,   // Parity  
                'AF': 4,   // Auxiliary
                'ZF': 6,   // Zero
                'SF': 7,   // Sign
                'IF': 9,   // Interrupt
                'DF': 10,  // Direction
                'OF': 11   // Overflow
            };

            if (flagBitMap[flagName] !== undefined) {
                const bitPos = flagBitMap[flagName];
                const flagExpression = newValue 
                    ? `set $eflags |= (1 << ${bitPos})`   // Set bit
                    : `set $eflags &= ~(1 << ${bitPos})`; // Clear bit
                
                await session.customRequest('evaluate', {
                    expression: flagExpression,
                    context: 'repl'
                });
            }
            
            // Refresh debug info after update
            this.extractDebugInfo();
        } catch (error) {
            console.log('Error updating flag:', error);
        }
    }
}