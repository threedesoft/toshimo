const vscode = require('vscode');
const path = require('path');
const { ErrorHandler } = require('../utils/ErrorHandler');
const { LLMService } = require('../services/LLMService');
const { ToolManager } = require('../tools/ToolManager');

class AIAgent {
    constructor(configManager, contextManager) {
        this.llmService = new LLMService(configManager);
        this.contextManager = contextManager;
        this.toolManager = new ToolManager();
        this.userAnswers = {};
        this.chatHistory = [];
    }

    async processPrompt(prompt, selectedText, fileContent) {
        try {
            console.log('AIAgent processing prompt:', {
                prompt,
                hasSelectedText: !!selectedText,
                hasFileContent: !!fileContent
            });

            // Get relevant context with proper metadata
            const context = await this.contextManager.getRelevantContext(
                `${prompt}\n\nSelected Text:\n${selectedText}\n\nFile Content:\n${fileContent}`
            );
            
            console.log('Got context from ContextManager:', context);

            // Generate initial response from LLM with full context
            let response = await this.llmService.generateResponse(prompt, context, this.chatHistory);
            
            console.log('Got LLM response:', response);

            // Process actions if any
            if (response.actions && response.actions.length > 0) {
                console.log('Processing actions:', response.actions);
                for (const action of response.actions) {
                    try {
                        console.log('Executing action:', action);
                        const actionResult = await this.toolManager.executeAction(action);
                        console.log('Action result:', actionResult);

                        // If it's a read operation, send the content back to LLM for processing
                        if (action.tool === 'FileManager' && action.command === 'readFile') {
                            const fileContent = actionResult;
                            console.log('File content read:', fileContent);
                            
                            const followUpResponse = await this.llmService.generateResponse(
                                `I've read the file content:\n${fileContent}\nPlease provide the necessary changes to add version 3.8.`,
                                [...context, `File content:\n${fileContent}`],
                                this.chatHistory
                            );
                            
                            console.log('Follow-up response:', followUpResponse);
                            
                            // Process follow-up actions (like edit operations)
                            if (followUpResponse.actions) {
                                for (const followUpAction of followUpResponse.actions) {
                                    console.log('Executing follow-up action:', followUpAction);
                                    await this.toolManager.executeAction(followUpAction);
                                }
                            }

                            // Update response content
                            response.content = followUpResponse.content;
                        }
                    } catch (error) {
                        console.error('Error executing action:', error);
                        response.content += `\nError executing action: ${error.message}`;
                    }
                }
            }

            // Handle questions if any
            if (response.questions && response.questions.length > 0) {
                return {
                    content: response.content,
                    questions: response.questions,
                    requiresUserInput: true,
                    actions: []
                };
            }

            // Update chat history
            this.chatHistory.push(
                { role: 'user', content: prompt },
                { role: 'assistant', content: response.content }
            );
            // Keep only last 10 messages
            this.chatHistory = this.chatHistory.slice(-10);

            return response;
        } catch (error) {
            console.error('Error in AIAgent.processPrompt:', error);
            return {
                content: `Error: ${error.message}`,
                actions: [],
                questions: [],
                requiresUserInput: false
            };
        }
    }

    async handleUserAnswer(answer, questionId) {
        try {
            // Store the answer
            this.userAnswers[questionId] = answer;
            
            // Update chat history with the answer
            this.chatHistory.push({ role: 'user', content: answer });

            // Get the last prompt from chat history
            const lastPrompt = this.chatHistory.find(msg => msg.role === 'user')?.content;
            if (!lastPrompt) {
                throw new Error('No previous prompt found');
            }

            // Process the prompt again with the new answer
            return await this.processPrompt(
                lastPrompt,
                '', // selectedText
                ''  // fileContent
            );
        } catch (error) {
            console.error('Error handling user answer:', error);
            return {
                content: `Error processing your answer: ${error.message}`,
                actions: [],
                questions: [],
                requiresUserInput: false
            };
        }
    }
}

module.exports = { AIAgent }; 