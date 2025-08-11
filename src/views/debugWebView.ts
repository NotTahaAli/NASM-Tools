// src/views/debugWebView.ts
import * as vscode from 'vscode';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export class DebugWebViewProvider implements vscode.WebviewViewProvider {
    public static readonly viewType = 'nasm-tools.debug-view';
    private _view?: vscode.WebviewView;
    private _isDebuggerPaused = false;
    private _webviewReady = false;
    private _pendingState?: boolean; // Store pending state if webview not ready
    private _registerValues: {[key: string]: number} = {}; // Store register values locally
    private _disassemblyPanel?: vscode.WebviewPanel; // Disassembly panel for terminal area
    private _disassemblyViewProvider?: any; // Reference to disassembly view provider

    constructor(private readonly _extensionUri: vscode.Uri) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log('resolveWebviewView called at:', Date.now());
        this._view = webviewView;
        this._webviewReady = false; // Reset ready state

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Handle messages from the webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'webviewReady':
                    console.log('Webview is ready! Sending current state if needed.');
                    this._webviewReady = true;
                    // Force show this debug view when ready
                    this.forceShowView();
                    // Handle any pending state or send current state
                    if (this._pendingState !== undefined) {
                        this._isDebuggerPaused = this._pendingState;
                        this._pendingState = undefined;
                    }
                    this.updateWebviewState();
                    break;
                case 'updateRegister':
                    this.handleRegisterUpdate(data.register, data.value);
                    break;
                case 'toggleFlag':
                    this.handleFlagToggle(data.flag, data.value);
                    break;
            }
        });
    }

    public setDebuggerPaused(paused: boolean) {
        console.log('setDebuggerPaused called:', paused, 'timestamp:', Date.now());
        this._isDebuggerPaused = paused;
        
        // Send state to webview if ready, otherwise store as pending
        if (this._webviewReady && this._view) {
            this.updateWebviewState();
        } else {
            console.log('Webview not ready yet, storing pending state:', paused);
            this._pendingState = paused;
        }
    }

    public setDisassemblyViewProvider(disassemblyViewProvider: any) {
        this._disassemblyViewProvider = disassemblyViewProvider;
    }

    public forceShowView() {
        console.log('Forcing debug view to show...');
        try {
            // Force show the debug view
            vscode.commands.executeCommand('nasm-tools.debug-view.focus');
        } catch (error) {
            console.log('Error forcing debug view to show:', error);
        }
    }

    public showDisassemblyPanel() {
        if (!this._disassemblyViewProvider) {
            console.log('No disassembly view provider available');
            return;
        }
        
        // Prepare sample disassembly data
        const sampleLines = [
            { address: '1000:0100', bytes: 'B8 34 12', instruction: 'MOV', operands: 'AX, 1234h', current: false },
            { address: '1000:0103', bytes: '01 D8', instruction: 'ADD', operands: 'AX, BX', current: true },
            { address: '1000:0105', bytes: 'EB 09', instruction: 'JMP', operands: 'SHORT 0110h', current: false },
            { address: '1000:0107', bytes: '90', instruction: 'NOP', operands: '', current: false },
            { address: '1000:0108', bytes: 'B9 FF FF', instruction: 'MOV', operands: 'CX, FFFFh', current: false },
            { address: '1000:010B', bytes: '48', instruction: 'DEC', operands: 'AX', current: false },
            { address: '1000:010C', bytes: '75 FB', instruction: 'JNZ', operands: 'SHORT 0109h', current: false },
            { address: '1000:010E', bytes: 'CD 20', instruction: 'INT', operands: '20h', current: false },
        ];
        
        // Update the interactive disassembly view
        this._disassemblyViewProvider.updateDisassembly(sampleLines);
    }

    private updateWebviewState() {
        if (!this._view || !this._webviewReady) {
            console.log('Cannot send message - view ready:', this._webviewReady, 'view defined:', !!this._view);
            return;
        }

        // Send paused state to webview
        console.log('Sending setPausedState message to webview:', this._isDebuggerPaused);
        this._view.webview.postMessage({
            type: 'setPausedState',
            isPaused: this._isDebuggerPaused
        });

        // Extract and send debug info if debugger is paused and we have an active session
        const session = vscode.debug.activeDebugSession;
        if (this._isDebuggerPaused && session && session.type === 'cppdbg') {
            console.log('Debugger paused with active session, extracting debug info');
            this.extractDebugInfo();
            
            // Show disassembly panel when debugger pauses
            this.showDisassemblyPanel();
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
                if (reg.startsWith('e')) {
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
            
            // Update disassembly view with register values if available
            if (this._disassemblyViewProvider) {
                this._disassemblyViewProvider.updateRegisterValues(registerValues);
            }
            
            // Update the webview with real GDB data
            if (this._view) {
                this._view.webview.postMessage({
                    type: 'updateDebugInfo',
                    registers: registers,
                    flags: flags,
                    disassemble: true,
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
            // Parse hex value
            const hexValue = value.replace('0x', '');
            
            // Convert display name back to GDB register name
            let gdbRegisterName = registerName.toLowerCase();
            
            if (registerName === 'FL') {
                gdbRegisterName = 'eflags';
            } else if (registerName === 'IP') {
                gdbRegisterName = 'eip';
            } else if (registerName === 'SP') {
                gdbRegisterName = 'esp';
            } else if (!['cs', 'ds', 'es', 'ss'].includes(gdbRegisterName)) {
                // Add 'e' prefix for general purpose registers: ax -> eax, bx -> ebx, etc.
                gdbRegisterName = 'e' + gdbRegisterName;
            }
            
            // Send GDB command to update register
            await session.customRequest('evaluate', {
                expression: `set $${gdbRegisterName}=0x${hexValue}`,
                context: 'repl'
            });
            
            // Update local register storage
            this._registerValues[registerName] = parseInt(hexValue, 16);
            
            // Refresh debug info after update
            this.extractDebugInfo();
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

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Do the same for the stylesheets.
        const styleResetUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'reset.css'));
        const styleVSCodeUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'vscode.css'));
        const styleDebugUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', 'debug.css'));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        // Read the HTML template
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', 'debug.html');
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Replace template variables
        htmlContent = htmlContent
            .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
            .replace(/\$\{nonce\}/g, nonce)
            .replace(/\$\{styleResetUri\}/g, styleResetUri.toString())
            .replace(/\$\{styleVSCodeUri\}/g, styleVSCodeUri.toString())
            .replace(/\$\{styleDebugUri\}/g, styleDebugUri.toString());

        return htmlContent;
    }
}