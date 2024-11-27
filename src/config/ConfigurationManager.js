const vscode = require('vscode');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class ConfigurationManager {
    constructor() {
        this.config = vscode.workspace.getConfiguration('toshimo');
    }

    getLLMConfig() {
        return {
            provider: this.config.get('llm.provider'),
            model: this.config.get('llm.model'),
            endpoint: this.config.get('llm.endpoint'),
            apiKey: this.config.get('llm.apiKey'),
            parameters: this.config.get('llm.parameters')
        };
    }

    getContextConfig() {
        return {
            maxFiles: this.config.get('context.maxFiles'),
            maxTokens: this.config.get('context.maxTokens')
        };
    }

    async updateConfig(section, value) {
        try {
            await this.config.update(section, value, vscode.ConfigurationTarget.Global);
        } catch (error) {
            throw new ToshimoError(
                ErrorType.Configuration,
                `Failed to update configuration: ${section}`,
                error
            );
        }
    }

    getDefaultConfig() {
        return {
            provider: 'ollama',
            model: 'llama3.2',
            endpoint: 'http://localhost:11434',
            embeddingModel: 'nomic-embed-text'
        };
    }
}

module.exports = { ConfigurationManager }; 