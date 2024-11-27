const vscode = require('vscode');

class PromptHandler {
    constructor(context, aiAgent) {
        this.context = context;
        this.aiAgent = aiAgent;
        this.currentPanel = null;
        this.messages = [];
    }

    async showPromptDialog() {
        if (this.currentPanel) {
            this.currentPanel.reveal();
            return;
        }

        this.currentPanel = vscode.window.createWebviewPanel(
            'toshimoChat',
            'Chat with Toshimo',
            vscode.ViewColumn.Beside,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        // Initialize with welcome message
        this.messages = [{
            role: 'assistant',
            content: 'Hello! I\'m Toshimo, your AI programming assistant. How can I help you today?'
        }];

        this.currentPanel.webview.html = this._getChatWebviewContent();

        this.currentPanel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'sendMessage':
                        await this.handleUserMessage(message.text);
                        break;
                }
            },
            undefined,
            this.context.subscriptions
        );

        this.currentPanel.onDidDispose(
            () => {
                this.currentPanel = null;
            },
            null,
            this.context.subscriptions
        );
    }

    async handleUserMessage(text) {
        try {
            // Add user message to chat
            this.messages.push({
                role: 'user',
                content: text
            });
            this._updateChatView();

            // Get active editor info
            const editor = vscode.window.activeTextEditor;
            const selectedText = editor ? editor.document.getText(editor.selection) : '';
            const fileContent = editor ? editor.document.getText() : '';

            // Show processing state
            this.messages.push({
                role: 'system',
                content: '⏳ Processing your request...',
                id: 'processing'
            });
            this._updateChatView();

            try {
                // Process with AI and get response
                const response = await this.aiAgent.processPrompt(text, selectedText, fileContent);

                // Remove processing message
                this.messages = this.messages.filter(m => m.id !== 'processing');

                // Add AI response to chat
                if (response.content) {
                    this.messages.push({
                        role: 'assistant',
                        content: response.content
                    });
                }

                // Handle file changes
                if (response.changes && response.changes.length > 0) {
                    const changeMessages = await this.handleFileChanges(response.changes);
                    this.messages.push(...changeMessages);
                }

                // Handle terminal commands
                if (response.commands && response.commands.length > 0) {
                    this.messages.push({
                        role: 'system',
                        content: `🚀 Executing commands:\n\`\`\`bash\n${response.commands.join('\n')}\`\`\``
                    });
                }

            } catch (error) {
                // Remove processing message
                this.messages = this.messages.filter(m => m.id !== 'processing');
                
                // Add error message
                this.messages.push({
                    role: 'system',
                    content: `❌ Error: ${error.message}`
                });
            }

            this._updateChatView();

        } catch (error) {
            console.error('Error handling message:', error);
            this.messages.push({
                role: 'system',
                content: `❌ Error: ${error.message}`
            });
            this._updateChatView();
        }
    }

    async handleFileChanges(changes) {
        const messages = [];
        
        for (const change of changes) {
            try {
                // Create diff view
                const uri = vscode.Uri.file(change.file);
                let originalContent = '';
                try {
                    const document = await vscode.workspace.openTextDocument(uri);
                    originalContent = document.getText();
                } catch {
                    // File doesn't exist yet
                }

                // Show diff in chat
                messages.push({
                    role: 'system',
                    content: `📝 Changes to \`${change.file}\`:\n\`\`\`diff\n${this.createDiff(originalContent, change.content)}\`\`\``
                });

            } catch (error) {
                messages.push({
                    role: 'system',
                    content: `❌ Error processing changes for ${change.file}: ${error.message}`
                });
            }
        }

        return messages;
    }

    createDiff(originalContent, newContent) {
        const original = originalContent.split('\n');
        const modified = newContent.split('\n');
        let diff = '';

        for (let i = 0; i < Math.max(original.length, modified.length); i++) {
            if (i < original.length && i < modified.length) {
                if (original[i] !== modified[i]) {
                    diff += `- ${original[i]}\n+ ${modified[i]}\n`;
                } else {
                    diff += `  ${original[i]}\n`;
                }
            } else if (i < original.length) {
                diff += `- ${original[i]}\n`;
            } else {
                diff += `+ ${modified[i]}\n`;
            }
        }

        return diff;
    }

    _updateChatView() {
        if (this.currentPanel) {
            this.currentPanel.webview.postMessage({
                command: 'updateChat',
                messages: this.messages
            });
        }
    }

    _getChatWebviewContent() {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <style>
                        body {
                            padding: 0;
                            margin: 0;
                            height: 100vh;
                            display: flex;
                            flex-direction: column;
                            font-family: var(--vscode-font-family);
                            color: var(--vscode-foreground);
                            background-color: var(--vscode-editor-background);
                        }
                        
                        #chat-container {
                            flex: 1;
                            overflow-y: auto;
                            padding: 20px;
                            display: flex;
                            flex-direction: column;
                            gap: 12px;
                        }
                        
                        .message {
                            max-width: 80%;
                            padding: 10px 16px;
                            border-radius: 12px;
                            margin: 4px 0;
                            white-space: pre-wrap;
                        }
                        
                        .user-message {
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            align-self: flex-end;
                        }
                        
                        .assistant-message {
                            background-color: var(--vscode-input-background);
                            border: 1px solid var(--vscode-input-border);
                            align-self: flex-start;
                        }
                        
                        .system-message {
                            background-color: var(--vscode-editor-background);
                            border: 1px solid var(--vscode-input-border);
                            color: var(--vscode-foreground);
                            opacity: 0.8;
                            align-self: center;
                            font-size: 0.9em;
                        }
                        
                        #input-container {
                            padding: 20px;
                            background-color: var(--vscode-editor-background);
                            border-top: 1px solid var(--vscode-input-border);
                            display: flex;
                            gap: 10px;
                        }
                        
                        #message-input {
                            flex: 1;
                            padding: 8px;
                            background-color: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 4px;
                            resize: none;
                            font-family: var(--vscode-font-family);
                            min-height: 40px;
                        }
                        
                        #send-button {
                            padding: 8px 16px;
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-family: var(--vscode-font-family);
                            align-self: flex-end;
                        }
                        
                        #send-button:disabled {
                            opacity: 0.5;
                            cursor: not-allowed;
                        }

                        pre {
                            background-color: var(--vscode-editor-background);
                            padding: 10px;
                            border-radius: 4px;
                            overflow-x: auto;
                            margin: 8px 0;
                        }

                        code {
                            font-family: var(--vscode-editor-font-family);
                            font-size: var(--vscode-editor-font-size);
                        }

                        .diff-add {
                            color: var(--vscode-gitDecoration-addedResourceForeground);
                        }

                        .diff-remove {
                            color: var(--vscode-gitDecoration-deletedResourceForeground);
                        }
                    </style>
                </head>
                <body>
                    <div id="chat-container"></div>
                    <div id="input-container">
                        <textarea 
                            id="message-input" 
                            placeholder="Type your message here... (Press Enter to send)"
                        ></textarea>
                        <button id="send-button">Send</button>
                    </div>
                    <script>
                        const vscode = acquireVsCodeApi();
                        const chatContainer = document.getElementById('chat-container');
                        const messageInput = document.getElementById('message-input');
                        const sendButton = document.getElementById('send-button');
                        let isProcessing = false;

                        function sendMessage() {
                            const text = messageInput.value.trim();
                            if (!text || isProcessing) return;
                            
                            console.log('Sending message:', text);
                            
                            isProcessing = true;
                            sendButton.disabled = true;
                            messageInput.disabled = true;
                            
                            vscode.postMessage({
                                command: 'sendMessage',
                                text: text
                            });
                            
                            messageInput.value = '';
                        }

                        function formatMessage(content) {
                            return content
                                .replace(/\`\`\`(\w+)\n([\s\S]*?)\`\`\`/g, '<pre><code class="language-$1">$2</code></pre>')
                                .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                                .replace(/\n/g, '<br>')
                                .replace(/^- (.*)$/gm, '• $1');
                        }

                        function updateChat(messages) {
                            console.log('Updating chat with messages:', messages);
                            chatContainer.innerHTML = messages.map(msg => {
                                const className = msg.role === 'user' ? 'user-message' : 
                                                msg.role === 'system' ? 'system-message' : 
                                                'assistant-message';
                                return \`<div class="message \${className}">\${formatMessage(msg.content)}</div>\`;
                            }).join('');
                            
                            chatContainer.scrollTop = chatContainer.scrollHeight;
                            
                            // Re-enable input if not processing
                            if (!messages.some(m => m.id === 'processing')) {
                                isProcessing = false;
                                sendButton.disabled = false;
                                messageInput.disabled = false;
                                messageInput.focus();
                            }
                        }

                        // Handle Enter key
                        messageInput.addEventListener('keydown', (e) => {
                            if (e.key === 'Enter' && !e.shiftKey) {
                                e.preventDefault();
                                sendMessage();
                            }
                        });

                        // Handle Send button click
                        sendButton.addEventListener('click', () => {
                            sendMessage();
                        });

                        // Handle messages from extension
                        window.addEventListener('message', event => {
                            const message = event.data;
                            switch (message.command) {
                                case 'updateChat':
                                    updateChat(message.messages);
                                    break;
                            }
                        });

                        // Initialize with empty chat
                        updateChat([{
                            role: 'assistant',
                            content: 'Hello! I\'m Toshimo, your AI programming assistant. How can I help you today?'
                        }]);
                        
                        // Focus input on load
                        messageInput.focus();
                    </script>
                </body>
            </html>
        `;
    }
}

module.exports = { PromptHandler }; 