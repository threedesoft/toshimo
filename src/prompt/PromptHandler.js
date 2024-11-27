const vscode = require('vscode');

class PromptHandler {
    constructor(context, aiAgent) {
        this.context = context;
        this.aiAgent = aiAgent;
    }

    async showPromptDialog() {
        const editor = vscode.window.activeTextEditor;
        if (!editor) {
            vscode.window.showErrorMessage('No active editor');
            return;
        }

        const selection = editor.selection;
        const selectedText = editor.document.getText(selection);
        const fileContent = editor.document.getText();

        // Create and show prompt input panel
        const panel = vscode.window.createWebviewPanel(
            'toshomoPrompt',
            'Toshimo Prompt',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true
            }
        );

        panel.webview.html = this._getPromptWebviewContent(selectedText, fileContent);

        // Handle messages from the webview
        panel.webview.onDidReceiveMessage(
            async message => {
                if (message.command === 'submitPrompt') {
                    await this.aiAgent.processPrompt(
                        message.prompt,
                        message.selectedText,
                        message.fileContent
                    );
                    panel.dispose();
                }
            },
            undefined,
            this.context.subscriptions
        );
    }

    _getPromptWebviewContent(selectedText, fileContent) {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Toshimo Prompt</title>
                    <style>
                        body {
                            padding: 20px;
                            color: var(--vscode-foreground);
                            font-family: var(--vscode-font-family);
                        }
                        pre {
                            background-color: var(--vscode-editor-background);
                            padding: 10px;
                            border-radius: 4px;
                            overflow: auto;
                        }
                        textarea {
                            width: 100%;
                            padding: 8px;
                            margin: 10px 0;
                            background-color: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 4px;
                        }
                        button {
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            padding: 8px 16px;
                            border-radius: 4px;
                            cursor: pointer;
                        }
                        button:hover {
                            background-color: var(--vscode-button-hoverBackground);
                        }
                    </style>
                </head>
                <body>
                    <div>
                        <h3>Selected Code:</h3>
                        <pre>${selectedText || 'No code selected'}</pre>
                        
                        <h3>Enter your prompt:</h3>
                        <textarea id="prompt" rows="4" cols="50" placeholder="Describe what you want to do..."></textarea>
                        
                        <button onclick="submitPrompt()">Submit</button>
                    </div>
                    <script>
                        const vscode = acquireVsCodeApi();

                        function submitPrompt() {
                            const prompt = document.getElementById('prompt').value;
                            if (!prompt.trim()) {
                                return;
                            }
                            
                            vscode.postMessage({
                                command: 'submitPrompt',
                                prompt,
                                selectedText: ${JSON.stringify(selectedText)},
                                fileContent: ${JSON.stringify(fileContent)}
                            });
                        }

                        // Handle Enter key
                        document.getElementById('prompt').addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
                                submitPrompt();
                            }
                        });
                    </script>
                </body>
            </html>
        `;
    }
}

module.exports = { PromptHandler }; 