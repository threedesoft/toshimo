const axios = require('axios');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');
const os = require('os');
const { CodeContext } = require('../context/CodeContext');

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
        this.platform = os.platform();
        this.platformInfo = {
            platform: this.platform,
            isWindows: this.platform === 'win32',
            isMac: this.platform === 'darwin',
            isLinux: this.platform === 'linux',
            shell: process.env.SHELL || (this.platform === 'win32' ? 'cmd.exe' : '/bin/bash')
        };
        this.codeContext = new CodeContext();
        this.initializeCodeContext();
    }

    async initializeCodeContext() {
        await this.codeContext.initialize();
    }

    async generateResponse(prompt, context, chatHistory = []) {
        console.log("=======================================")
        console.log('Generating response with:', {
            provider: this.config.provider,
            model: this.config.model,
            promptLength: prompt.length,
            contextSize: context.length,
            historySize: chatHistory.length
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
                        return await this.callClaude(prompt, context, chatHistory);
                    case 'openai':
                        return await this.callOpenAI(prompt, context, chatHistory);
                    case 'ollama':
                        return await this.callOllama(prompt, context, chatHistory);
                    default:
                        console.warn(`Unsupported provider ${this.config.provider}, falling back to Ollama`);
                        this.config.provider = 'ollama';
                        return await this.callOllama(prompt, context, chatHistory);
                }
            },
            'LLMService.generateResponse',
            {
                content: 'Failed to generate response. Please check the error message and try again.',
                actions: [],
                questions: [],
                requiresUserInput: false
            }
        );
    }

    async callOllama(prompt, context, chatHistory = []) {
        try {
            console.log('Calling Ollama API:', {
                endpoint: `${this.config.endpoint}/api/generate`,
                model: this.config.model,
                promptLength: prompt.length,
                temperature: this.config.parameters?.temperature || 0.7,
                maxTokens: this.config.parameters?.maxTokens || 50000,
                historyLength: chatHistory.length
            });

            const fullPrompt = this.constructPrompt(prompt, context, chatHistory);
            console.log('Constructed prompt with history:', {
                promptLength: fullPrompt.length,
                hasHistory: chatHistory.length > 0
            });

            const requestBody = {
                model: this.config.model,
                prompt: fullPrompt,
                stream: false,
                options: {
                    temperature: this.config.parameters?.temperature || 0.7,
                    num_predict: this.config.parameters?.maxTokens || 50000
                }
            };

            // Format the request body for better readability
            console.log('Ollama request body:');
            console.log('='.repeat(80));
            console.log('Model:', requestBody.model);
            console.log('Options:', JSON.stringify(requestBody.options, null, 2));
            console.log('Prompt:');
            console.log('-'.repeat(80));
            console.log(requestBody.prompt);
            console.log('='.repeat(80));

            const response = await axios.post(
                `${this.config.endpoint}/api/generate`,
                requestBody
            );

            console.log('Ollama API response:', {
                status: response.status,
                headers: response.headers,
                responseLength: response.data?.response?.length,
                response: response.data?.response //?.substring(0, 200) + '...' // First 200 chars
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

    async callOpenAI(prompt, context, chatHistory = []) {
        try {
            console.log('Calling OpenAI API:', {
                model: this.config.model || 'gpt-4',
                maxTokens: this.config.parameters?.maxTokens || 50000,
                temperature: this.config.parameters?.temperature || 0.7
            });

            const response = await axios.post(
                'https://api.openai.com/v1/chat/completions',
                {
                    model: this.config.model || 'gpt-4',
                    messages: [
                        {
                            role: 'system',
                            content: this.constructPrompt('', context, [])
                        },
                        ...chatHistory.map(msg => ({
                            role: msg.role === 'assistant' ? 'assistant' : 'user',
                            content: msg.content
                        })),
                        {
                            role: 'user',
                            content: prompt
                        }
                    ],
                    max_tokens: this.config.parameters?.maxTokens || 50000,
                    temperature: this.config.parameters?.temperature || 0.7
                },
                {
                    headers: {
                        'Authorization': `Bearer ${this.config.apiKey}`,
                        'Content-Type': 'application/json'
                    }
                }
            );

            console.log('OpenAI API response:', {
                status: response.status,
                headers: response.headers,
                responseLength: response.data?.choices?.[0]?.message?.content?.length
            });

            return this.parseResponse(response.data.choices[0].message.content);
        } catch (error) {
            console.error('OpenAI API error:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                stack: error.stack
            });

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

    async callClaude(prompt, context, chatHistory = []) {
        try {
            console.log('Calling Claude API:', {
                model: this.config.model || 'claude-3-opus-20240229',
                maxTokens: this.config.parameters?.maxTokens || 50000
            });

            const response = await axios.post(
                'https://api.anthropic.com/v1/messages',
                {
                    model: this.config.model || 'claude-3-opus-20240229',
                    max_tokens: this.config.parameters?.maxTokens || 50000,
                    messages: [
                        ...chatHistory.map(msg => ({
                            role: msg.role === 'assistant' ? 'assistant' : 'user',
                            content: msg.content
                        })),
                        {
                            role: 'user',
                            content: this.constructPrompt(prompt, context, chatHistory)
                        }
                    ],
                    system: "You are a helpful AI programming assistant with access to various tools. Format your responses according to the prompt guidelines."
                },
                {
                    headers: {
                        'x-api-key': this.config.apiKey,
                        'anthropic-version': '2023-06-01',
                        'content-type': 'application/json'
                    }
                }
            );

            console.log('Claude API response:', {
                status: response.status,
                headers: response.headers,
                responseLength: response.data?.content?.[0]?.text?.length
            });

            return this.parseResponse(response.data.content[0].text);
        } catch (error) {
            console.error('Claude API error:', {
                message: error.message,
                code: error.code,
                response: error.response?.data,
                stack: error.stack
            });

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

    constructPrompt(prompt, context, chatHistory = []) {
        // Extract metadata context if it exists
        let metadataContext = '';
        const metadataEntry = context.find(c => c.startsWith('Project Context:'));
        if (metadataEntry) {
            metadataContext = `\nCodebase Information:\n${metadataEntry}\n`;
            context = context.filter(c => !c.startsWith('Project Context:'));
        }

        // Format chat history with clear separation
        const formattedHistory = chatHistory.length > 0 
            ? '\nPrevious Conversation:\n' + chatHistory
                .slice(-10) // Keep last 10 messages
                .map(msg => `${msg.role.toUpperCase()}: ${msg.content}`)
                .join('\n\n')
            : '\nNo previous conversation.';

        // Add code context
        const codeContext = this.codeContext.getFormattedContext();

        return `
You are Toshimo, an AI programming assistant with access to various tools. You can use these tools to help users with their requests.

System Information:
Operating System: ${this.platformInfo.isWindows ? 'Windows' : this.platformInfo.isMac ? 'macOS' : 'Linux'}
Shell: ${this.platformInfo.shell}

Available Tools:
1. FileManager
   - createFile(filePath, content)
   - readFile(filePath)
   - fileExists(filePath)

2. FileEditor
   - editFile(filePath, changes)
   - showDiff(filePath, originalContent, newContent)

3. WebScraper
   - scrape(url)

Format your response as a JSON block with the following structure:
<RESPONSE_START>
{
    "actions": [
        {
            "tool": "FileManager",
            "command": "readFile",
            "params": ["path/to/file"]
        }
    ],
    "chat": "Your explanation of what you're doing",
    "questions": [
        {
            "id": "unique_id",
            "text": "Question text",
            "type": "yes_no|choice|text",
            "options": ["option1", "option2"],
            "importance": "high|medium|low"
        }
    ]
}
<RESPONSE_END>

Important JSON Guidelines:
1. Use the exact markers <RESPONSE_START> and <RESPONSE_END> to wrap your JSON
2. Do not use backticks or markdown formatting
3. Properly escape all special characters in strings
4. Use double quotes for all JSON strings
5. Keep file paths simple without escape characters

Important Tool Guidelines:
1. Read from CodeContext before using FileManager
2. File paths should be exact (e.g., "Dockerfile", not "dockerfile.txt")
3. Tool names must be exactly: FileManager, FileEditor, or WebScraper
4. For file edits, first read the file, then use FileEditor.editFile with the updated content
5. When showing diffs, use actual file content, not placeholders

Question Guidelines:
1. DO NOT ask questions for any reason.
2. Make reasonable assumptions based on:
   - Common development practices
   - Standard patterns
   - Context from the codebase
   - Previous conversation history
3. If multiple approaches are valid, choose the most standard one instead of asking
4. Assume thingss as per industry standard

${metadataContext}

Context:
${context.join('\n\n')}

${formattedHistory}

User Request:
${prompt}

Remember to:
1. Use tools for file operations, don't include file content in chat
2. Keep chat responses focused on high-level steps
3. Make reasonable assumptions when possible
4. Use WebScraper for any web content you need
5. Maintain conversation context using chat history

${codeContext}
`;
    }

    parseResponse(response) {
        try {
            console.log('Original response:', response);
            
            // First, find the markers
            const startMarker = '<RESPONSE_START>';
            const endMarkers = ['<RESPONSE_END>', '</RESPONSE_END>']; // Support both formats
            
            const startIndex = response.indexOf(startMarker);
            
            // Find the first occurring end marker
            let endIndex = -1;
            let usedEndMarker = '';
            for (const marker of endMarkers) {
                const index = response.indexOf(marker);
                if (index !== -1 && (endIndex === -1 || index < endIndex)) {
                    endIndex = index;
                    usedEndMarker = marker;
                }
            }
            
            if (startIndex === -1 || endIndex === -1 || startIndex >= endIndex) {
                console.log('No valid response markers found:', {
                    responseLength: response.length,
                    hasStartMarker: startIndex !== -1,
                    hasEndMarker: endIndex !== -1,
                    startIndex,
                    endIndex,
                    checkedEndMarkers: endMarkers,
                    foundEndMarker: usedEndMarker
                });
                return {
                    content: response,
                    actions: [],
                    questions: [],
                    requiresUserInput: false
                };
            }

            // Extract everything between markers
            const markedContent = response.substring(
                startIndex + startMarker.length,
                endIndex
            );

            // Clean up the extracted content
            let jsonStr = markedContent
                .replace(/^\s+|\s+$/g, '')  // Trim whitespace
                .replace(/[\r\n]/g, '')     // Remove all newlines
                .replace(/\s+/g, ' ');      // Normalize spaces

            console.log('Extracted and cleaned JSON string:', jsonStr);

            try {
                // Additional validation
                if (!jsonStr.startsWith('{') || !jsonStr.endsWith('}')) {
                    throw new Error('Invalid JSON structure');
                }

                const parsedResponse = JSON.parse(jsonStr);
                console.log('Parsed response:', parsedResponse);

                // Filter out invalid questions
                if (parsedResponse.questions) {
                    parsedResponse.questions = parsedResponse.questions.filter(q => {
                        // Remove questions that are:
                        // 1. Empty text
                        // 2. Type 'none'
                        // 3. Missing required fields
                        return q.text?.trim() && 
                               q.type !== 'none' && 
                               q.id?.trim() &&
                               q.type?.trim();
                    });
                }

                return {
                    content: parsedResponse.chat || response,
                    actions: parsedResponse.actions || [],
                    questions: parsedResponse.questions || [],
                    requiresUserInput: parsedResponse.questions?.length > 0
                };
            } catch (jsonError) {
                console.error('JSON parsing error:', {
                    error: jsonError,
                    markedContent,
                    jsonStr,
                    startIndex,
                    endIndex,
                    usedEndMarker
                });
                throw jsonError;
            }
        } catch (error) {
            console.error('Error parsing LLM response:', error);
            return {
                content: `Error parsing response: ${error.message}\n\nOriginal response:\n${response}`,
                actions: [],
                questions: [],
                requiresUserInput: false
            };
        }
    }
}

module.exports = { LLMService }; 