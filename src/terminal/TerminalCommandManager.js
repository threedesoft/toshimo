const vscode = require('vscode');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class TerminalCommandManager {
    constructor() {
        this.terminal = undefined;
        this.isExecuting = false;
    }

    getTerminal() {
        try {
            if (!this.terminal || this.terminal.exitStatus !== undefined) {
                this.terminal = vscode.window.createTerminal('70$H1M0');
            }
            return this.terminal;
        } catch (error) {
            throw new ToshimoError(
                ErrorType.Terminal,
                'Failed to create terminal',
                error
            );
        }
    }

    async executeCommand(command) {
        return ErrorHandler.withErrorHandling(
            async () => {
                if (this.isExecuting) {
                    throw new ToshimoError(
                        ErrorType.Terminal,
                        'A command is already being executed. Please wait.'
                    );
                }

                if (!command.trim()) {
                    throw new ToshimoError(
                        ErrorType.Terminal,
                        'Cannot execute empty command'
                    );
                }

                this.isExecuting = true;
                const terminal = this.getTerminal();

                try {
                    terminal.show();
                    terminal.sendText(command);
                    
                    // Wait a bit to ensure the command starts executing
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    this.isExecuting = false;
                }
            },
            'TerminalCommandManager.executeCommand'
        );
    }

    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }
    }
}

module.exports = { TerminalCommandManager }; 