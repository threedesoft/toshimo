const vscode = require('vscode');
const path = require('path');
const { ErrorHandler } = require('../utils/ErrorHandler');
const { LLMService } = require('../services/LLMService');
const { TerminalCommandManager } = require('../terminal/TerminalCommandManager');

class AIAgent {
    constructor(configManager, contextManager) {
        this.llmService = new LLMService(configManager);
        this.terminalManager = new TerminalCommandManager();
        this.contextManager = contextManager;
        this.userAnswers = {};
    }

    async processPrompt(prompt, selectedText, fileContent) {
        try {
            console.log('AIAgent processing prompt:', {
                prompt,
                hasSelectedText: !!selectedText,
                hasFileContent: !!fileContent
            });

            // Get relevant context including selected text and file content
            const context = await this.contextManager.getRelevantContext(
                `${prompt}\n\nSelected Text:\n${selectedText}\n\nFile Content:\n${fileContent}`
            );

            console.log('Got context:', context);

            // Generate initial response from LLM
            let response = await this.llmService.generateResponse(prompt, context);
            
            console.log('Got LLM response:', response);

            // Handle questions if any
            while (response.requiresUserInput && response.questions?.length) {
                const answers = await this.handleQuestions(response.questions);
                this.userAnswers = { ...this.userAnswers, ...answers };
                
                // Get updated response with answers
                response = await this.llmService.generateResponse(prompt, context);
            }

            // Process the final response
            return await this.processResponse(response);
        } catch (error) {
            console.error('Error in AIAgent.processPrompt:', error);
            return {
                content: `Error: ${error.message}`,
                changes: [],
                commands: []
            };
        }
    }

    async processResponse(response) {
        try {
            console.log('Processing AI response:', response);

            // Handle file changes
            if (response.changes && response.changes.length > 0) {
                for (const change of response.changes) {
                    await this.applyFileChange(change);
                }
            }

            // Execute commands if any
            if (response.commands && response.commands.length > 0) {
                for (const command of response.commands) {
                    await this.terminalManager.executeCommand(command);
                }
            }

            // Show the response content
            const editor = vscode.window.activeTextEditor;
            if (editor && response.content) {
                await vscode.window.showInformationMessage(response.content);
            }

            return response;
        } catch (error) {
            ErrorHandler.handle(error, 'AIAgent.processResponse');
            throw error;
        }
    }

    async applyFileChange(change) {
        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new Error('No workspace folder found');
            }

            const filePath = path.join(workspaceFolders[0].uri.fsPath, change.file);
            const fileUri = vscode.Uri.file(filePath);

            // Create or update the file
            const edit = new vscode.WorkspaceEdit();
            try {
                await vscode.workspace.fs.stat(fileUri);
                // File exists, update it
                const document = await vscode.workspace.openTextDocument(fileUri);
                edit.replace(
                    fileUri,
                    new vscode.Range(
                        document.positionAt(0),
                        document.positionAt(document.getText().length)
                    ),
                    change.content
                );
            } catch {
                // File doesn't exist, create it
                edit.createFile(fileUri, { overwrite: true });
                edit.insert(fileUri, new vscode.Position(0, 0), change.content);
            }

            await vscode.workspace.applyEdit(edit);
        } catch (error) {
            ErrorHandler.handle(error, 'AIAgent.applyFileChange');
            throw error;
        }
    }
}

module.exports = { AIAgent }; 