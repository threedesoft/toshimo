const vscode = require('vscode');

class ConfigurationPanel {
    static currentPanel;

    constructor(panel, configManager) {
        this._panel = panel;
        this._configManager = configManager;
        this._disposables = [];

        this._update();
        
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);
    }

    static createOrShow(_context, configManager) {
        if (ConfigurationPanel.currentPanel) {
            ConfigurationPanel.currentPanel._panel.reveal(vscode.ViewColumn.One);
            return;
        }

        const panel = vscode.window.createWebviewPanel(
            'toshomoConfig',
            'Toshimo Configuration',
            vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true
            }
        );

        ConfigurationPanel.currentPanel = new ConfigurationPanel(panel, configManager);
    }

    _update() {
        const currentConfig = this._configManager.getLLMConfig();
        this._panel.webview.html = this._getWebviewContent(currentConfig);
        this._panel.webview.onDidReceiveMessage(
            async message => {
                switch (message.command) {
                    case 'updateConfig':
                        await this._configManager.updateLLMConfig(message.config);
                        break;
                    case 'fetchModels':
                        const models = await this._configManager.getAvailableModels(message.provider);
                        this._panel.webview.postMessage({ command: 'modelsLoaded', models });
                        break;
                }
            },
            null,
            this._disposables
        );
    }

    _getWebviewContent(currentConfig) {
        return `
            <!DOCTYPE html>
            <html>
                <head>
                    <title>Toshimo Configuration</title>
                </head>
                <body>
                    <h1>AI Model Configuration</h1>
                    <form id="configForm">
                        <select id="provider" value="${currentConfig.provider}">
                            <option value="claude">Claude</option>
                            <option value="openai">OpenAI</option>
                            <option value="ollama">Ollama</option>
                        </select>
                        
                        <input type="text" id="apiKey" value="${currentConfig.apiKey || ''}" placeholder="API Key" />
                        <select id="model"></select>
                        
                        <div id="parameters">
                            <input type="number" id="temperature" value="${currentConfig.parameters?.temperature || 0.7}" placeholder="Temperature" min="0" max="1" step="0.1" />
                            <input type="number" id="maxTokens" value="${currentConfig.parameters?.maxTokens || 50000}" placeholder="Max Tokens" />
                        </div>
                        
                        <div id="ollamaConfig" style="display: ${currentConfig.provider === 'ollama' ? 'block' : 'none'}">
                            <input type="text" id="endpoint" value="${currentConfig.endpoint || 'http://localhost:11434'}" placeholder="Ollama Endpoint" />
                        </div>
                        
                        <button type="submit">Save Configuration</button>
                    </form>
                    <script>
                        // Add necessary JavaScript for handling form submission and model fetching
                    </script>
                </body>
            </html>
        `;
    }

    dispose() {
        ConfigurationPanel.currentPanel = undefined;
        this._panel.dispose();
        while (this._disposables.length) {
            const disposable = this._disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

module.exports = { ConfigurationPanel }; 