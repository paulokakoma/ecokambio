/**
 * Ana Chat Widget - EcoKambio AI Assistant
 * Floating chat widget that connects to the Groq-powered chat API
 */

class AnaChatWidget {
    constructor(options = {}) {
        this.options = {
            position: options.position || 'bottom-right',
            primaryColor: options.primaryColor || '#10b981',
            initialMessage: options.initialMessage || 'Olá! Sou a Ana, assistente virtual da EcoKambio. Como posso ajudar? 😊',
            ...options
        };
        this.isOpen = false;
        this.messages = [];
        this.isLoading = false;
        this.init();
    }

    init() {
        this.createStyles();
        this.createWidget();
        this.attachEventListeners();
        // Add initial bot message
        this.addMessage('bot', this.options.initialMessage);
    }

    createStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .ana-chat-widget {
                position: fixed;
                bottom: 20px;
                right: 20px;
                z-index: 9999;
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
            }

            .ana-chat-button {
                width: 60px;
                height: 60px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #14b8a6 100%);
                border: none;
                cursor: pointer;
                box-shadow: 0 4px 20px rgba(16, 185, 129, 0.4);
                display: flex;
                align-items: center;
                justify-content: center;
                transition: all 0.3s ease;
            }

            .ana-chat-button:hover {
                transform: scale(1.1);
                box-shadow: 0 6px 25px rgba(16, 185, 129, 0.5);
            }

            .ana-chat-button svg {
                width: 28px;
                height: 28px;
                fill: white;
            }

            .ana-chat-window {
                position: absolute;
                bottom: 80px;
                right: 0;
                width: 380px;
                max-width: calc(100vw - 40px);
                height: 500px;
                max-height: calc(100vh - 120px);
                background: white;
                border-radius: 16px;
                box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
                display: none;
                flex-direction: column;
                overflow: hidden;
                animation: ana-slide-up 0.3s ease;
            }

            .ana-chat-window.open {
                display: flex;
            }

            @keyframes ana-slide-up {
                from {
                    opacity: 0;
                    transform: translateY(20px);
                }
                to {
                    opacity: 1;
                    transform: translateY(0);
                }
            }

            .ana-chat-header {
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #14b8a6 100%);
                color: white;
                padding: 16px;
                display: flex;
                align-items: center;
                gap: 12px;
            }

            .ana-chat-avatar {
                width: 40px;
                height: 40px;
                background: rgba(255,255,255,0.2);
                border-radius: 50%;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 20px;
            }

            .ana-chat-info h3 {
                margin: 0;
                font-size: 16px;
                font-weight: 600;
            }

            .ana-chat-info p {
                margin: 2px 0 0;
                font-size: 12px;
                opacity: 0.9;
            }

            .ana-chat-close {
                margin-left: auto;
                background: none;
                border: none;
                color: white;
                cursor: pointer;
                padding: 4px;
                opacity: 0.8;
                transition: opacity 0.2s;
            }

            .ana-chat-close:hover {
                opacity: 1;
            }

            .ana-chat-messages {
                flex: 1;
                overflow-y: auto;
                padding: 16px;
                display: flex;
                flex-direction: column;
                gap: 12px;
                background: #f9fafb;
            }

            .ana-message {
                max-width: 85%;
                padding: 12px 16px;
                border-radius: 16px;
                font-size: 14px;
                line-height: 1.5;
                animation: ana-fade-in 0.3s ease;
            }

            @keyframes ana-fade-in {
                from { opacity: 0; transform: translateY(10px); }
                to { opacity: 1; transform: translateY(0); }
            }

            .ana-message.bot {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 16px 16px 16px 4px;
                align-self: flex-start;
            }

            .ana-message.user {
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #14b8a6 100%);
                color: white;
                border-radius: 16px 16px 4px 16px;
                align-self: flex-end;
            }

            .ana-message.loading {
                background: white;
                border: 1px solid #e5e7eb;
            }

            .ana-typing-indicator {
                display: flex;
                gap: 4px;
                padding: 4px 0;
            }

            .ana-typing-indicator span {
                width: 8px;
                height: 8px;
                background: #9ca3af;
                border-radius: 50%;
                animation: ana-bounce 1.4s infinite ease-in-out both;
            }

            .ana-typing-indicator span:nth-child(1) { animation-delay: -0.32s; }
            .ana-typing-indicator span:nth-child(2) { animation-delay: -0.16s; }

            @keyframes ana-bounce {
                0%, 80%, 100% { transform: scale(0); }
                40% { transform: scale(1); }
            }

            .ana-chat-input-area {
                padding: 12px 16px;
                border-top: 1px solid #e5e7eb;
                background: white;
                display: flex;
                gap: 8px;
            }

            .ana-chat-input {
                flex: 1;
                border: 1px solid #e5e7eb;
                border-radius: 24px;
                padding: 10px 16px;
                font-size: 14px;
                outline: none;
                transition: border-color 0.2s;
            }

            .ana-chat-input:focus {
                border-color: ${this.options.primaryColor};
            }

            .ana-chat-send {
                width: 40px;
                height: 40px;
                border-radius: 50%;
                background: linear-gradient(135deg, ${this.options.primaryColor} 0%, #14b8a6 100%);
                border: none;
                cursor: pointer;
                display: flex;
                align-items: center;
                justify-content: center;
                transition: transform 0.2s;
            }

            .ana-chat-send:hover {
                transform: scale(1.05);
            }

            .ana-chat-send:disabled {
                opacity: 0.5;
                cursor: not-allowed;
            }

            .ana-chat-send svg {
                width: 18px;
                height: 18px;
                fill: white;
            }

            .ana-quick-actions {
                display: flex;
                flex-wrap: wrap;
                gap: 8px;
                padding: 8px 16px 16px;
                background: #f9fafb;
            }

            .ana-quick-btn {
                background: white;
                border: 1px solid #e5e7eb;
                border-radius: 16px;
                padding: 8px 14px;
                font-size: 12px;
                cursor: pointer;
                transition: all 0.2s;
            }

            .ana-quick-btn:hover {
                background: ${this.options.primaryColor};
                color: white;
                border-color: ${this.options.primaryColor};
            }

            @media (max-width: 480px) {
                .ana-chat-window {
                    width: 100%;
                    height: 100%;
                    max-height: 100%;
                    bottom: 0;
                    right: 0;
                    border-radius: 0;
                }
            }
        `;
        document.head.appendChild(style);
    }

    createWidget() {
        const widget = document.createElement('div');
        widget.className = 'ana-chat-widget';
        widget.innerHTML = `
            <div class="ana-chat-window">
                <div class="ana-chat-header">
                    <div class="ana-chat-avatar">👩‍💻</div>
                    <div class="ana-chat-info">
                        <h3>Ana - EcoKambio</h3>
                        <p>🟢 Online agora</p>
                    </div>
                    <button class="ana-chat-close">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M18 6L6 18M6 6l12 12"/>
                        </svg>
                    </button>
                </div>
                <div class="ana-chat-messages" id="ana-messages"></div>
                <div class="ana-quick-actions">
                    <button class="ana-quick-btn" data-question="Quanto custa o cartão Visa?">💳 Preço Visa</button>
                    <button class="ana-quick-btn" data-question="Como funciona o câmbio?">📊 Câmbio</button>
                    <button class="ana-quick-btn" data-question="Quem é a EcoKambio?">🏢 Sobre nós</button>
                </div>
                <div class="ana-chat-input-area">
                    <input type="text" class="ana-chat-input" placeholder="Escreva a sua pergunta..." id="ana-input">
                    <button class="ana-chat-send" id="ana-send">
                        <svg viewBox="0 0 24 24">
                            <path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/>
                        </svg>
                    </button>
                </div>
            </div>
            <button class="ana-chat-button" id="ana-toggle">
                <svg viewBox="0 0 24 24">
                    <path d="M20 2H4c-1.1 0-2 .9-2 2v18l4-4h14c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm0 14H6l-2 2V4h16v12z"/>
                </svg>
            </button>
        `;
        document.body.appendChild(widget);
        this.widget = widget;
        this.chatWindow = widget.querySelector('.ana-chat-window');
        this.messagesContainer = widget.querySelector('#ana-messages');
        this.input = widget.querySelector('#ana-input');
        this.sendButton = widget.querySelector('#ana-send');
    }

    attachEventListeners() {
        // Toggle chat
        this.widget.querySelector('#ana-toggle').addEventListener('click', () => this.toggle());
        this.widget.querySelector('.ana-chat-close').addEventListener('click', () => this.close());

        // Send message
        this.sendButton.addEventListener('click', () => this.sendMessage());
        this.input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // Quick actions
        this.widget.querySelectorAll('.ana-quick-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const question = btn.dataset.question;
                this.input.value = question;
                this.sendMessage();
            });
        });
    }

    toggle() {
        this.isOpen ? this.close() : this.open();
    }

    open() {
        this.isOpen = true;
        this.chatWindow.classList.add('open');
        this.input.focus();
    }

    close() {
        this.isOpen = false;
        this.chatWindow.classList.remove('open');
    }

    addMessage(type, content) {
        const message = document.createElement('div');
        message.className = `ana-message ${type}`;
        message.innerHTML = content;
        this.messagesContainer.appendChild(message);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
        return message;
    }

    showTyping() {
        const typing = document.createElement('div');
        typing.className = 'ana-message bot loading';
        typing.id = 'ana-typing';
        typing.innerHTML = `
            <div class="ana-typing-indicator">
                <span></span><span></span><span></span>
            </div>
        `;
        this.messagesContainer.appendChild(typing);
        this.messagesContainer.scrollTop = this.messagesContainer.scrollHeight;
    }

    hideTyping() {
        const typing = document.getElementById('ana-typing');
        if (typing) typing.remove();
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text || this.isLoading) return;

        // Add user message
        this.addMessage('user', text);
        this.input.value = '';
        this.isLoading = true;
        this.sendButton.disabled = true;

        // Show typing indicator
        this.showTyping();

        try {
            const response = await fetch('/api/v1/chat', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ message: text })
            });

            const data = await response.json();
            this.hideTyping();

            if (data.response) {
                this.addMessage('bot', data.response);
            } else if (data.error) {
                this.addMessage('bot', '😕 Desculpa, houve um problema. Tenta novamente ou contacta-nos via WhatsApp: +244 938 948 994');
            }
        } catch (error) {
            console.error('Chat error:', error);
            this.hideTyping();
            this.addMessage('bot', '😕 Não consegui conectar. Verifica a tua internet ou contacta-nos via WhatsApp: +244 938 948 994');
        }

        this.isLoading = false;
        this.sendButton.disabled = false;
    }
}

// Auto-initialize if data attribute present
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('[data-ana-chat]')) {
        window.anaChat = new AnaChatWidget();
    }
});

// Export for manual initialization
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AnaChatWidget;
} else {
    window.AnaChatWidget = AnaChatWidget;
}
