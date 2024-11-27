const vscode = require('vscode');

const ErrorType = {
    Configuration: 'Configuration',
    API: 'API',
    FileSystem: 'FileSystem',
    Terminal: 'Terminal',
    VectorDB: 'VectorDB',
    Embedding: 'Embedding',
    Unknown: 'Unknown'
};

class ToshimoError extends Error {
    constructor(type, message, originalError) {
        super(message);
        this.name = 'ToshimoError';
        this.type = type;
        this.originalError = originalError;
    }
}

class ErrorHandler {
    static handle(error, context) {
        let message;
        let type;

        if (error instanceof ToshimoError) {
            type = error.type;
            message = error.message;
        } else if (error.isAxiosError) {
            type = ErrorType.API;
            message = this.handleAxiosError(error);
        } else {
            type = ErrorType.Unknown;
            message = error.message || 'An unknown error occurred';
        }

        // Log error with context
        console.error(`[${type}] ${context ? `(${context}) ` : ''}${message}`, error);

        // Show error message to user
        this.showErrorMessage(type, message);
    }

    static handleAxiosError(error) {
        if (error.response) {
            // Server responded with error
            return `Server error (${error.response.status}): ${error.response.data?.error || error.response.statusText}`;
        } else if (error.request) {
            // Request made but no response
            return 'No response from server. Please check your internet connection.';
        } else {
            // Error in request setup
            return 'Error setting up the request. Please check your configuration.';
        }
    }

    static showErrorMessage(type, message) {
        const fullMessage = `${type} Error: ${message}`;
        
        switch (type) {
            case ErrorType.Configuration:
                vscode.window.showErrorMessage(fullMessage, 'Open Settings').then(selection => {
                    if (selection === 'Open Settings') {
                        vscode.commands.executeCommand('workbench.action.openSettings', 'toshimo');
                    }
                });
                break;
            
            case ErrorType.API:
                vscode.window.showErrorMessage(fullMessage, 'Check API Key').then(selection => {
                    if (selection === 'Check API Key') {
                        vscode.commands.executeCommand('toshimo.openConfig');
                    }
                });
                break;
            
            default:
                vscode.window.showErrorMessage(fullMessage);
        }
    }

    static async withErrorHandling(operation, context, fallback) {
        try {
            return await operation();
        } catch (error) {
            this.handle(error, context);
            if (fallback !== undefined) {
                return fallback;
            }
            throw error;
        }
    }
}

module.exports = {
    ErrorType,
    ToshimoError,
    ErrorHandler
}; 