const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');

class FileManager {
    constructor() {
        this.workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
    }

    async createFile(filePath, content) {
        try {
            const fullPath = path.join(this.workspaceRoot, filePath);
            const dir = path.dirname(fullPath);
            await fs.mkdir(dir, { recursive: true });
            await fs.writeFile(fullPath, content);
            return true;
        } catch (error) {
            console.error('FileManager createFile error:', error);
            throw error;
        }
    }

    async readFile(filePath) {
        try {
            const fullPath = path.join(this.workspaceRoot, filePath);
            return await fs.readFile(fullPath, 'utf8');
        } catch (error) {
            console.error('FileManager readFile error:', error);
            throw error;
        }
    }

    async fileExists(filePath) {
        try {
            const fullPath = path.join(this.workspaceRoot, filePath);
            await fs.access(fullPath);
            return true;
        } catch {
            return false;
        }
    }
}

module.exports = { FileManager }; 