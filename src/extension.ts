// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { enableExtension } from './commands/enable';
import { assemble } from './commands/assemble';
import { run } from './commands/run';
import { DebugWebViewProvider } from './views/debugWebView';
import { DisassemblyWebViewProvider } from './views/disassemblyWebView';

let extensionActive = false;


// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "nasm-tools" is now active!');

	const enableCommand = vscode.commands.registerCommand('nasm-tools.enable', async () => {
		if (extensionActive) {
			vscode.window.showInformationMessage('NASM Tools Extension is already activated');
			return false;
		}
		if (await enableExtension(context,deactivate)) {
			extensionActive = true;
			return true;
		}
		return false;
	});
	context.subscriptions.push(enableCommand);

	if (!enableExtension(context, deactivate)) {
		return false;
	}
	extensionActive = true;
	
	const debugViewProvider = new DebugWebViewProvider(context.extensionUri);
	const disassemblyViewProvider = new DisassemblyWebViewProvider(context.extensionUri);
	
	// Connect the providers so debug view can update disassembly view
	debugViewProvider.setDisassemblyViewProvider(disassemblyViewProvider);
	
	// Connect the debug view to the disassembly view
	debugViewProvider.setDisassemblyViewProvider(disassemblyViewProvider);

	const assembleCommand = vscode.commands.registerCommand('nasm-tools.assemble', async () => {
		if (!extensionActive) {
			vscode.window.showErrorMessage('NASM Tools Extension is not activated');
			return false;
		}

		return await assemble();
	});

	const openDosBoxCommand = vscode.commands.registerCommand('nasm-tools.openDosBox', async () => {
		if (!extensionActive) {
			vscode.window.showErrorMessage('NASM Tools Extension is not activated');
			return;
		}

		const configs = vscode.workspace.getConfiguration('nasm-tools');
		const dosboxCommand = configs.get('dosboxCommand');

		vscode.window.createTerminal("DOSBOX", dosboxCommand as string, ["-c", "MOUNT C .", "-c", "C:"]);
	});

	const runCommand = vscode.commands.registerCommand('nasm-tools.run', async () => {
		if (!extensionActive) {
			vscode.window.showErrorMessage('NASM Tools Extension is not activated');
			return false;
		}

		return await run();
	});

	const debugCommand = vscode.commands.registerCommand('nasm-tools.debug', async () => {
		if (!extensionActive) {
			vscode.window.showErrorMessage('NASM Tools Extension is not activated');
			return false;
		}

		return await run(true, debugViewProvider);
	});

	context.subscriptions.push(assembleCommand);
	context.subscriptions.push(openDosBoxCommand);
	context.subscriptions.push(runCommand);
	context.subscriptions.push(debugCommand);
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(DebugWebViewProvider.viewType, debugViewProvider));
	context.subscriptions.push(vscode.window.registerWebviewViewProvider(DisassemblyWebViewProvider.viewType, disassemblyViewProvider));

	// Track debug session events for the webview
	context.subscriptions.push(vscode.debug.onDidChangeActiveDebugSession((session) => {
		console.log('Active debug session changed:', session?.type);
		// Don't assume paused state here - let onDidChangeActiveStackItem handle it
		// if (session && session.type === 'cppdbg') {
		//     debugViewProvider.setDebuggerPaused(false); // Assume running when session starts
		// }
	}));

	// Listen for debug session start/stop
	context.subscriptions.push(vscode.debug.onDidStartDebugSession((session) => {
		console.log('Debug session started:', session.type);
		// Don't set paused state here - let onDidChangeActiveStackItem handle it
		// if (session.type === 'cppdbg') {
		//     debugViewProvider.setDebuggerPaused(false); // Running when started
		// }
	}));

	context.subscriptions.push(vscode.debug.onDidTerminateDebugSession((session) => {
		console.log('Debug session terminated:', session.type);
		if (session.type === 'cppdbg') {
			debugViewProvider.setDebuggerPaused(false); // Not paused when terminated
		}
	}));

	// Listen for debug stack item changes (automatic pause/resume detection)
	context.subscriptions.push(vscode.debug.onDidChangeActiveStackItem((stackItem) => {
		console.log('Stack item changed:', stackItem?.constructor.name, 'timestamp:', Date.now());
		
		const session = vscode.debug.activeDebugSession;
		if (!session || session.type !== 'cppdbg') {
			console.log('No active cppdbg session - setting paused to false');
			debugViewProvider.setDebuggerPaused(false);
			return;
		}
		
		if (stackItem instanceof vscode.DebugStackFrame) {
			// Debugger is paused - stack frame available
			console.log('Debugger paused - updating debug view (timestamp:', Date.now(), ')');
			debugViewProvider.setDebuggerPaused(true);
		} else {
			// Debugger is running or no debug context
			console.log('Debugger resumed - disabling inputs (timestamp:', Date.now(), ')');
			debugViewProvider.setDebuggerPaused(false);
		}
	}));
}

// This method is called when your extension is deactivated
export function deactivate() {
	extensionActive = false;
}
