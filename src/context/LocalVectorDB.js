const fs = require('fs/promises');
const path = require('path');
const { ErrorHandler, ToshimoError, ErrorType } = require('../utils/ErrorHandler');

class LocalVectorDB {
    constructor() {
        this.vectors = [];
        this.documents = [];
        this.isDirty = false;
    }

    async add(document, vector) {
        this.vectors.push(vector);
        this.documents.push(document);
        this.isDirty = true;
    }

    async save(filePath) {
        try {
            if (!this.isDirty) {
                console.log('No changes to save in vector DB');
                return;
            }

            const data = {
                vectors: this.vectors,
                documents: this.documents,
                version: '1.0'
            };

            await fs.writeFile(filePath, JSON.stringify(data, null, 2));
            console.log(`Saved vector DB to ${filePath} with ${this.vectors.length} entries`);
            this.isDirty = false;
        } catch (error) {
            throw new ToshimoError(
                ErrorType.Storage,
                'Failed to save vector database',
                error
            );
        }
    }

    async load(filePath) {
        try {
            const data = await fs.readFile(filePath, 'utf8');
            const parsed = JSON.parse(data);
            
            if (!parsed.vectors || !parsed.documents || parsed.vectors.length !== parsed.documents.length) {
                console.warn('Invalid or corrupted vector DB, reinitializing...');
                this.vectors = [];
                this.documents = [];
                this.isDirty = true;
                return false;
            }

            this.vectors = parsed.vectors;
            this.documents = parsed.documents;
            this.isDirty = false;
            
            console.log(`Loaded vector DB from ${filePath} with ${this.vectors.length} entries`);
            return true;
        } catch (error) {
            console.warn('Failed to load vector database:', error);
            this.vectors = [];
            this.documents = [];
            this.isDirty = true;
            return false;
        }
    }

    isEmpty() {
        return this.vectors.length === 0;
    }

    async search(query, k = 5) {
        if (this.isEmpty()) {
            console.warn('Vector DB is empty, no results to return');
            return [];
        }

        try {
            // Return relevant document contents
            return this.documents
                .slice(0, k)
                .map(doc => doc.content);
        } catch (error) {
            console.error('Search error:', error);
            return [];
        }
    }
}

module.exports = { LocalVectorDB }; 