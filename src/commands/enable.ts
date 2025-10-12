import * as vscode from 'vscode';
import commandExists from 'command-exists';
import { existsSync } from 'fs';
import { join } from 'path';
import { ToolchainManager } from '../managers/toolchainManager';

export async function enableExtension(context :vscode.ExtensionContext ,deactivate: ()=>void) {
	// Check Current OS
	// const os = process.platform;
	// if (os !== 'win32') {
	// 	vscode.window.showErrorMessage('This extension only works on Windows');
	// 	return false;
	// }

	const configs = vscode.workspace.getConfiguration('nasm-tools');
	
	// Check if NASM Exists
	const nasmPath = configs.get('nasmCommand') as string;
	if (!commandExists.sync(nasmPath)) {
		// Check if nasm console command exists
		if (commandExists.sync('nasm')) {
			vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', 'nasm', vscode.ConfigurationTarget.Global);
		} else {
			const choices = [];
			const package_managers = ['winget','pacman', 'apt', 'yum', 'dnf', 'brew'];
			let command = "-1"; //Set to impossible value as default option
			for (let i = 0; i < package_managers.length; i++) {
				const element = package_managers[i];
				if(commandExists.sync(element)){
					command = element;
					choices.push('Install NASM Using ' + command);
					break;
				}	
			}
			if(command === '-1')
			{
				vscode.window.showErrorMessage('Failed to find a package manager to install NASM, you will have to do this yourself.');
			}
			const choice = await vscode.window.showInformationMessage('NASM is not installed.', ...choices, 'Disable Extension');
			if (choice === 'Install NASM Using winget') {
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('winget install -e --id NASM.NASM -h');
				terminal.sendText('exit');
				// Wait for install to complete
				while (terminal.exitStatus === undefined) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				if (existsSync(join(process.env.APPDATA || "/", "../Local/bin/NASM/nasm.exe"))) {
					vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', join(process.env.APPDATA || "/", "../Local/bin/NASM/nasm.exe"), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage('NASM Installed');
				} else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			} 
			else if(choice === 'Install NASM Using pacman'){
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('sudo pacman -S --noconfirm nasm && exit');
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('nasm')){
				  vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', '/usr/bin/nasm', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('NASM Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install NASM Using apt'){
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('sudo apt install -y nasm && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('nasm')){
				  vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', '/usr/bin/nasm', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('NASM Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install NASM Using yum'){
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('sudo yum install -y nasm && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('nasm')){
				  vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', '/usr/bin/nasm', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('NASM Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install NASM Using dnf'){
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('sudo dnf install -y nasm && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('nasm')){
				  vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', '/usr/bin/nasm', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('NASM Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install NASM Using brew'){
				const terminal = vscode.window.createTerminal('Install NASM');
				terminal.show();
				terminal.sendText('brew install nasm && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('nasm')){
				  vscode.workspace.getConfiguration('nasm-tools').update('nasmCommand', '/usr/bin/nasm', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('NASM Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install NASM, NASM Tools Extension not activated.');
					console.log('Failed to install NASM');
					deactivate();
					return false;
				}
			}
			else {
				console.log('NASM is not installed, NASM Tools Extension not activated.');
				deactivate();
				return false;
			}
		}
	}

	// Check If DOSBOX Exists
		const dosboxPath = configs.get('dosboxCommand') as string;
	if (!commandExists.sync(dosboxPath)) {
		// Check if dosbox console command exists
		if (commandExists.sync('dosbox')) {
			vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', 'dosbox', vscode.ConfigurationTarget.Global);
		} else if (commandExists.sync('dosbox-x')) {
			vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', 'dosbox-x', vscode.ConfigurationTarget.Global);
		} else {
			const choices = [];
			const package_managers = ['winget','pacman', 'apt', 'yum', 'dnf', 'brew'];
			let command = "-1"; //Set to impossible value as default option
			for (let i = 0; i < package_managers.length; i++) {
				const element = package_managers[i];
				if(commandExists.sync(element)){
					command = element;
					choices.push('Install DOSBOX Using ' + command);
					break;
				}	
			}
			if(command === '-1')
			{
				vscode.window.showErrorMessage('Failed to find a package manager to install DOSBOX, you will have to do this yourself.');
			}
			const choice = await vscode.window.showInformationMessage('DOSBOX or DOSBOX-X is not installed.', ...choices, 'Disable Extension');
			if (choice === 'Install DOSBOX Using winget') {
				const terminal = vscode.window.createTerminal('Install DOSBOX-X');
				terminal.show();
				terminal.sendText('winget install -e --id joncampbell123.DOSBox-X -h');
				terminal.sendText('exit');
				// Wait for install to complete
				while (terminal.exitStatus === undefined) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				if (existsSync(join("C:/DOSBOX-X/dosbox-x.exe"))) {
					vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', join("C:/DOSBOX-X/dosbox-x.exe"), vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage('DOSBOX-X Installed');
				} else {
					vscode.window.showErrorMessage('Failed to install DOSBOX-X, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX-X');
					deactivate();
					return false;
				}
			} 
			else if (choice === 'Install DOSBOX Using brew') {
				const terminal = vscode.window.createTerminal('Install DOSBOX-X');
				terminal.show();
				terminal.sendText('brew install dosbox-x && exit');
				// Wait for install to complete
				while (terminal.exitStatus === undefined) {
					await new Promise(resolve => setTimeout(resolve, 500));
				}
				// Check if DOSBox-X is installed
				if (commandExists.sync('dosbox-x')) { // Adjust the path if Homebrew installs it elsewhere
					vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', '/usr/local/bin/dosbox-x', vscode.ConfigurationTarget.Global);
					vscode.window.showInformationMessage('DOSBOX-X Installed');
				} else {
					vscode.window.showErrorMessage('Failed to install DOSBOX-X, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX-X');
					deactivate();
					return false;
				}
			}			
			else if(choice === 'Install DOSBOX Using pacman'){
				const terminal = vscode.window.createTerminal('Install DOSBOX');
				terminal.show();
				terminal.sendText('sudo pacman -S dosbox && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('dosbox')){
				  vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', '/usr/bin/dosbox', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('DosBox Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install DOSBOX, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install DOSBOX Using apt'){
				const terminal = vscode.window.createTerminal('Install DOSBOX');
				terminal.show();
				terminal.sendText('sudo apt install dosbox && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('dosbox')){
				  vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', '/usr/bin/dosbox', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('DosBox Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install DOSBOX, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install DOSBOX Using yum'){
				const terminal = vscode.window.createTerminal('Install DOSBOX');
				terminal.show();
				terminal.sendText('sudo yum install -y epel-release && yum install -y dosbox && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('dosbox')){
				  vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', '/usr/bin/dosbox', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('DosBox Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install DOSBOX, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX');
					deactivate();
					return false;
				}
			}
			else if(choice === 'Install DOSBOX Using dnf'){
				const terminal = vscode.window.createTerminal('Install DOSBOX');
				terminal.show();
				terminal.sendText('sudo dnf install -y dosbox && exit');			
	
				while(terminal.exitStatus === undefined){
				  await new Promise(resolve => setTimeout(resolve, 500));
				}
				if(commandExists.sync('dosbox')){
				  vscode.workspace.getConfiguration('nasm-tools').update('dosboxCommand', '/usr/bin/dosbox', vscode.ConfigurationTarget.Global);
				  vscode.window.showInformationMessage('DosBox Installed');
				}
				else {
					vscode.window.showErrorMessage('Failed to install DOSBOX, NASM Tools Extension not activated.');
					console.log('Failed to install DOSBOX');
					deactivate();
					return false;
				}
			}
			else {
				console.log('DOSBOX-X or DOSBOX is not installed, NASM Tools Extension not activated.');
				deactivate();
				return false;
			}
		}
	}

	// Check if GDB exists (for debugging support)
	if (process.platform === 'linux' && !commandExists.sync('gdb')) {
		const package_managers = ['apt', 'pacman', 'yum', 'dnf'];
		let gdbCommand = "-1";
		
		for (let i = 0; i < package_managers.length; i++) {
			const element = package_managers[i];
			if(commandExists.sync(element)){
				gdbCommand = element;
				break;
			}	
		}
		
		if(gdbCommand !== '-1') {
			vscode.window.showInformationMessage('GDB not found. Installing GDB automatically...');
			
			const terminal = vscode.window.createTerminal('Install GDB');
			terminal.show();
			
			if (gdbCommand === 'apt') {
				terminal.sendText('sudo apt install -y gdb && exit');
			}
			else if (gdbCommand === 'pacman') {
				terminal.sendText('sudo pacman -S --noconfirm gdb && exit');
			}
			else if (gdbCommand === 'yum') {
				terminal.sendText('sudo yum install -y gdb && exit');
			}
			else if (gdbCommand === 'dnf') {
				terminal.sendText('sudo dnf install -y gdb && exit');
			}
			
			while(terminal.exitStatus === undefined){
				await new Promise(resolve => setTimeout(resolve, 500));
			}
			
			if(commandExists.sync('gdb')){
				vscode.window.showInformationMessage('GDB installed successfully');
			} else {
				vscode.window.showWarningMessage('Failed to install GDB. Switching to AFD debugger.');
				vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
			}
		} else {
			// No supported package manager found, fallback to AFD
			vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
			vscode.window.showWarningMessage('No supported package manager found for GDB installation. Switching to AFD debugger.');
		}
	}

	// Check if ld exists (part of binutils package)
	if (process.platform === 'linux' && !commandExists.sync('ld')) {
		const package_managers = ['apt', 'pacman', 'yum', 'dnf'];
		let binutilsCommand = "-1";
		
		for (let i = 0; i < package_managers.length; i++) {
			const element = package_managers[i];
			if(commandExists.sync(element)){
				binutilsCommand = element;
				break;
			}	
		}
		
		if(binutilsCommand !== '-1') {
			vscode.window.showInformationMessage('Linker (ld) not found. Installing binutils automatically...');
			
			const terminal = vscode.window.createTerminal('Install Binutils');
			terminal.show();
			
			if (binutilsCommand === 'apt') {
				terminal.sendText('sudo apt install -y binutils && exit');
			}
			else if (binutilsCommand === 'pacman') {
				terminal.sendText('sudo pacman -S --noconfirm binutils && exit');
			}
			else if (binutilsCommand === 'yum') {
				terminal.sendText('sudo yum install -y binutils && exit');
			}
			else if (binutilsCommand === 'dnf') {
				terminal.sendText('sudo dnf install -y binutils && exit');
			}
			
			while(terminal.exitStatus === undefined){
				await new Promise(resolve => setTimeout(resolve, 500));
			}
			
			if(commandExists.sync('ld')){
				vscode.window.showInformationMessage('Binutils (ld) installed successfully');
			} else {
				vscode.window.showWarningMessage('Failed to install binutils. Linker may not be available.');
			}
		} else {
			vscode.window.showWarningMessage('No supported package manager found for binutils installation.');
		}
	}

	// check if C/C++ extension is installed
	const cppExtension = vscode.extensions.getExtension('ms-vscode.cpptools');

	if (!cppExtension) {
		const choice = await vscode.window.showInformationMessage(
			'C/C++ extension is required for GDB debugging. Would you like to install it?',
			'Install C/C++ Extension',
			'Use AFD Instead'
		);
		
		if (choice === 'Install C/C++ Extension') {
			vscode.commands.executeCommand('workbench.extensions.installExtension', 'ms-vscode.cpptools');
			vscode.window.showInformationMessage('C/C++ extension installation started. Please reload VS Code after installation.');
		} else if (choice === 'Use AFD Instead') {
			vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage('Debugger set to AFD mode.');
		}
	}

	// Initialize and check toolchain availability for ELF debugging
	const toolchainManager = new ToolchainManager(context);
	
	// Check if toolchain is available, if not try to set it up
	if (!toolchainManager.isToolchainInstalled()) {
		const choice = await vscode.window.showInformationMessage(
			'ELF debugging toolchain is not available. Would you like to set it up?',
			'Setup Toolchain',
			'Use AFD Only'
		);
		
		if (choice === 'Setup Toolchain') {
			vscode.window.showInformationMessage('Setting up toolchain for ELF debugging. Please wait...');
			try {
				const success = await toolchainManager.ensureToolchainAvailable();
				if (success) {
					vscode.window.showInformationMessage('Toolchain setup completed successfully');
				} else {
					vscode.window.showWarningMessage('Toolchain setup failed. ELF debugging will not be available.');
				}
			} catch (error) {
				console.error('Toolchain setup error:', error);
				vscode.window.showWarningMessage('Toolchain setup failed. ELF debugging will not be available.');
			}
		} else if (choice === 'Use AFD Only') {
			vscode.workspace.getConfiguration('nasm-tools').update('debuggerType', 'afd', vscode.ConfigurationTarget.Global);
			vscode.window.showInformationMessage('Debugger set to AFD mode only.');
		}
	}

	const otherConfigs = vscode.workspace.getConfiguration("nasm");
	vscode.window.showInformationMessage(otherConfigs.get("nasmPath") || "undefined");
	otherConfigs.update("nasmPath", configs.get('nasmCommand'), vscode.ConfigurationTarget.Global);
	vscode.window.showInformationMessage('NASM Tools Extension Activated');
	console.log(configs.get('nasmCommand'));
	console.log(configs.get('dosboxCommand'));
	return true;
}
