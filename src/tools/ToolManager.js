const { FileManager } = require('./FileManager');
const { FileEditor } = require('./FileEditor');
const { TerminalClient } = require('./TerminalClient');
const { WebScraper } = require('./WebScraper');

class ToolManager {
    constructor() {
        this.tools = {
            'FileManager': new FileManager(),
            'FileEditor': new FileEditor(),
            'TerminalClient': new TerminalClient(),
            'WebScraper': new WebScraper()
        };
    }

    async executeAction(action) {
        const { tool, command, params } = action;
        console.log('Executing action:', { tool, command, params });
        
        if (!this.tools[tool]) {
            throw new Error(`Tool ${tool} not found. Available tools: ${Object.keys(this.tools).join(', ')}`);
        }

        if (!this.tools[tool][command]) {
            throw new Error(`Command ${command} not found for tool ${tool}`);
        }

        try {
            const result = await this.tools[tool][command](...params);
            console.log('Action result:', result);
            return result;
        } catch (error) {
            console.error(`Error executing ${tool}.${command}:`, error);
            throw error;
        }
    }
}

module.exports = { ToolManager }; 