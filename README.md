TOSHIMO - AI CODING ASSISTANT
============================

An AI-powered VSCode extension supporting multiple LLM providers (OpenAI, Claude, Ollama) to help you code faster and smarter.

INSTALLATION & SETUP
------------------
1. Install from VS Code Marketplace:
   - Open VS Code
   - Click Extensions icon in sidebar (or press Ctrl+Shift+X)
   - Search for "Toshimo"
   - Click Install

2. Configure LLM Provider:
   - Press Ctrl+Shift+P (Cmd+Shift+P on Mac)
   - Type "Toshimo: Open Configuration"
   - Choose your preferred LLM provider:
     - OpenAI
     - Anthropic Claude
     - Ollama (self-hosted)

3. Set up API Keys:
   - For OpenAI:
     - Get API key from: https://platform.openai.com/account/api-keys
     - Add to configuration
   - For Claude:
     - Get API key from: https://console.anthropic.com/
     - Add to configuration
   - For Ollama:
     - Install Ollama from: https://ollama.ai/
     - Set endpoint URL in configuration

4. Verify Installation:
   - Press Ctrl+Shift+P
   - Type "Toshimo: Show Prompt"
   - Try a test command like "Hello"

BASIC USAGE
----------
1. Initialize Codebase:
   - Command: "Toshimo: Initialize Codebase"
   - This scans your project for better context

2. Access AI Assistant:
   - Keyboard: Alt+T (Windows/Linux) or Cmd+T (Mac)
   - Command Palette: "Toshimo: Show Prompt"
   - Right-click: "Ask Toshimo"

3. Available Commands:
   - toshimo.showPrompt - Open AI prompt input
   - toshimo.openConfig - Open settings panel
   - toshimo.initializeCodebase - Scan and analyze codebase

CONFIGURATION OPTIONS
-------------------
Access via Settings:
1. VS Code Settings (Ctrl+,)
2. Search "Toshimo"
3. Or use Command: "Toshimo: Open Configuration"

Available Settings:
- LLM Provider Selection
  - OpenAI
  - Claude
  - Ollama
- API Configuration
  - API Keys
  - Endpoint URLs
  - Model Selection
- AI Behavior
  - Temperature (0.0 - 1.0)
  - Max Tokens
  - Context Window
- Code Analysis
  - Scan Depth
  - File Types
  - Exclusions

DEVELOPMENT SETUP
---------------
For those wanting to contribute or modify the extension:

1. Prerequisites:
   - Node.js v14 or higher
   - npm v6 or higher
   - Git
   - VS Code

2. Clone & Install:
   ```bash
   git clone https://github.com/yourusername/toshimo.git
   cd toshimo
   npm install
   ```

3. Development Mode:
   - Start watch mode: `npm run watch`
   - Press F5 in VS Code to launch extension
   - Changes to source files trigger auto-reload
   - View output in Debug Console

4. Building:
   ```bash
   npm run lint        # Check code style
   npm run test        # Run test suite
   npm run compile     # Compile TypeScript
   npm run package     # Create VSIX package
   ```

5. Installing Dev Build:
   ```bash
   code --install-extension toshimo-0.1.0.vsix
   ```

6. Debugging Tools:
   - Set breakpoints in source files
   - Use VS Code Debug view (Ctrl+Shift+D)
   - Check Debug Console for logs
   - Use VS Code debugger tools

PROJECT STRUCTURE
---------------
src/
  agents/          - AI processing
  config/          - Settings management
  context/         - Code context handling
  services/        - LLM integrations
  terminal/        - Terminal commands
  prompt/          - Prompt handling
  utils/           - Helper functions
  extension.js     - Main entry

LICENSE
-------
MIT License - See LICENSE file

Version: 0.1.0
Author: Threedesoft
Copyright (c) 2024 