const vscode = require('vscode');

class PromptHandler {
    constructor(context, aiAgent) {
        this.context = context;
        this.aiAgent = aiAgent;
        this.messages = [];
        
        // Register the view provider
        const provider = this._createWebviewViewProvider();
        context.subscriptions.push(
            vscode.window.registerWebviewViewProvider('toshimoChatView', provider, {
                webviewOptions: {
                    retainContextWhenHidden: true
                }
            })
        );
    }

    _createWebviewViewProvider() {
        return {
            resolveWebviewView: (webviewView) => {
                this.currentView = webviewView;
                webviewView.webview.options = {
                    enableScripts: true,
                    localResourceRoots: []
                };

                // Initialize with welcome message
                this.messages = [{
                    role: 'assistant',
                    content: 'Hello! I\'m Toshimo, your AI programming assistant. How can I help you today?'
                }];

                webviewView.webview.html = this._getChatWebviewContent();

                webviewView.webview.onDidReceiveMessage(
                    async message => {
                        switch (message.command) {
                            case 'sendMessage':
                                await this.handleUserMessage(message.text);
                                break;
                        }
                    }
                );
            }
        };
    }

    async showPromptDialog() {
        // Focus or show the chat view
        await vscode.commands.executeCommand('toshimoChatView.focus');
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
        if (this.currentView) {
            this.currentView.webview.postMessage({
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
                    <meta charset="UTF-8">
                    <meta name="viewport" content="width=device-width, initial-scale=1.0">
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
                            word-wrap: break-word;
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
                            align-items: flex-end;
                        }
                        
                        #message-input {
                            flex: 1;
                            min-height: 40px;
                            max-height: 200px;
                            padding: 8px;
                            background-color: var(--vscode-input-background);
                            color: var(--vscode-input-foreground);
                            border: 1px solid var(--vscode-input-border);
                            border-radius: 4px;
                            resize: vertical;
                            font-family: var(--vscode-font-family);
                            line-height: 1.4;
                        }
                        
                        #send-button {
                            padding: 8px 16px;
                            height: 40px;
                            background-color: var(--vscode-button-background);
                            color: var(--vscode-button-foreground);
                            border: none;
                            border-radius: 4px;
                            cursor: pointer;
                            font-family: var(--vscode-font-family);
                            white-space: nowrap;
                        }
                        
                        #send-button:hover:not(:disabled) {
                            background-color: var(--vscode-button-hoverBackground);
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
                    <form id="chat-form">
                        <div id="input-container">
                            <textarea 
                                id="message-input" 
                                placeholder="Type your message here... (Press Enter to send)"
                                rows="1"
                            ></textarea>
                            <button type="submit" id="send-button">Send</button>
                        </div>
                    </form>

                    <script>
                        (function() {
                            const vscode = acquireVsCodeApi();
                            const chatContainer = document.getElementById('chat-container');
                            const messageInput = document.getElementById('message-input');
                            const sendButton = document.getElementById('send-button');
                            const chatForm = document.getElementById('chat-form');
                            let isProcessing = false;

                            console.log('Chat interface initialized');

                            function sendMessage(e) {
                                if (e) {
                                    e.preventDefault();
                                }
                                
                                const text = messageInput.value.trim();
                                if (!text || isProcessing) {
                                    console.log('Message empty or processing, ignoring');
                                    return;
                                }
                                
                                console.log('Sending message:', text);
                                isProcessing = true;
                                sendButton.disabled = true;
                                messageInput.disabled = true;
                                
                                vscode.postMessage({
                                    command: 'sendMessage',
                                    text: text
                                });
                                
                                messageInput.value = '';
                                messageInput.style.height = 'auto';
                            }

                            function formatMessage(content) {
                                return content
                                    .replace(/\`\`\`(.*?)\`\`\`/gs, '<pre><code>$1</code></pre>')
                                    .replace(/\`([^\`]+)\`/g, '<code>$1</code>')
                                    .replace(/\\n/g, '<br>')
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
                                
                                if (!messages.some(m => m.id === 'processing')) {
                                    console.log('Re-enabling input');
                                    isProcessing = false;
                                    sendButton.disabled = false;
                                    messageInput.disabled = false;
                                    messageInput.focus();
                                }
                            }

                            // Handle form submission
                            chatForm.addEventListener('submit', sendMessage);

                            // Handle Enter key
                            messageInput.addEventListener('keydown', (e) => {
                                console.log('Key pressed:', e.key);
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    console.log('Enter pressed without shift');
                                    e.preventDefault();
                                    sendMessage();
                                }
                            });

                            // Handle messages from extension
                            window.addEventListener('message', event => {
                                console.log('Received message from extension:', event.data);
                                const message = event.data;
                                switch (message.command) {
                                    case 'updateChat':
                                        updateChat(message.messages);
                                        break;
                                }
                            });

                            // Initialize with welcome message
                            console.log('Initializing chat');
                            updateChat([{
                                role: 'assistant',
                                content: 'Hello! I\\'m Toshimo, your AI programming assistant. How can I help you today?'
                            }]);
                            
                            // Focus input on load
                            messageInput.focus();
                            console.log('Chat interface ready');
                        })();
                    </script>
                </body>
            </html>
        `;
    }
}

module.exports = { PromptHandler }; 