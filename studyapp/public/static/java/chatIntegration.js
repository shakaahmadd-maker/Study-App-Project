/**
 * Chat Integration Module
 * Integrates chat with backend WebSocket and API
 */

// Global chat WebSocket connections - prevent redeclaration
if (typeof window.chatConnections === 'undefined') {
    window.chatConnections = new Map();
}
const chatConnections = window.chatConnections;

/**
 * Initialize WebSocket chat for a thread
 */
function initChatWebSocket(threadId, onMessage, onError) {
    if (chatConnections.has(threadId)) {
        // Already connected
        return chatConnections.get(threadId);
    }

    const chat = new ChatWebSocket(threadId);

    chat.connect(
        (message) => {
            if (onMessage) onMessage(message);
        },
        (error) => {
            console.error('Chat WebSocket error:', error);
            if (onError) onError(error);
        }
    );

    chatConnections.set(threadId, chat);
    return chat;
}

/**
 * Send message via WebSocket or API fallback
 */
async function sendChatMessage(threadId, content) {
    const chat = chatConnections.get(threadId);

    if (chat && chat.ws && chat.ws.readyState === WebSocket.OPEN) {
        // Send via WebSocket
        chat.sendMessage(content);
    } else {
        // Fallback to API
        if (typeof apiClient !== 'undefined') {
            try {
                await apiClient.sendMessage(threadId, content);
            } catch (error) {
                console.error('Error sending message via API:', error);
                throw error;
            }
        } else {
            console.error('API client not available');
            throw new Error('Cannot send message: API client not available');
        }
    }
}

/**
 * Load chat messages from API
 */
async function loadChatMessages(threadId) {
    if (typeof apiClient === 'undefined') {
        console.warn('API client not loaded');
        return [];
    }

    try {
        const messages = await apiClient.getThreadMessages(threadId);
        return messages.results || messages || [];
    } catch (error) {
        console.error('Error loading messages:', error);
        return [];
    }
}

/**
 * Initialize chat for a thread (load messages and connect WebSocket)
 */
async function initializeChat(threadId, messageContainer, messageInput, sendButton) {
    // Load existing messages
    const messages = await loadChatMessages(threadId);

    // Render messages
    if (messageContainer) {
        messageContainer.innerHTML = '';
        messages.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${msg.sender_role === localStorage.getItem('user_role') ? 'outbound' : 'inbound'}`;
            messageDiv.innerHTML = `
                <span class="message-meta">${msg.sender_role} · ${new Date(msg.created_at).toLocaleTimeString()}</span>
                <p class="message-text">${msg.content}</p>
            `;
            messageContainer.appendChild(messageDiv);
        });
        scrollToBottom(messageContainer);
    }

    // Connect WebSocket
    const chat = initChatWebSocket(threadId, (message) => {
        // Handle incoming message
        if (messageContainer && message.type === 'message') {
            const messageDiv = document.createElement('div');
            messageDiv.className = `message ${message.sender_role === localStorage.getItem('user_role') ? 'outbound' : 'inbound'}`;
            messageDiv.innerHTML = `
                <span class="message-meta">${message.sender_role} · ${new Date(message.timestamp).toLocaleTimeString()}</span>
                <p class="message-text">${message.content}</p>
            `;
            messageContainer.appendChild(messageDiv);
            scrollToBottom(messageContainer);
        }
    });

    // Set up send button
    if (sendButton && messageInput) {
        sendButton.addEventListener('click', async () => {
            const content = messageInput.value.trim();
            if (!content) return;

            try {
                await sendChatMessage(threadId, content);
                messageInput.value = '';
            } catch (error) {
                alert('Failed to send message. Please try again.');
            }
        });

        messageInput.addEventListener('keypress', async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const content = messageInput.value.trim();
                if (!content) return;

                try {
                    await sendChatMessage(threadId, content);
                    messageInput.value = '';
                } catch (error) {
                    alert('Failed to send message. Please try again.');
                }
            }
        });
    }

    return chat;
}

/**
 * Disconnect chat WebSocket
 */
function disconnectChat(threadId) {
    const chat = chatConnections.get(threadId);
    if (chat) {
        chat.disconnect();
        chatConnections.delete(threadId);
    }
}

/**
 * Scroll to bottom of message container
 */
function scrollToBottom(container) {
    if (container) {
        container.scrollTop = container.scrollHeight;
    }
}
