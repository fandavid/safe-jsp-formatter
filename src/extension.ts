import * as vscode from 'vscode';
import { formatJsp } from './formatter';
import * as packageJson from '../package.json';

export function activate(context: vscode.ExtensionContext) {
    const version = packageJson.version;
    const activateTime = new Date().toLocaleString();
    console.log(`[Safe JSP Formatter v${version}] Activated at ${activateTime}`);

    context.subscriptions.push(
        vscode.languages.registerDocumentFormattingEditProvider({ language: 'jsp', scheme: 'file' }, {
            provideDocumentFormattingEdits(document: vscode.TextDocument, options: vscode.FormattingOptions): vscode.TextEdit[] {
                const now = new Date().toLocaleTimeString();
                console.log(`[${now}] Executing Format (Full Document): ${document.fileName}`);
                
                try {
                    const text = document.getText();
                    const range = new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(text.length)
                    );

                    const formatted = formatJsp(text, options);
                    return [vscode.TextEdit.replace(range, formatted)];
                } catch (err) {
                    console.error('[Safe JSP Formatter] Error during formatting:', err);
                    return [];
                }
            }
        })
    );

    context.subscriptions.push(
        vscode.languages.registerDocumentRangeFormattingEditProvider({ language: 'jsp', scheme: 'file' }, {
            provideDocumentRangeFormattingEdits(document: vscode.TextDocument, range: vscode.Range, options: vscode.FormattingOptions): vscode.TextEdit[] {
                const now = new Date().toLocaleTimeString();
                console.log(`[${now}] Executing Format (Range): ${document.fileName}`);
                
                try {
                    const text = document.getText(range);
                    const formatted = formatJsp(text, options);
                    return [vscode.TextEdit.replace(range, formatted)];
                } catch (err) {
                    console.error('[Safe JSP Formatter] Error during range formatting:', err);
                    return [];
                }
            }
        })
    );
}

export function deactivate() {}