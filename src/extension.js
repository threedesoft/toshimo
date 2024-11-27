const vscode = require('vscode');
const axios = require('axios');
const { ConfigurationManager } = require('./config/ConfigurationManager');
const { PromptHandler } = require('./prompt/PromptHandler');
const { ContextManager } = require('./context/ContextManager');
const { AIAgent } = require('./agents/AIAgent');

async function activate(context) {
    try {
        console.log('Activating Toshimo...');

        // Initialize components
        const configManager = new ConfigurationManager();
        const contextManager = new ContextManager();
        const aiAgent = new AIAgent(configManager, contextManager);
        const promptHandler = new PromptHandler(context, aiAgent);

        // Quick pick items for common AI actions
        const quickPickItems = [
            {
                label: "💬 Ask AI Assistant",
                detail: "Ask a question or request help with your code",
                action: 'showPrompt'
            },
            {
                label: "⚙️ Configure Toshimo",
                detail: "Modify settings for AI providers and models",
                action: 'openConfig'
            },
            {
                label: "🔄 Initialize Codebase",
                detail: "Analyze and index your codebase for better AI understanding",
                action: 'initializeCodebase'
            }
        ];

        // Register commands
        const disposables = [
            vscode.commands.registerCommand('toshimo.showQuickPick', async () => {
                console.log('Showing Toshimo quick pick menu');
                const selection = await vscode.window.showQuickPick(quickPickItems, {
                    placeHolder: 'What would you like Toshimo to do?',
                    matchOnDetail: true
                });

                if (!selection) return;

                switch (selection.action) {
                    case 'showPrompt':
                        await promptHandler.showPromptDialog();
                        break;
                    case 'openConfig':
                        vscode.commands.executeCommand('workbench.action.openSettings', 'toshimo');
                        break;
                    case 'initializeCodebase':
                        await vscode.window.withProgress({
                            location: vscode.ProgressLocation.Notification,
                            title: "Initializing Toshimo codebase",
                            cancellable: false
                        }, async () => {
                            await contextManager.initializeCodebase();
                            vscode.window.showInformationMessage('Toshimo: Codebase initialization complete!');
                        });
                        break;
                }
            }),

            // Basic command registrations
            vscode.commands.registerCommand('toshimo.showPrompt', async () => {
                await promptHandler.showPromptDialog();
            }),
            
            vscode.commands.registerCommand('toshimo.openConfig', () => {
                vscode.commands.executeCommand('workbench.action.openSettings', 'toshimo');
            }),

            vscode.commands.registerCommand('toshimo.initializeCodebase', async () => {
                await vscode.window.withProgress({
                    location: vscode.ProgressLocation.Notification,
                    title: "Initializing Toshimo codebase",
                    cancellable: false
                }, async () => {
                    await contextManager.initializeCodebase();
                    vscode.window.showInformationMessage('Toshimo: Codebase initialization complete!');
                });
            })
        ];

        context.subscriptions.push(...disposables);
        vscode.window.showInformationMessage('Toshimo is now active! Press Ctrl+Shift+P and type "Toshimo" to start.');
        console.log('Toshimo activated successfully');
    } catch (error) {
        console.error('Error activating Toshimo:', error);
        vscode.window.showErrorMessage('Failed to activate Toshimo. Check the developer console for details.');
    }
}

function deactivate() {
    console.log('Toshimo deactivated');
}

module.exports = {
    activate,
    deactivate
}; 