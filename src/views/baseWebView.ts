import * as vscode from 'vscode';

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}

export abstract class BaseWebViewProvider implements vscode.WebviewViewProvider {
    protected _view?: vscode.WebviewView;
    protected _webviewReady = false;
    protected _pendingState?: boolean;
    protected _isDebuggerPaused = false;

    constructor(protected readonly _extensionUri: vscode.Uri) {}

    // Abstract methods that must be implemented by subclasses
    public abstract get viewType(): string;
    protected abstract getHtmlFilename(): string;
    protected abstract getCssFilename(): string;
    protected abstract getCssTemplateVariableName(): string;
    protected abstract getViewFocusCommand(): string;
    protected abstract handleWebviewMessage(data: any): void;

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        console.log(`${this.constructor.name} resolveWebviewView called at:`, Date.now());
        this._view = webviewView;
        this._webviewReady = false; // Reset ready state

        this._view.webview.options = {
            enableScripts: true,
            localResourceRoots: [
                this._extensionUri,
                vscode.Uri.joinPath(this._extensionUri, 'media')
            ]
        };

        // Set up message handler BEFORE setting HTML content
        this._view.webview.onDidReceiveMessage(data => {
            console.log(`Received message from ${this.constructor.name}:`, data.type, 'at:', Date.now());
            
            // Handle common messages
            switch (data.type) {
                case 'webviewReady':
                    console.log(`${this.constructor.name} webview is ready! Setting ready state and handling pending operations.`);
                    this._webviewReady = true;
                    
                    // Handle any pending state
                    if (this._pendingState !== undefined) {
                        console.log('Applying pending state:', this._pendingState);
                        this._isDebuggerPaused = this._pendingState;
                        this._pendingState = undefined;
                        this.updateWebviewState();
                    }

                    break;

                default:
                    // Let subclass handle specific messages
                    this.handleWebviewMessage(data);
                    break;
            }
        });

        this._view.webview.html = this._getHtmlForWebview(this._view.webview);
        console.log(`${this.constructor.name} HTML content set, waiting for webviewReady message...`);
    }

    public setDebuggerPaused(paused: boolean) {
        console.log(`${this.constructor.name} setDebuggerPaused called:`, paused, 'timestamp:', Date.now());
        this._isDebuggerPaused = paused;
        
        // Send state to webview if ready, otherwise store as pending
        if (this._webviewReady && this._view) {
            console.log('Webview is ready, updating state immediately');
            this.updateWebviewState();
        } else {
            console.log('Webview not ready yet, storing pending state:', paused);
            this._pendingState = paused;
        }
    }

    public resetState() {
        console.log(`${this.constructor.name} resetState called - clearing webviewReady flag`);
        this._webviewReady = false;
        this._pendingState = undefined;
    }

    public forceShowView() {
        console.log(`Forcing ${this.constructor.name} to show... webviewReady:`, this._webviewReady, 'view defined:', !!this._view);
        try {
            // First show the NASM Tools activity bar container, then focus the specific view
            vscode.commands.executeCommand('workbench.view.extension.nasm-tools').then(() => {
                console.log('Successfully showed NASM Tools container');
                // Then focus the specific view
                return vscode.commands.executeCommand(this.getViewFocusCommand());
            }).then(() => {
                console.log(`Successfully focused ${this.constructor.name}`);
            }, (error) => {
                console.log(`Error in view command sequence for ${this.constructor.name}:`, error);
                // Fallback: try direct focus command
                vscode.commands.executeCommand(this.getViewFocusCommand());
            });
        } catch (error) {
            console.log(`Error forcing ${this.constructor.name} to show:`, error);
        }
    }

    protected updateWebviewState() {
        console.log(`${this.constructor.name} updateWebviewState called - webviewReady:`, this._webviewReady, 'view defined:', !!this._view, 'isPaused:', this._isDebuggerPaused);
        
        if (!this._view || !this._webviewReady) {
            console.log('Cannot send message - view ready:', this._webviewReady, 'view defined:', !!this._view);
            return;
        }

        this._view.webview.postMessage({
            type: 'setPausedState',
            isPaused: this._isDebuggerPaused
        });
        
        console.log(`${this.constructor.name} state message sent:`, this._isDebuggerPaused);
    }

    protected _getHtmlForWebview(webview: vscode.Webview) {
        // Common stylesheets
        const styleSpecificUri = webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'media', this.getCssFilename()));

        // Use a nonce to only allow a specific script to be run.
        const nonce = getNonce();

        // Read the HTML template
        const fs = require('fs');
        const path = require('path');
        const htmlPath = path.join(this._extensionUri.fsPath, 'media', this.getHtmlFilename());
        let htmlContent = fs.readFileSync(htmlPath, 'utf8');

        // Replace template variables
        htmlContent = htmlContent
            .replace(/\$\{webview\.cspSource\}/g, webview.cspSource)
            .replace(/\$\{nonce\}/g, nonce)
            .replace(new RegExp(`\\$\\{${this.getCssTemplateVariableName()}\\}`, 'g'), styleSpecificUri.toString());

        return htmlContent;
    }
}
