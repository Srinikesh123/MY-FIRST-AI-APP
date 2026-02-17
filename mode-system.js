// Mode System Implementation for AIAssistant

// Extend the AIAssistant class with mode system functionality
(function() {
    // Enhanced command processing with dropdown
    AIAssistant.prototype.setupCommandListener = function() {
        // Create dropdown menu element
        this.createDropdownMenu();
        
        // Listen for mode commands in the chat input
        if (this.userInput) {
            this.userInput.addEventListener('input', (e) => {
                const inputValue = e.target.value;
                if (inputValue === '/') {
                    this.showDropdown();
                } else if (inputValue.startsWith('/') && inputValue.length > 1) {
                    this.filterDropdownOptions(inputValue);
                } else {
                    this.hideDropdown();
                }
            });
            
            this.userInput.addEventListener('keydown', (e) => {
                if (this.dropdownVisible) {
                    if (e.key === 'ArrowDown') {
                        e.preventDefault();
                        this.selectNextOption();
                    } else if (e.key === 'ArrowUp') {
                        e.preventDefault();
                        this.selectPreviousOption();
                    } else if (e.key === 'Enter') {
                        e.preventDefault();
                        this.selectCurrentOption();
                    } else if (e.key === 'Escape') {
                        this.hideDropdown();
                    }
                } else if (e.key === 'Enter' && !e.shiftKey) {
                    const inputValue = e.target.value.trim();
                    if (inputValue.startsWith('/')) {
                        e.preventDefault();
                        this.processCommand(inputValue);
                    }
                }
            });
            
            // Hide dropdown when clicking elsewhere
            document.addEventListener('click', (e) => {
                if (e.target !== this.userInput && !this.dropdown.contains(e.target)) {
                    this.hideDropdown();
                }
            });
        }
    };

    AIAssistant.prototype.createDropdownMenu = function() {
        // Create dropdown container
        this.dropdown = document.createElement('div');
        this.dropdown.id = 'mode-dropdown';
        this.dropdown.style.cssText = `
            position: absolute;
            background: white;
            border: 1px solid #ddd;
            border-radius: 4px;
            box-shadow: 0 2px 8px rgba(0,0,0,0.15);
            z-index: 10001;
            width: 200px;
            max-height: 200px;
            overflow-y: auto;
            display: none;
        `;
        
        // Create dropdown options
        this.dropdownOptions = [
            { value: '/normal', label: 'Normal Mode', description: 'Standard chat mode' },
            { value: '/detailed', label: 'Detailed Mode', description: 'Long, detailed responses' },
            { value: '/picture', label: 'Picture Mode', description: 'Image-focused responses' },
            { value: '/code', label: 'Code Mode', description: 'GPT Codex for coding help' }
        ];
        
        this.dropdownOptions.forEach((option, index) => {
            const optionElement = document.createElement('div');
            optionElement.className = 'dropdown-option';
            optionElement.dataset.value = option.value;
            optionElement.dataset.index = index;
            optionElement.style.cssText = `
                padding: 10px 15px;
                cursor: pointer;
                border-bottom: 1px solid #eee;
            `;
            
            optionElement.innerHTML = `
                <div style="font-weight: bold; font-size: 14px;">${option.label}</div>
                <div style="font-size: 12px; color: #666;">${option.description}</div>
            `;
            
            optionElement.addEventListener('click', () => {
                this.selectOption(option.value);
            });
            
            optionElement.addEventListener('mouseenter', () => {
                this.highlightOption(index);
            });
            
            this.dropdown.appendChild(optionElement);
        });
        
        // Add to document
        document.body.appendChild(this.dropdown);
        this.dropdownVisible = false;
        this.selectedIndex = -1;
    };

    AIAssistant.prototype.showDropdown = function() {
        if (this.userInput && this.dropdown) {
            const rect = this.userInput.getBoundingClientRect();
            this.dropdown.style.display = 'block';
            this.dropdown.style.top = (rect.bottom + window.scrollY) + 'px';
            this.dropdown.style.left = (rect.left + window.scrollX) + 'px';
            this.dropdownVisible = true;
            this.selectedIndex = -1;
            this.clearHighlights();
        }
    };

    AIAssistant.prototype.hideDropdown = function() {
        if (this.dropdown) {
            this.dropdown.style.display = 'none';
            this.dropdownVisible = false;
            this.selectedIndex = -1;
        }
    };

    AIAssistant.prototype.filterDropdownOptions = function(inputValue) {
        const searchTerm = inputValue.substring(1).toLowerCase();
        const options = this.dropdown.querySelectorAll('.dropdown-option');
        
        options.forEach((option, index) => {
            const label = this.dropdownOptions[index].label.toLowerCase();
            const description = this.dropdownOptions[index].description.toLowerCase();
            
            if (label.includes(searchTerm) || description.includes(searchTerm)) {
                option.style.display = 'block';
            } else {
                option.style.display = 'none';
            }
        });
    };

    AIAssistant.prototype.selectNextOption = function() {
        const visibleOptions = Array.from(this.dropdown.querySelectorAll('.dropdown-option'))
            .filter(opt => opt.style.display !== 'none');
        
        if (visibleOptions.length > 0) {
            this.selectedIndex = (this.selectedIndex + 1) % visibleOptions.length;
            this.highlightOption(visibleOptions[this.selectedIndex].dataset.index);
        }
    };

    AIAssistant.prototype.selectPreviousOption = function() {
        const visibleOptions = Array.from(this.dropdown.querySelectorAll('.dropdown-option'))
            .filter(opt => opt.style.display !== 'none');
        
        if (visibleOptions.length > 0) {
            this.selectedIndex = (this.selectedIndex - 1 + visibleOptions.length) % visibleOptions.length;
            this.highlightOption(visibleOptions[this.selectedIndex].dataset.index);
        }
    };

    AIAssistant.prototype.selectCurrentOption = function() {
        const visibleOptions = Array.from(this.dropdown.querySelectorAll('.dropdown-option'))
            .filter(opt => opt.style.display !== 'none');
        
        if (this.selectedIndex >= 0 && this.selectedIndex < visibleOptions.length) {
            const selectedOption = visibleOptions[this.selectedIndex];
            this.selectOption(selectedOption.dataset.value);
        }
    };

    AIAssistant.prototype.highlightOption = function(index) {
        this.clearHighlights();
        const option = this.dropdown.querySelector(`[data-index="${index}"]`);
        if (option) {
            option.style.backgroundColor = '#e0e7ff';
        }
    };

    AIAssistant.prototype.clearHighlights = function() {
        const options = this.dropdown.querySelectorAll('.dropdown-option');
        options.forEach(option => {
            option.style.backgroundColor = '';
        });
    };

    AIAssistant.prototype.selectOption = function(value) {
        if (this.userInput) {
            this.userInput.value = value;
            this.hideDropdown();
            // Clear the input after a short delay to allow processing
            setTimeout(() => {
                this.userInput.value = '';
            }, 100);
            this.processCommand(value); // Automatically process the command and switch mode
        }
    };

    AIAssistant.prototype.processCommand = function(command) {
        // Add command to chat history as a system message
        this.addMessageToChat('system', `Command: ${command}`, true);
        
        // Process different commands
        switch (command.toLowerCase()) {
            case '/normal':
                this.switchToNormalMode();
                break;
            case '/detailed':
                this.switchToDetailedMode();
                break;
            case '/picture':
                this.switchToPictureMode();
                break;
            case '/code':
                this.switchToCodeMode();
                break;
            default:
                this.handleUnknownCommand(command);
                break;
        }
    };

    AIAssistant.prototype.switchToNormalMode = function() {
        this.currentMode = 'normal';
        this.modeHistory = this.modeHistory || [];
        this.modeHistory.push({ mode: 'normal', timestamp: Date.now() });
        
        // Show success message
        this.addMessageToChat('system', '✅ Switched to Normal Mode. Standard chat responses.', true);
        
        // In normal mode, keep UI as is but show mode indicator
        this.showModeIndicator('NORMAL');
    };

    AIAssistant.prototype.switchToDetailedMode = function() {
        this.currentMode = 'detailed';
        this.modeHistory = this.modeHistory || [];
        this.modeHistory.push({ mode: 'detailed', timestamp: Date.now() });
        
        // Show success message
        this.addMessageToChat('system', '✅ Switched to Detailed Mode. Long, comprehensive responses.', true);
        
        // In detailed mode, show mode indicator
        this.showModeIndicator('DETAILED');
    };

    AIAssistant.prototype.switchToPictureMode = function() {
        this.currentMode = 'picture';
        this.modeHistory = this.modeHistory || [];
        this.modeHistory.push({ mode: 'picture', timestamp: Date.now() });
        
        // Show success message
        this.addMessageToChat('system', '✅ Switched to Picture Mode. Image-focused responses.', true);
        
        // In picture mode, prepare for image responses
        this.showModeIndicator('PICTURE');
    };

    AIAssistant.prototype.switchToCodeMode = function() {
        this.currentMode = 'code';
        this.modeHistory = this.modeHistory || [];
        this.modeHistory.push({ mode: 'code', timestamp: Date.now() });
        
        // Show success message
        this.addMessageToChat('system', '✅ Switched to Code Mode. GPT Codex for coding assistance.', true);
        
        // In code mode, show mode indicator
        this.showModeIndicator('CODE');
    };

    AIAssistant.prototype.handleUnknownCommand = function(command) {
        // Default unknown command message
        this.addMessageToChat('system', `❓ Unknown command: ${command}\n\nAvailable commands:\n• /normal - Standard chat mode\n• /detailed - Long, detailed responses\n• /picture - Image-focused responses\n• /code - GPT Codex for coding help`, true);
    };

    AIAssistant.prototype.showModeIndicator = function(mode) {
        // Create or update a mode indicator in the UI
        let indicator = document.getElementById('mode-indicator');
        if (!indicator) {
            indicator = document.createElement('div');
            indicator.id = 'mode-indicator';
            indicator.style.cssText = `
                position: fixed;
                top: 10px;
                right: 10px;
                padding: 5px 10px;
                background: #4f46e5;
                color: white;
                border-radius: 4px;
                font-size: 12px;
                font-weight: bold;
                z-index: 10000;
                box-shadow: 0 2px 4px rgba(0,0,0,0.2);
            `;
            document.body.appendChild(indicator);
        }
        indicator.textContent = `MODE: ${mode}`;
    };

    AIAssistant.prototype.addMessageToChat = function(role, content, isSystem = false) {
        // Create a temporary message element to show system messages
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        if (isSystem) {
            messageDiv.classList.add('system-message');
            messageDiv.style.cssText = `
                background: #f3f4f6;
                border-left: 4px solid #4f46e5;
                padding: 12px 16px;
                margin: 8px 0;
                border-radius: 0 8px 8px 8px;
                font-size: 14px;
                font-style: italic;
            `;
        }
        
        messageDiv.innerHTML = `
            <div class="message-content">
                ${this.escapeHtml(content)}
            </div>
            <div class="message-meta">
                ${new Date().toLocaleTimeString()}
            </div>
        `;
        
        // Add to chat container
        if (this.chatContainer) {
            this.chatContainer.appendChild(messageDiv);
            this.scrollToBottom();
        }
    };

    AIAssistant.prototype.escapeHtml = function(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    };

    AIAssistant.prototype.scrollToBottom = function() {
        if (this.chatContainer) {
            this.chatContainer.scrollTop = this.chatContainer.scrollHeight;
        }
    };

    // Initialize the mode system when the AIAssistant is instantiated
    const originalInitializeApp = AIAssistant.prototype.initializeApp;
    AIAssistant.prototype.initializeApp = function() {
        // Set initial mode
        this.currentMode = 'normal';
        this.modeHistory = [];
        
        // Call the original initializeApp method
        if (originalInitializeApp) {
            originalInitializeApp.call(this);
        }
        
        // Set up command listener after initialization
        this.setupCommandListener();
        
        // Show initial mode indicator
        this.showModeIndicator('NORMAL');
    };
})();

// Ensure updateChatsList method exists to prevent errors
if (!AIAssistant.prototype.updateChatsList) {
    AIAssistant.prototype.updateChatsList = function() {
        // This method updates the chat list in the sidebar
        // It's a wrapper for renderChatsList
        if (this.renderChatsList) {
            this.renderChatsList();
        }
    };
}