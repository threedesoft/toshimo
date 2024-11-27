const axios = require('axios');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class EmbeddingProvider {
    constructor(config) {
        this.config = config || {
            provider: 'ollama',
            model: this.getEmbeddingModel(),
            endpoint: 'http://localhost:11434'
        };
    }

    getEmbeddingModel() {
        // Use nomic-embed-text as recommended embedding model
        return 'nomic-embed-text';
    }

    async getEmbedding(text) {
        try {
            console.log('Getting embedding for text length:', text.length);

            const requestBody = {
                model: this.config.model,
                prompt: text
            };

            console.log('Embedding request:', {
                endpoint: `${this.config.endpoint}/api/embeddings`,
                model: this.config.model
            });

            const response = await axios.post(
                `${this.config.endpoint}/api/embeddings`,
                requestBody
            );

            if (response.data && response.data.embedding) {
                console.log('Got embedding vector of length:', response.data.embedding.length);
                return response.data.embedding;
            }
            
            console.warn('No embedding in response:', response.data);
            return this.generateSimpleHash(text);
            
        } catch (error) {
            console.error('Failed to get embedding:', {
                error: error.message,
                response: error.response?.data,
                status: error.response?.status
            });

            if (error.response?.status === 404) {
                console.warn('Embedding model not found. Please run: ollama pull nomic-embed-text');
            }

            return this.generateSimpleHash(text);
        }
    }

    generateSimpleHash(text) {
        if (!text || typeof text !== 'string') {
            text = text?.toString() || '';
        }

        const vec = new Array(384).fill(0);
        const words = text.split(/\s+/).filter(w => w.length > 0);
        
        if (words.length === 0) {
            // Handle empty input
            const hash = this.simpleHash(text);
            const pos = Math.abs(hash) % 384;
            vec[pos] = 1;
            return vec;
        }

        words.forEach((word, index) => {
            const hash = this.simpleHash(word);
            const pos = Math.abs(hash) % 384;
            vec[pos] += 1 / (index + 1);
        });

        // Normalize
        const magnitude = Math.sqrt(vec.reduce((sum, val) => sum + val * val, 0));
        return magnitude > 0 ? vec.map(val => val / magnitude) : vec;
    }

    simpleHash(text) {
        if (!text || typeof text !== 'string') {
            return 0;
        }

        let hash = 0;
        for (let i = 0; i < text.length; i++) {
            const char = text.charCodeAt(i);
            hash = ((hash << 5) - hash) + char;
            hash = hash & hash;
        }
        return hash;
    }

    chunkText(text, maxChunkSize = 512) {
        if (!text || typeof text !== 'string') {
            return [text?.toString() || ''];
        }

        const words = text.split(/\s+/);
        const chunks = [];
        let currentChunk = [];
        let currentSize = 0;

        for (const word of words) {
            if (currentSize + word.length > maxChunkSize) {
                chunks.push(currentChunk.join(' '));
                currentChunk = [word];
                currentSize = word.length;
            } else {
                currentChunk.push(word);
                currentSize += word.length + 1; // +1 for space
            }
        }

        if (currentChunk.length > 0) {
            chunks.push(currentChunk.join(' '));
        }

        return chunks.length > 0 ? chunks : [text];
    }
}

module.exports = { EmbeddingProvider }; 