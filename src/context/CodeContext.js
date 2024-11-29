const vscode = require('vscode');
const path = require('path');
const os = require('os');
const fs = require('fs/promises');

class CodeContext {
    constructor() {
        this.platform = os.platform();
        this.contextFiles = new Map(); // Store file contexts with their paths as keys
        this.currentFile = null;
        this.workspaceRoot = null;
    }

    async initialize() {
        // Initial setup only
        await this.updateCurrentFile();
    }

    async updateCurrentFile() {
        try {
            // Update workspace root
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (workspaceFolders) {
                this.workspaceRoot = this.normalizePath(workspaceFolders[0].uri.fsPath);
            } else {
                this.workspaceRoot = null;
            }

            // Get current file
            const activeEditor = vscode.window.activeTextEditor;
            if (activeEditor) {
                await this.addFileToContext(activeEditor.document.uri.fsPath, true);
            } else {
                this.currentFile = null;
                // Reset current status of all files
                for (const [_, context] of this.contextFiles) {
                    context.isCurrent = false;
                }
            }

            console.log('Updated CodeContext:', {
                workspaceRoot: this.workspaceRoot,
                currentFile: this.currentFile,
                totalFiles: this.contextFiles.size
            });
        } catch (error) {
            console.error('Error updating current file and workspace:', error);
        }
    }

    async addFileToContext(filePath, isCurrent = false) {
        try {
            const normalizedPath = this.normalizePath(filePath);
            const content = await fs.readFile(normalizedPath, 'utf8');
            
            const fileContext = {
                path: normalizedPath,
                relativePath: this.workspaceRoot ? path.relative(this.workspaceRoot, normalizedPath) : normalizedPath,
                content: content,  // Store the entire file content
                isCurrent
            };

            if (isCurrent) {
                this.currentFile = normalizedPath;
                // Update previous current file
                for (const [path, context] of this.contextFiles) {
                    if (path !== normalizedPath) {
                        context.isCurrent = false;
                    }
                }
            }

            this.contextFiles.set(normalizedPath, fileContext);
        } catch (error) {
            console.error(`Error adding file to context: ${filePath}`, error);
        }
    }

    normalizePath(filePath) {
        // Normalize path separators based on OS
        return this.platform === 'win32' 
            ? filePath.replace(/\//g, '\\')
            : filePath.replace(/\\/g, '/');
    }

    getFormattedContext() {
        const lines = ['<CodeContext>'];
        
        // Add current folder
        lines.push(`Current Folder: ${this.workspaceRoot || 'No workspace folder'}`);
        lines.push('');
        
        // Add contextual file list
        lines.push('Contextual File List');
        let fileCount = 1;
        
        // Update current file before formatting context
        const activeEditor = vscode.window.activeTextEditor;
        if (activeEditor) {
            const currentFilePath = this.normalizePath(activeEditor.document.uri.fsPath);
            if (currentFilePath !== this.currentFile) {
                this.addFileToContext(currentFilePath, true);
            }
        }
        
        // Add current file first
        for (const [filePath, context] of this.contextFiles) {
            if (context.isCurrent) {
                lines.push(`${fileCount}. Current File: ${context.relativePath}`);
                lines.push('File Content:');
                lines.push('```');
                lines.push(context.content);
                lines.push('```');
                lines.push('');
                fileCount++;
                break;
            }
        }
        
        // Add other files
        for (const [filePath, context] of this.contextFiles) {
            if (!context.isCurrent) {
                lines.push(`${fileCount}. File: ${context.relativePath}`);
                lines.push('File Content:');
                lines.push('```');
                lines.push(context.content);
                lines.push('```');
                lines.push('');
                fileCount++;
            }
        }
        
        lines.push('</CodeContext>');
        return lines.join('\n');
    }
}

module.exports = { CodeContext }; 