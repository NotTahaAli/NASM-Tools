import * as vscode from 'vscode';
import { BaseWebViewProvider } from '../views/baseWebView';
import { DebugWebViewProvider } from '../views/debugWebView';
import { MemoryWebViewProvider } from '../views/memoryWebView';

export class DebugController {
    private debugViewProvider: DebugWebViewProvider;
    private memoryViewProvider: MemoryWebViewProvider;
    private viewProviders: BaseWebViewProvider[];
    private _hasShownDebugViewThisSession = false;

    constructor(private context: vscode.ExtensionContext, extensionUri: vscode.Uri) {
        // Create webview providers
        this.debugViewProvider = new DebugWebViewProvider(extensionUri);
        this.memoryViewProvider = new MemoryWebViewProvider(extensionUri);
        this.viewProviders = [this.debugViewProvider, this.memoryViewProvider];
        
        // Register webview providers
        this.registerWebViewProviders();
        // Set up debug session event handlers
        this.setupDebugEventHandlers();
    }

    private registerWebViewProviders() {
        for (const provider of this.viewProviders) {
            this.context.subscriptions.push(
                vscode.window.registerWebviewViewProvider(provider.viewType, provider)
            );
        }
    }

    private setupDebugEventHandlers() {
        // Track debug session events
        // Probably not necessary to track all events, but useful for debugging
        this.context.subscriptions.push(
            vscode.debug.onDidChangeActiveDebugSession((session) => {
                console.log('Active debug session changed:', session?.type);
            })
        );

        // Listen for debug session start
        this.context.subscriptions.push(
            vscode.debug.onDidStartDebugSession((session) => 
                this.resetDebuggerState(session)
            )
        );

        // Listen for debug session termination
        this.context.subscriptions.push(
            vscode.debug.onDidTerminateDebugSession((session) => 
                this.resetDebuggerState(session)
            )
        );

        // Listen for debug stack item changes (automatic pause/resume detection)
        this.context.subscriptions.push(
            vscode.debug.onDidChangeActiveStackItem((stackItem) => {
                console.log('Stack item changed:', stackItem?.constructor.name, 'timestamp:', Date.now());
                const session = vscode.debug.activeDebugSession;
                
                if (!session || session.type !== 'cppdbg') {
                    console.log('No active cppdbg session - setting paused to false');
                    this.setAllWebViewsPaused(false);
                    return;
                }
                
                if (stackItem instanceof vscode.DebugStackFrame) {
                    // Debugger is paused - stack frame available
                    console.log('Debugger paused - updating debug views (timestamp:', Date.now(), ')');
                    
                    // Force show debug view only on first pause of this session
                    if (!this._hasShownDebugViewThisSession) {
                        console.log('First pause this session - forcing debug view to show');
                        this._hasShownDebugViewThisSession = true;

                        for (const provider of this.viewProviders) {
                            provider.forceShowView();
                        }
                    }
                    
                    // Update all debuggable webviews with paused state
                    this.setAllWebViewsPaused(true);
                } else {
                    // Debugger is running or no debug context
                    console.log('Debugger resumed - disabling inputs (timestamp:', Date.now(), ')');
                    this.setAllWebViewsPaused(false);
                }
            })
        );
    }

    private resetDebuggerState(session: vscode.DebugSession) {
        if (session.type === 'cppdbg') {
            // Reset flag when session ends
            this._hasShownDebugViewThisSession = false;
            
            // Reset webview states and update them
            for (const provider of this.viewProviders) {
                provider.resetState();
                provider.setDebuggerPaused(false);
            }
        }
    }

    private setAllWebViewsPaused(paused: boolean) {
        for (const provider of this.viewProviders) {
            provider.setDebuggerPaused(paused);
        }
        
        // When paused, synchronize register values from debug view to memory view
        if (paused) {
            const registerValues = this.debugViewProvider.getRegisterValues();
            this.memoryViewProvider.updateRegisterValues(registerValues);
        }
    }

    // Public methods for external access
    public getDebugViewProvider(): DebugWebViewProvider {
        return this.debugViewProvider;
    }

    public getMemoryViewProvider(): MemoryWebViewProvider {
        return this.memoryViewProvider;
    }

    public getRegisterValues(): {[key: string]: number} {
        return this.debugViewProvider.getRegisterValues();
    }

}