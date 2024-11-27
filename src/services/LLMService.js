const axios = require('axios');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class LLMService {
    constructor(configManager) {
        console.log('Initializing LLMService...');
        this.configManager = configManager;
        try {
            this.config = this.configManager.getLLMConfig();
            console.log('Loaded LLM config:', { 
                provider: this.config.provider,
                model: this.config.model,
                endpoint: this.config.endpoint 
            });
        } catch (error) {
            console.warn('Failed to load LLM config, defaulting to Ollama:', error.message);
            this.config = {
                provider: 'ollama',
                model: 'codellama',
                endpoint: 'http://localhost:11434'
            };
            console.log('Using default config:', this.config);
        }
    }

    validateConfig() {
        console.log('Validating LLM config...');
        try {
            if (!this.config) {
                console.log('No config found, using defaults');
                this.config = {
                    provider: 'ollama',
                    model: 'llama3.2',
                    endpoint: 'http://localhost:11434'
                };
            }

            if (!this.config.provider) {
                console.log('No provider specified, defaulting to Ollama');
                this.config.provider = 'ollama';
                this.config.model = 'llama3.2';
                this.config.endpoint = 'http://localhost:11434';
            }

            console.log('Config validation successful:', this.config);
            return true;
        } catch (error) {
            console.warn('Config validation failed, using Ollama defaults:', error.message);
            this.config = {
                provider: 'ollama',
                model: 'llama3.2>',
                endpoint: 'http://localhost:11434'
            };
            return true;
        }
    }

    async generateResponse(prompt, context) {
        console.log('Generating response with:', {
            provider: this.config.provider,
            model: this.config.model,
            promptLength: prompt.length,
            contextSize: context.length
        });

        return ErrorHandler.withErrorHandling(
            async () => {
                // Validate API key only when making actual calls
                if (this.config.provider !== 'ollama' && !this.config.apiKey) {
                    console.warn(`No API key found for ${this.config.provider}`);
                    throw new ToshimoError(
                        ErrorType.Configuration,
                        'API key is required for ' + this.config.provider
                    );
                }
                
                console.log('Using provider:', this.config.provider);
                switch (this.config.provider) {
                    case 'claude':
                        return await this.callClaude(prompt, context);
                    case 'openai':
                        return await this.callOpenAI(prompt, context);
                    case 'ollama':
                        return await this.callOllama(prompt, context);
                    default:
                        console.warn(`Unsupported provider ${this.config.provider}, falling back to Ollama`);
                        this.config.provider = 'ollama';
                        return await this.callOllama(prompt, context);
                }
            },
            'LLMService.generateResponse',
            {
                content: 'Failed to generate response. Please check the error message and try again.',
                changes: [],
                commands: [],
                tests: [],
                questions: [],
                requiresUserInput: false
            }
        );
    }

    async callOllama(prompt, context) {
        try {
            console.log('Calling Ollama API:', {
                endpoint: `${this.config.endpoint}/api/generate`,
                model: this.config.model,
                promptLength: prompt.length,
                temperature: this.config.parameters?.temperature || 0.7,
                maxTokens: this.config.parameters?.maxTokens || 2000
            });

            const requestBody = {
                model: this.config.model,
                prompt: this.constructPrompt(prompt, context),
                stream: false,
                options: {
                    temperature: this.config.parameters?.temperature || 0.7,
                    num_predict: this.config.parameters?.maxTokens || 2000
                }
            };

            console.log('Ollama request body:', JSON.stringify(requestBody, null, 2));

            const response = await axios.post(
                `${this.config.endpoint}/api/generate`,
                requestBody
            );

            console.log('Ollama API response:', {
                status: response.status,
                headers: response.headers,
                responseLength: response.data?.response?.length,
                response: response.data?.response?.substring(0, 200) + '...' // First 200 chars
            });

            return this.parseResponse(response.data.response);
        } catch (error) {
            console.error('Ollama API error:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                stack: error.stack
            });

            if (error.isAxiosError) {
                if (error.code === 'ECONNREFUSED') {
                    throw new ToshimoError(
                        ErrorType.API,
                        'Could not connect to Ollama. Make sure it is running on ' + this.config.endpoint,
                        error
                    );
                }
                throw new ToshimoError(
                    ErrorType.API,
                    `Ollama API error: ${error.response?.data || error.message}`,
                    error
                );
            }
            throw new ToshimoError(
                ErrorType.Unknown,
                'Unexpected error while calling Ollama API',
                error
            );
        }
    }

    async callOpenAI(prompt, context) {
        try {
            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: this.config.model || 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: 'You are a helpful AI programming assistant.'
                        },
                        {
                            role: 'user',
                            content: this.constructPrompt(prompt, context)
                        }
                    ],
                    max_tokens: this.config.parameters?.maxTokens || 2000,
                    temperature: this.config.parameters?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            return this.parseResponse(response.data.choices[0].message.content);
        } catch (error) {
            if (error.isAxiosError) {
                if (error.response?.status === 401) {
                    throw new ToshimoError(
                        ErrorType.API,
                        'Invalid OpenAI API key. Please check your configuration.',
                        error
                    );
                }
                throw new ToshimoError(
                    ErrorType.API,
                    `OpenAI API error: ${error.response?.data?.error?.message || error.message}`,
                    error
                );
            }
            throw new ToshimoError(
                ErrorType.Unknown,
                'Unexpected error while calling OpenAI API',
                error
            );
        }
    }

    async callClaude(prompt, context) {
        try {
            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: this.config.model || 'claude-3-opus-20240229',
                    max_tokens: this.config.parameters?.maxTokens || 2000,
                    messages: [{
                        role: 'user',
                        content: this.constructPrompt(prompt, context)
                    }],
                    system: "You are a helpful AI programming assistant. When suggesting code changes, format them as markdown codeblocks with the file path (e.g., ```language:path/to/file). Always explain your changes."
                },
                {
                    headers: {
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    }
                }
            );

            return this.parseResponse(response.data.content[0].text);
        } catch (error) {
            if (error.isAxiosError) {
                if (error.response?.status === 401) {
                    throw new ToshimoError(
                        ErrorType.API,
                        'Invalid Claude API key. Please check your configuration.',
                        error
                    );
                }
                throw new ToshimoError(
                    ErrorType.API,
                    `Claude API error: ${error.response?.data?.error || error.message}`,
                    error
                );
            }
            throw new ToshimoError(
                ErrorType.Unknown,
                'Unexpected error while calling Claude API',
                error
            );
        }
    }

    constructPrompt(prompt, context) {
        // Extract metadata context if it exists
        let metadataContext = '';
        const metadataEntry = context.find(c => c.startsWith('Project Context:'));
        if (metadataEntry) {
            metadataContext = `\nCodebase Information:\n${metadataEntry}\n`;
            // Remove the metadata from the regular context
            context = context.filter(c => !c.startsWith('Project Context:'));
        }

        return `
As an AI programming assistant, analyze the following request and provide a comprehensive solution.
If you need critical information that could significantly impact the implementation, you may ask questions.

${metadataContext}
Guidelines for asking questions:
1. Only ask when the answer would significantly impact the implementation
2. Don't ask about:
   - Personal preferences
   - Minor implementation details
   - Things that can be reasonably assumed based on best practices
3. Do ask about:
   - Critical business requirements
   - Security requirements if dealing with sensitive data
   - Specific integration requirements
   - Performance requirements if critical
   - Breaking changes that need confirmation

Context:
${context.join('\n\n')}

User Request:
${prompt}

If you need to ask questions, format them as:
\`\`\`questions
[
  {
    "id": "unique_id",
    "text": "Question text",
    "type": "yes_no|choice|text|confirmation",
    "options": ["option1", "option2"], // Only for choice type
    "context": "Why this question is important",
    "importance": "high|medium|low"
  }
]
\`\`\`

Based on the codebase context and project structure, provide a solution that aligns with the existing architecture and patterns.
Format any code changes as markdown codeblocks with file paths (e.g., \`\`\`language:path/to/file).
`;
    }

    parseResponse(response) {
        try {
            // If response is already valid JSON, return parsed object
            try {
                const jsonResponse = JSON.parse(response);
                return {
                    content: response,
                    changes: [],
                    commands: [],
                    tests: [],
                    questions: [],
                    requiresUserInput: false,
                    jsonData: jsonResponse
                };
            } catch (e) {
                // Not valid JSON, continue with normal parsing
            }

            const result = {
                content: response,
                changes: [],
                commands: [],
                tests: [],
                questions: [],
                requiresUserInput: false
            };

            // Extract questions if any
            const questionsMatch = response.match(/```questions\n([\s\S]*?)```/);
            if (questionsMatch) {
                result.questions = JSON.parse(questionsMatch[1]);
                result.requiresUserInput = true;
                return result;
            }

            // Extract code blocks with file paths
            const codeBlockRegex = /```(\w+):([^\n]+)\n([\s\S]*?)```/g;
            let match;

            while ((match = codeBlockRegex.exec(response)) !== null) {
                const [, _language, filePath, content] = match;
                if (!filePath || !content) {
                    console.warn('Invalid code block format detected:', match[0]);
                    continue;
                }

                // Check if it's a test file
                if (filePath.includes('.test.') || filePath.includes('.spec.') || filePath.includes('__tests__')) {
                    const testCases = this.extractTestCases(content);
                    result.tests.push({
                        file: filePath.trim(),
                        content: content.trim(),
                        testCases
                    });
                } else {
                    result.changes.push({
                        file: filePath.trim(),
                        content: content.trim()
                    });
                }
            }

            // Extract terminal commands
            const commandRegex = /```terminal\n([\s\S]*?)```/g;
            while ((match = commandRegex.exec(response)) !== null) {
                const commands = match[1].trim().split('\n').filter(cmd => cmd.trim());
                if (commands.length) {
                    result.commands.push(...commands);
                }
            }

            return result;
        } catch (error) {
            throw new ToshimoError(
                ErrorType.Unknown,
                'Failed to parse LLM response',
                error
            );
        }
    }

    async callModel(prompt, options = {}) {
        try {
            const response = await axios.post(`${this.endpoint}/api/generate`, {
                model: this.model,
                prompt: prompt,
                ...options
            });

            // Handle different response formats
            if (response.data && response.data.response) {
                try {
                    // Try parsing as JSON first
                    return JSON.parse(response.data.response);
                } catch (e) {
                    // If not JSON, return as is
                    return response.data.response;
                }
            }
            
            throw new Error('Invalid response format from LLM');
        } catch (error) {
            console.error('LLM call failed:', error);
            throw error;
        }
    }

    // ... rest of the methods with similar conversion ...
}

module.exports = { LLMService }; 