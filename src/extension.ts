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
                
                // Preserve all comments before formatting
                const preservedComments = preserveComments(text);
                
                // Get workspace folder path
                const workspaceFolder = vscode.workspace.getWorkspaceFolder(document.uri);
                const workspacePath = workspaceFolder ? workspaceFolder.uri.fsPath : path.dirname(document.uri.fsPath);

                // Configure Prettier
                const options = await prettier.resolveConfig(workspacePath) || {};
                const pluginPath = require.resolve('prettier-plugin-twig-melody');
                
                // Preserve single-line HTML elements
                const preservedSingleLines = preserveSingleLineElements(preservedComments.text);
                
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

                // Format the document using prettier
                let formatted = await prettier.format(preservedSingleLines.text, formatOptions);
                
                // Restore preserved single-line elements
                formatted = restoreSingleLineElements(formatted, preservedSingleLines.placeholders);
                
                // Apply our custom formatting to twig components
                formatted = formatTwigComponents(formatted);
                
                // Post-process to fix merge operations and path parameters
                formatted = postProcessMergeOperations(formatted);
                formatted = processPathParameters(formatted);
                
                // Restore comments at the very end
                formatted = restoreComments(formatted, preservedComments.placeholders);

                // Return the formatting edits
                const range = new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(text.length)
                );
                
                return [vscode.TextEdit.replace(range, formatted)];
            } catch (error) {
                console.error('Formatting error:', error);
                vscode.window.showErrorMessage(`Error formatting Twig file: ${error instanceof Error ? error.message : String(error)}`);
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

/**
 * Preserves all Twig comments before formatting
 * @param text Original text content
 * @returns Object with the text with placeholders and a map of the original comments
 */
function preserveComments(text: string): { text: string, placeholders: Map<string, string> } {
    const placeholders = new Map<string, string>();
    const commentPattern = /\{#[\s\S]*?#\}/g;
    
    // Replace comments with placeholders
    const processedText = text.replace(commentPattern, (match: string): string => {
        // Generate a unique placeholder
        const placeholder = `__TWIG_COMMENT_${Math.random().toString(36).substring(2, 15)}__`;
        placeholders.set(placeholder, match);
        
        return placeholder;
    });
    
    return { text: processedText, placeholders };
}

/**
 * Restores original comments
 * @param text Text with comment placeholders
 * @param placeholders Map of placeholders to original comments
 * @returns Text with original comments restored
 */
function restoreComments(text: string, placeholders: Map<string, string>): string {
    let result: string = text;
    
    // Replace all placeholders with their original content
    for (const [placeholder, original] of placeholders.entries()) {
        result = result.replace(placeholder, original);
    }
    
    return result;
}

/**
 * Post-processes the formatted text to fix merge operations
 * @param text The formatted text
 * @returns The text with fixed merge operations
 */
function postProcessMergeOperations(text: string): string {
    // Find merge operations in set statements
    // This will match {% set x = y|merge({...}) %} pattern
    const mergeSetPattern: RegExp = /({% *set [^=]+=\s*[^|]+\|\s*merge\s*\(\s*\{)([^}]*?)(\}\s*\)[^%]*%})/g;
    
    return text.replace(mergeSetPattern, (match: string, prefix: string, content: string, suffix: string): string => {
        // Get the indentation level
        const matchIndex: number = text.indexOf(match);
        const lineStart: number = text.lastIndexOf('\n', matchIndex) + 1;
        const baseIndent: string = text.substring(lineStart, matchIndex);
        
        // Process properties to ensure they have quotes and are properly formatted
        const properties: string[] = content.split(',')
            .map((prop: string): string => prop.trim())
            .filter((prop: string): boolean => Boolean(prop))
            .map((prop: string): string => {
                // Add quotes to property names if needed
                const parts: string[] = prop.split(':').map((p: string): string => p.trim());
                if (parts.length < 2) return prop;
                
                const propName: string = parts[0];
                const propValue: string = parts.slice(1).join(':').trim();
                
                if (!propName.startsWith("'") && !propName.startsWith('"')) {
                    return `'${propName}': ${propValue}`;
                }
                
                return prop;
            });
        
        // Always format set statements with merge nicely with proper indentation
        const propIndent: string = baseIndent + '        '; // 8 spaces
        const closingIndent: string = baseIndent + '    ';  // 4 spaces
        
        // Format with proper indentation even if it has only one property
        return `${prefix}\n${propIndent}${properties.join(`,\n${propIndent}`)}\n${closingIndent}${suffix}`;
    });
}

/**
 * Processes path function parameters to format them properly
 * @param text The formatted text
 * @returns The text with consistently formatted path parameters
 */
function processPathParameters(text: string): string {
    // Find path function calls that have object parameters
    // This will match path('route', {...}) pattern within an attribute
    const pathPattern: RegExp = /(path\s*\(\s*['"][^'"]+['"]\s*,\s*\{)([^}]*?)(\}\s*\))/g;
    
    let result = text;
    let match;
    
    // Use exec to get match positions
    while ((match = pathPattern.exec(result)) !== null) {
        const fullMatch = match[0];
        const matchPosition = match.index;
        const prefix = match[1];
        const content = match[2];
        const suffix = match[3];
        
        // Find the route attribute line
        const beforeMatch = result.substring(0, matchPosition);
        const routeAttrPos = beforeMatch.lastIndexOf('route=');
        
        // Only proceed if we found the route attribute (this is inside an element)
        if (routeAttrPos >= 0) {
            // Find the start of the line containing the route attribute
            const lineStart = beforeMatch.lastIndexOf('\n', routeAttrPos) + 1;
            
            // Get the indentation of the attribute line
            const attributeIndent = beforeMatch.substring(lineStart, lineStart + (routeAttrPos - lineStart));
            
            // Process properties
            const properties = content.split(',')
                .map(prop => prop.trim())
                .filter(prop => prop.length > 0)
                .map(prop => {
                    // Add quotes to property names if needed
                    const parts = prop.split(':').map(p => p.trim());
                    if (parts.length < 2) return prop;
                    
                    const propName = parts[0];
                    const propValue = parts.slice(1).join(':').trim();
                    
                    if (!propName.startsWith("'") && !propName.startsWith('"')) {
                        return `'${propName}': ${propValue}`;
                    }
                    
                    return prop;
                });
            
            // Clean up prefix and suffix
            const cleanPrefix = prefix.replace(/path\s*\(\s*/, "path(");
            const cleanSuffix = suffix.replace(/\s*\)/, ")");
            
            // Calculate proper indentation for parameters: attribute indent + 4 spaces
            const paramIndent = attributeIndent + '    ';
            
            // Format the path parameters
            const formattedPath = `${cleanPrefix}\n${paramIndent}${properties.join(`,\n${paramIndent}`)}\n${attributeIndent}${cleanSuffix}`;
            
            // Replace this match in the result
            result = result.substring(0, matchPosition) + formattedPath + result.substring(matchPosition + fullMatch.length);
            
            // Update the regex position to account for the replacement
            pathPattern.lastIndex = matchPosition + formattedPath.length;
        }
    }
    
    return result;
}

// Function to preserve single-line HTML elements
function preserveSingleLineElements(text: string): { text: string, placeholders: Map<string, string> } {
    const placeholders = new Map<string, string>();
    const printWidth = 120; // Match the printWidth from the options
    
    // Find single-line HTML elements with content
    const singleLinePattern = /<([a-zA-Z][a-zA-Z0-9]*)([^>]*)>([^<]+)<\/\1>/g;
    
    // Replace them with placeholders
    const processedText = text.replace(singleLinePattern, (match: string, tagName: string, attributes: string, content: string): string => {
        // Skip if it's a twig component or exceeds print width
        if (tagName.startsWith('twig:') || match.length > printWidth) {
            return match;
        }
        
        // Generate a unique placeholder
        const placeholder = `__HTML_ELEMENT_${Math.random().toString(36).substring(2, 15)}__`;
        placeholders.set(placeholder, match);
        
        return placeholder;
    });
    
    return { text: processedText, placeholders };
}

// Function to restore single-line HTML elements
function restoreSingleLineElements(text: string, placeholders: Map<string, string>): string {
    let result: string = text;
    
    // Replace all placeholders with their original content
    for (const [placeholder, original] of placeholders.entries()) {
        result = result.replace(placeholder, original);
    }
    
    return result;
}

// Function to format Twig components
function formatTwigComponents(text: string): string {
    const lines: string[] = text.split('\n');
    const resultLines: string[] = [];
    
    // Process line by line to maintain proper indentation
    for (let i = 0; i < lines.length; i++) {
        const line: string = lines[i];
        
        // Check if this line contains the start of a twig component
        if (line.trim().startsWith('<twig:') && line.includes('=')) {
            // Get the leading whitespace/indentation
            const indentation: string = line.match(/^\s*/)?.[0] || '';
            
            // Extract the component name
            const componentMatch: RegExpMatchArray | null = line.match(/<(twig:[A-Za-z0-9:]+)/);
            if (!componentMatch) {
                resultLines.push(line);
                continue;
            }
            
            const componentName: string = componentMatch[1];
            
            // Extract attributes from this line and possibly subsequent lines
            const attributes: string[] = [];
            let currentLine: string = line.trim();
            let j: number = i;
            
            // Find the closing of the component tag
            while (j < lines.length && !currentLine.includes('/>') && !currentLine.endsWith('>')) {
                j++;
                if (j < lines.length) {
                    currentLine = lines[j].trim();
                }
            }
            
            // Extract all attributes
            const allContent: string = lines.slice(i, j + 1).join(' ');
            const attrPattern: RegExp = /(\w+)=(?:"([^"]*?)"|'([^']*?)'|(\{\{[\s\S]*?\}\}))/g;
            let attrMatch: RegExpExecArray | null;
            
            while ((attrMatch = attrPattern.exec(allContent)) !== null) {
                const attrName: string = attrMatch[1];
                let attrValue: string = attrMatch[2] || attrMatch[3] || attrMatch[4];
                
                // Clean up Twig expressions in attribute values
                if (attrValue && attrValue.includes('{{')) {
                    // Extract the twig expression
                    const twigMatch: RegExpMatchArray | null = attrValue.match(/\{\{([\s\S]*?)\}\}/);
                    if (twigMatch) {
                        // Clean up whitespace in the Twig expression
                        const cleanExpr: string = twigMatch[1].trim().replace(/\s+/g, ' ');
                        attrValue = `{{ ${cleanExpr} }}`;
                    }
                }
                
                // Add the cleaned attribute
                attributes.push(`${attrName}="${attrValue}"`);
            }
            
            // If we have multiple attributes, format nicely
            if (attributes.length > 1) {
                // Add the opening tag
                resultLines.push(`${indentation}<${componentName}`);
                
                // Add each attribute with proper indentation
                for (const attr of attributes) {
                    resultLines.push(`${indentation}    ${attr}`);
                }
                
                // Add the closing tag
                const isClosing: boolean = allContent.includes('/>');
                resultLines.push(`${indentation}${isClosing ? '/>' : '>'}`);
                
                // Skip the lines we've processed
                i = j;
            } else {
                // Not enough attributes to format specially
                resultLines.push(line);
            }
        } else {
            // Not a twig component or doesn't have attributes
            resultLines.push(line);
        }
    }
    
    return resultLines.join('\n');
}

// This method is called when your extension is deactivated
export function deactivate() {}