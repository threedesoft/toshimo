const vscode = require('vscode');
const os = require('os');

class TerminalClient {
    constructor() {
        this.terminal = null;
        this.platform = os.platform(); // 'win32', 'darwin', or 'linux'
    }

    async executeCommand(command) {
        try {
            if (!this.terminal) {
                this.terminal = vscode.window.createTerminal('Toshimo Terminal');
            }

            // Format command based on platform
            const formattedCommand = this.formatCommand(command);
            console.log(`Executing command on ${this.platform}:`, formattedCommand);

            this.terminal.show();
            this.terminal.sendText(formattedCommand);
            return true;
        } catch (error) {
            console.error('TerminalClient executeCommand error:', error);
            throw error;
        }
    }

    formatCommand(command) {
        if (this.platform === 'win32') {
            // Handle Windows-specific formatting
            return command
                .replace(/\//g, '\\')  // Replace forward slashes with backslashes
                .replace(/^sudo /i, '') // Remove sudo commands
                .replace(/export ([^=]+)=(.+)/, 'set $1=$2'); // Convert export to set
        }
        return command; // Keep as-is for Unix-like systems
    }

    getPlatformInfo() {
        return {
            platform: this.platform,
            isWindows: this.platform === 'win32',
            isMac: this.platform === 'darwin',
            isLinux: this.platform === 'linux',
            shell: process.env.SHELL || (this.platform === 'win32' ? 'cmd.exe' : '/bin/bash')
        };
    }
}

module.exports = { TerminalClient }; 