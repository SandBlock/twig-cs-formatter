// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as path from 'path';
import type { Options } from 'prettier';
import * as prettier from 'prettier';
import * as vscode from 'vscode';

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {
	// Register the formatter
	let disposable = vscode.languages.registerDocumentFormattingEditProvider('twig', {
		async provideDocumentFormattingEdits(document: vscode.TextDocument): Promise<vscode.TextEdit[]> {
			try {
				const text = document.getText();
				
				// Get workspace folder path
				const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
				const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);

				// Configure Prettier
				const options = await prettier.resolveConfig(workspacePath) || {};
				const pluginPath = require.resolve('prettier-plugin-twig-melody');

				// Merge with our default options
				const formatOptions: Options = {
					...options,
					parser: 'melody',
					plugins: [pluginPath],
					printWidth: 120,
					tabWidth: 4,
					singleQuote: false,
					bracketSpacing: true,
					semi: true,
					htmlWhitespaceSensitivity: 'ignore' as const,
					filepath: document.fileName
				};

				// Format the document
				const formatted = await prettier.format(text, formatOptions);

				// Return the formatting edits
				const range = new vscode.Range(
					document.positionAt(0),
					document.positionAt(text.length)
				);
				
				return [vscode.TextEdit.replace(range, formatted)];
			} catch (error) {
				console.error('Formatting error:', error);
				vscode.window.showErrorMessage(`Error formatting Twig file: ${error}`);
				return [];
			}
		}
	});

	context.subscriptions.push(disposable);

	// Register the format command
	let formatCommand = vscode.commands.registerCommand('twig-cs-formatter.formatDocument', () => {
		const editor = vscode.window.activeTextEditor;
		if (editor && editor.document.languageId === 'twig') {
			vscode.commands.executeCommand('editor.action.formatDocument');
		}
	});

	context.subscriptions.push(formatCommand);

	console.log('Twig CS Formatter is now active!');
}

// This method is called when your extension is deactivated
export function deactivate() {}
