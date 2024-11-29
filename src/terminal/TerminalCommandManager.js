const vscode = require('vscode');
const os = require('os');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class TerminalCommandManager {
    constructor() {
        this.terminal = undefined;
        this.isExecuting = false;
        this.platform = os.platform();
        this.shell = process.env.SHELL || (this.platform === 'win32' ? 'cmd.exe' : '/bin/bash');
    }

    getTerminal() {
        try {
            if (!this.terminal || this.terminal.exitStatus !== undefined) {
                const shellPath = this.getShellPath();
                this.terminal = vscode.window.createTerminal({
                    name: '70$H1M0',
                    shellPath: shellPath,
                    shellArgs: this.getShellArgs()
                });
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

    getShellPath() {
        if (this.platform === 'win32') {
            return process.env.COMSPEC || 'cmd.exe';
        }
        return process.env.SHELL || '/bin/bash';
    }

    getShellArgs() {
        if (this.platform === 'win32') {
            return ['/K']; // Keep terminal open after command
        }
        return ['-l']; // Login shell for Unix-like systems
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
                    const formattedCommand = this.formatCommand(command);
                    console.log(`Executing command on ${this.platform}:`, formattedCommand);

                    terminal.show();
                    terminal.sendText(formattedCommand);
                    
                    // Wait a bit to ensure the command starts executing
                    await new Promise(resolve => setTimeout(resolve, 100));
                } finally {
                    this.isExecuting = false;
                }
            },
            'TerminalCommandManager.executeCommand'
        );
    }

    formatCommand(command) {
        if (this.platform === 'win32') {
            return command
                .replace(/\//g, '\\')
                .replace(/^sudo /i, '')
                .replace(/export ([^=]+)=(.+)/, 'set $1=$2');
        }
        return command;
    }

    getPlatformInfo() {
        return {
            platform: this.platform,
            isWindows: this.platform === 'win32',
            isMac: this.platform === 'darwin',
            isLinux: this.platform === 'linux',
            shell: this.shell
        };
    }

    dispose() {
        if (this.terminal) {
            this.terminal.dispose();
            this.terminal = undefined;
        }
    }
}

module.exports = { TerminalCommandManager }; 