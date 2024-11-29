const vscode = require('vscode');

class FileEditor {
    async editFile(filePath, changes) {
        try {
            const uri = vscode.Uri.file(filePath);
            const edit = new vscode.WorkspaceEdit();
            
            const document = await vscode.workspace.openTextDocument(uri);
            edit.replace(
                uri,
                new vscode.Range(
                    document.positionAt(0),
                    document.positionAt(document.getText().length)
                ),
                changes
            );
            
            await vscode.workspace.applyEdit(edit);
            return true;
        } catch (error) {
            console.error('FileEditor editFile error:', error);
            throw error;
        }
    }

    async showDiff(filePath, originalContent, newContent) {
        // Create a diff view
        const uri = vscode.Uri.file(filePath);
        await vscode.commands.executeCommand('vscode.diff',
            uri.with({ scheme: 'original' }),
            uri.with({ scheme: 'modified' }),
            `${filePath} (Changes)`
        );
    }
}

module.exports = { FileEditor }; 