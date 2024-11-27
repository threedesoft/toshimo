const vscode = require('vscode');
const path = require('path');
const fs = require('fs/promises');
const { LocalVectorDB } = require('./LocalVectorDB');
const { EmbeddingProvider } = require('./EmbeddingProvider');
const { LLMService } = require('../services/LLMService');
const { ConfigurationManager } = require('../config/ConfigurationManager');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class ContextManager {
    constructor() {
        this.vectorDB = new LocalVectorDB();
        this.embeddingProvider = new EmbeddingProvider();
        this.configManager = new ConfigurationManager();
        this.llmService = new LLMService(this.configManager);
        this.codebaseContext = null;
        this.isInitializing = false;
        this.fileList = [];
    }

    async initializeCodebase() {
        // Prevent multiple simultaneous initializations
        if (this.isInitializing) {
            console.log('Initialization already in progress, skipping...');
            return;
        }

        this.isInitializing = true;

        try {
            const workspaceFolders = vscode.workspace.workspaceFolders;
            if (!workspaceFolders) {
                throw new ToshimoError(ErrorType.Configuration, 'No workspace folder found');
            }

            const workspaceRoot = workspaceFolders[0].uri.fsPath;
            const toshimoDir = path.join(workspaceRoot, '.toshimo');
            const contextFile = path.join(toshimoDir, 'toshimo.context');
            const vectorDBFile = path.join(toshimoDir, 'toshimo.vector.db');

            // Create .toshimo directory if it doesn't exist
            try {
                await fs.mkdir(toshimoDir, { recursive: true });
            } catch (error) {
                console.warn('Error creating .toshimo directory:', error);
            }

            // Always start with a fresh vector DB
            console.log('Creating new vector DB index...');
            this.vectorDB = new LocalVectorDB(); // Reset the vector DB

            // Check if we need to analyze codebase
            let needsContextAnalysis = true;
            try {
                await fs.access(contextFile);
                console.log('Found existing context file, loading...');
                const contextData = await fs.readFile(contextFile, 'utf8');
                this.codebaseContext = JSON.parse(contextData);
                needsContextAnalysis = false;
            } catch {
                console.log('No existing context file found, will analyze codebase');
            }

            // Always index the codebase
            console.log('Indexing codebase...');
            await this.indexWorkspace(workspaceRoot);
            
            // Save the new vector DB
            if (!this.vectorDB.isEmpty()) {
                console.log('Saving vector DB...');
                await this.vectorDB.save(vectorDBFile);

                // After successful indexing, analyze the codebase if needed
                if (needsContextAnalysis) {
                    console.log('Analyzing codebase structure...');
                    this.codebaseContext = await this.analyzeCodebase(workspaceRoot, contextFile);
                    console.log('Codebase analysis completed:', this.codebaseContext);
                }
            } else {
                console.warn('No data to save in vector DB');
            }

        } catch (error) {
            ErrorHandler.handle(error, 'ContextManager.initializeCodebase');
            throw error;
        } finally {
            this.isInitializing = false;
        }
    }

    async indexWorkspace(workspaceRoot) {
        try {
            const fileStructure = await this.getFileStructure(workspaceRoot);
            const files = this.flattenFileStructure(fileStructure, workspaceRoot);
            
            this.fileList = files.map(filePath => path.relative(workspaceRoot, filePath));
            let indexedCount = 0;
            
            for (const filePath of files) {
                try {
                    // Only process text files
                    if (!this.isTextFile(filePath)) continue;

                    const content = await fs.readFile(filePath, 'utf8');
                    const relativePath = path.relative(workspaceRoot, filePath);
                    
                    // Create a document with metadata
                    const document = {
                        type: 'file',
                        path: relativePath,
                        language: this.getFileLanguage(filePath),
                        content: content,
                        metadata: {
                            size: content.length,
                            lastModified: (await fs.stat(filePath)).mtime,
                            extension: path.extname(filePath)
                        }
                    };

                    // Create chunks for large files
                    const chunks = this.chunkDocument(document);
                    
                    for (const chunk of chunks) {
                        const embedding = await this.embeddingProvider.getEmbedding(
                            `${chunk.metadata}\n\n${chunk.content}`
                        );
                        await this.vectorDB.add(chunk, embedding);
                        indexedCount++;
                    }

                    console.log(`Indexed file: ${relativePath}`);
                } catch (error) {
                    console.warn(`Failed to index file ${filePath}:`, error);
                }
            }

            console.log(`Indexing completed. Processed ${indexedCount} chunks from ${files.length} files`);
        } catch (error) {
            ErrorHandler.handle(error, 'ContextManager.indexWorkspace');
            throw error;
        }
    }

    chunkDocument(document, maxChunkSize = 1500) {
        const chunks = [];
        const lines = document.content.split('\n');
        let currentChunk = {
            type: 'chunk',
            path: document.path,
            language: document.language,
            content: '',
            metadata: `File: ${document.path}\nLanguage: ${document.language}\nType: ${document.type}`
        };
        let currentSize = 0;

        for (const line of lines) {
            if (currentSize + line.length > maxChunkSize) {
                chunks.push(currentChunk);
                currentChunk = {
                    type: 'chunk',
                    path: document.path,
                    language: document.language,
                    content: '',
                    metadata: `File: ${document.path}\nLanguage: ${document.language}\nType: ${document.type}`
                };
                currentSize = 0;
            }
            currentChunk.content += line + '\n';
            currentSize += line.length + 1;
        }

        if (currentChunk.content) {
            chunks.push(currentChunk);
        }

        return chunks;
    }

    isTextFile(filePath) {
        const textExtensions = [
            '.js', '.jsx', '.ts', '.tsx', '.py', '.java', '.c', '.cpp', '.h', 
            '.hpp', '.cs', '.php', '.rb', '.go', '.rs', '.swift', '.kt', '.scala',
            '.html', '.css', '.scss', '.sass', '.less', '.json', '.xml', '.yaml',
            '.yml', '.md', '.txt', '.env', '.sh', '.bash', '.zsh', '.fish',
            '.gitignore', '.dockerignore', '.editorconfig', '.eslintrc',
            '.prettierrc', '.babelrc', '.webpack.config.js', '.rollup.config.js'
        ];
        return textExtensions.includes(path.extname(filePath).toLowerCase());
    }

    getFileLanguage(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const languageMap = {
            '.js': 'javascript',
            '.jsx': 'javascript',
            '.ts': 'typescript',
            '.tsx': 'typescript',
            '.py': 'python',
            '.java': 'java',
            '.c': 'c',
            '.cpp': 'cpp',
            '.h': 'c',
            '.hpp': 'cpp',
            '.cs': 'csharp',
            '.php': 'php',
            '.rb': 'ruby',
            '.go': 'go',
            '.rs': 'rust',
            '.swift': 'swift',
            '.kt': 'kotlin',
            '.scala': 'scala',
            '.html': 'html',
            '.css': 'css',
            '.scss': 'scss',
            '.sass': 'sass',
            '.less': 'less',
            '.json': 'json',
            '.xml': 'xml',
            '.yaml': 'yaml',
            '.yml': 'yaml',
            '.md': 'markdown'
        };
        return languageMap[ext] || 'plaintext';
    }

    flattenFileStructure(structure, basePath = '') {
        let files = [];
        for (const file of structure.files) {
            files.push(path.join(basePath, file));
        }
        for (const [dirName, dirStructure] of Object.entries(structure.directories)) {
            files = files.concat(this.flattenFileStructure(dirStructure, path.join(basePath, dirName)));
        }
        return files;
    }

    async analyzeCodebase(workspaceRoot, contextFile) {
        try {
            // Ensure fileList is populated
            if (!this.fileList || this.fileList.length === 0) {
                console.log('File list not populated, getting file structure...');
                const fileStructure = await this.getFileStructure(workspaceRoot);
                const files = this.flattenFileStructure(fileStructure, workspaceRoot);
                this.fileList = files.map(filePath => path.relative(workspaceRoot, filePath));
            }

            console.log('Analyzing codebase with file list:', this.fileList);

            const prompt = `Analyze the following codebase structure and provide a summary in JSON format:

Project Files:
${this.fileList.map(f => `- ${f}`).join('\n')}

The response should be a valid JSON object with the following structure:
{
    "projectType": "string",
    "mainLanguages": ["string"],
    "frameworks": ["string"],
    "architecture": {
        "type": "string",
        "components": ["string"]
    },
    "keyFeatures": ["string"],
    "dependencies": ["string"]
}`;

            const response = await this.llmService.generateResponse(prompt, []);
            
            // Extract JSON from the response
            let jsonMatch;
            try {
                // First try to parse the entire response as JSON
                const result = JSON.parse(response.content);
                
                // Save the analysis result
                await fs.writeFile(contextFile, JSON.stringify(result, null, 2));
                
                return result;
            } catch (e) {
                console.warn('Failed to parse response as JSON, trying to extract from codeblock');
                // If that fails, try to extract JSON from markdown codeblock
                jsonMatch = response.content.match(/```json\n([\s\S]*?)\n```/);
                if (jsonMatch) {
                    const result = JSON.parse(jsonMatch[1]);
                    
                    // Save the analysis result
                    await fs.writeFile(contextFile, JSON.stringify(result, null, 2));
                    
                    return result;
                }
                
                // If still no valid JSON, create a basic structure
                console.warn('Failed to parse codebase analysis response, using default structure');
                const defaultResult = {
                    projectType: "unknown",
                    mainLanguages: [],
                    frameworks: [],
                    architecture: {
                        type: "unknown",
                        components: []
                    },
                    keyFeatures: [],
                    dependencies: []
                };
                
                // Save the default result
                await fs.writeFile(contextFile, JSON.stringify(defaultResult, null, 2));
                
                return defaultResult;
            }
        } catch (error) {
            console.error('Failed to analyze codebase:', error);
            throw new ToshimoError(
                ErrorType.Analysis,
                'Failed to analyze codebase structure',
                error
            );
        }
    }

    async getFileStructure(dir, ignoreDirs = ['.git', 'node_modules', '.toshimo']) {
        const structure = { files: [], directories: {} };
        
        const entries = await fs.readdir(dir, { withFileTypes: true });
        
        for (const entry of entries) {
            if (ignoreDirs.includes(entry.name)) continue;
            
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                structure.directories[entry.name] = await this.getFileStructure(fullPath, ignoreDirs);
            } else {
                structure.files.push(entry.name);
            }
        }
        
        return structure;
    }

    async getRelevantContext(query) {
        const context = await this.vectorDB.search(query);
        
        // Add codebase metadata to context if available
        if (this.codebaseContext) {
            const formattedContext = `Project Context:
{
    "languages": ${JSON.stringify(this.codebaseContext.languages || [], null, 2)},
    "frameworks": ${JSON.stringify(this.codebaseContext.frameworks || [], null, 2)},
    "projectType": "${this.codebaseContext.projectType || 'unknown'}",
    "dependencies": ${JSON.stringify(this.codebaseContext.dependencies || [], null, 2)},
    "architecture": ${JSON.stringify(this.codebaseContext.architecture || [], null, 2)}
}`;
            context.unshift(formattedContext);
        }
        
        return context;
    }
}

module.exports = { ContextManager }; 