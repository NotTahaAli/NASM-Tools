// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { enableExtension } from './commands/enable';
import { assemble } from './commands/assemble';
import { run } from './commands/run';

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

		return await run(true);
	});

	context.subscriptions.push(assembleCommand);
	context.subscriptions.push(openDosBoxCommand);
	context.subscriptions.push(runCommand);
	context.subscriptions.push(debugCommand);
}

// This method is called when your extension is deactivated
export function deactivate() {
	extensionActive = false;
}
