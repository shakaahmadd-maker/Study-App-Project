// Messages Interface JavaScript

// Make initializeMessages available globally
window.MessagesInterface = {
    initializeMessages: function () {
        // Initialize the messages interface
        initializeMessages();
    }
};

function initializeMessages() {
    // Get DOM elements
    const contactItems = document.querySelectorAll('.contact-item');
    const chatMessages = document.getElementById('chatMessages');
    const messageInput = document.querySelector('.message-input');
    const sendButton = document.querySelector('.send-button');
    const searchInput = document.querySelector('.search-input');
    const chatTitle = document.querySelector('.chat-title');

    // Contact switching functionality
    contactItems.forEach(item => {
        item.addEventListener('click', function () {
            // Remove active class from all contacts
            contactItems.forEach(contact => contact.classList.remove('active'));

            // Add active class to clicked contact
            this.classList.add('active');

            // Update chat title
            const contactName = this.querySelector('.contact-name').textContent;
            chatTitle.textContent = contactName;

            // Load messages for this contact (in a real app, this would fetch from server)
            loadMessagesForContact(this.dataset.contact);
        });
    });

    // Send message functionality
    sendButton.addEventListener('click', sendMessage);
    messageInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // Search functionality
    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        filterContacts(searchTerm);
    });

    // Auto-scroll to bottom of messages
    scrollToBottom();
}

function sendMessage() {
    const messageInput = document.querySelector('.message-input');
    const message = messageInput.value.trim();

    if (message === '') return;

    // Add loading state to send button
    const sendButton = document.querySelector('.send-button');
    sendButton.classList.add('loading');

    // Create message element
    const messageElement = createMessageElement('Alex', message, 'receiver');

    // Add message to chat
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.appendChild(messageElement);

    // Clear input
    messageInput.value = '';

    // Scroll to bottom
    scrollToBottom();

    // Send message via API/WebSocket if available
    if (typeof apiClient !== 'undefined' && typeof sendChatMessage === 'function') {
        // Try to get thread ID from active contact
        const activeContact = document.querySelector('.contact-item.active');
        const threadId = activeContact?.dataset.threadId;

        if (threadId) {
            try {
                await sendChatMessage(threadId, message);
                sendButton.classList.remove('loading');
                // Message will be received via WebSocket
            } catch (error) {
                console.error('Error sending message:', error);
                sendButton.classList.remove('loading');
                // Fallback to mock response
                setTimeout(() => {
                    const responses = [
                        "Thanks for your message! I'll get back to you soon.",
                        "That's a great question. Let me think about it.",
                    ];
                    const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                    const responseElement = createMessageElement('Dr. Amelia Harper', randomResponse, 'sender');
                    chatMessages.appendChild(responseElement);
                    scrollToBottom();
                }, 1000);
            }
        } else {
            // No thread ID, use mock response
            sendButton.classList.remove('loading');
            setTimeout(() => {
                const responses = [
                    "Thanks for your message! I'll get back to you soon.",
                    "That's a great question. Let me think about it.",
                    "I understand your concern. Let's discuss this further.",
                    "Perfect! I'll help you with that.",
                    "Good point! Let me provide some guidance on that."
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                const responseElement = createMessageElement('Dr. Amelia Harper', randomResponse, 'sender');
                chatMessages.appendChild(responseElement);
                scrollToBottom();
            }, 1000);
        }
    } else {
        // API not available, use mock response
        setTimeout(() => {
            sendButton.classList.remove('loading');
            const responses = [
                "Thanks for your message! I'll get back to you soon.",
                "That's a great question. Let me think about it.",
                "I understand your concern. Let's discuss this further.",
                "Perfect! I'll help you with that.",
                "Good point! Let me provide some guidance on that."
            ];
            const randomResponse = responses[Math.floor(Math.random() * responses.length)];
            const responseElement = createMessageElement('Dr. Amelia Harper', randomResponse, 'sender');
            chatMessages.appendChild(responseElement);
            scrollToBottom();
        }, 1000);
    }
}

function createMessageElement(sender, message, type) {
    const messageGroup = document.createElement('div');
    messageGroup.className = `message-group ${type}-message`;

    const avatar = document.createElement('div');
    avatar.className = 'message-avatar';

    const avatarImg = document.createElement('img');
    if (type === 'sender') {
        avatarImg.src = 'https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face';
        avatarImg.alt = 'Dr. Amelia Harper';
    } else {
        avatarImg.src = 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=40&h=40&fit=crop&crop=face';
        avatarImg.alt = 'Alex';
    }
    avatar.appendChild(avatarImg);

    const messageContent = document.createElement('div');
    messageContent.className = 'message-content';

    const messageSender = document.createElement('div');
    messageSender.className = 'message-sender';
    messageSender.textContent = sender;

    const messageBubble = document.createElement('div');
    messageBubble.className = `message-bubble ${type}-bubble`;
    messageBubble.textContent = message;

    messageContent.appendChild(messageSender);
    messageContent.appendChild(messageBubble);

    if (type === 'sender') {
        messageGroup.appendChild(avatar);
        messageGroup.appendChild(messageContent);
    } else {
        messageGroup.appendChild(messageContent);
        messageGroup.appendChild(avatar);
    }

    return messageGroup;
}

function loadMessagesForContact(contactId) {
    // In a real application, this would fetch messages from the server
    // For now, we'll just show the existing messages
    console.log(`Loading messages for contact: ${contactId}`);

    // You could implement different message sets for different contacts here
    const chatMessages = document.getElementById('chatMessages');

    // Clear existing messages
    chatMessages.innerHTML = '';

    // Load default messages for Dr. Harper (or other contacts)
    if (contactId === 'dr-harper') {
        loadDefaultMessages();
    } else {
        // For other contacts, show a placeholder message
        const placeholderMessage = createMessageElement(
            'System',
            'Start a conversation with this tutor!',
            'sender'
        );
        chatMessages.appendChild(placeholderMessage);
    }

    scrollToBottom();
}

function loadDefaultMessages() {
    const chatMessages = document.getElementById('chatMessages');

    // Dr. Harper's first message
    const message1 = createMessageElement(
        'Dr. Amelia Harper',
        'Hi Alex, I\'ve reviewed your latest assignment and have some feedback. Let\'s schedule a quick meeting to discuss it further.',
        'sender'
    );
    chatMessages.appendChild(message1);

    // Alex's response
    const message2 = createMessageElement(
        'Alex',
        'Sounds good, Dr. Harper. When would be a good time for you?',
        'receiver'
    );
    chatMessages.appendChild(message2);

    // Dr. Harper's response
    const message3 = createMessageElement(
        'Dr. Amelia Harper',
        'I\'m available tomorrow afternoon, say around 2 PM?',
        'sender'
    );
    chatMessages.appendChild(message3);

    // Alex's response
    const message4 = createMessageElement(
        'Alex',
        '2 PM works for me. I\'ll send you a meeting invite.',
        'receiver'
    );
    chatMessages.appendChild(message4);

    // Dr. Harper's final message
    const message5 = createMessageElement(
        'Dr. Amelia Harper',
        'Great, see you then!',
        'sender'
    );
    chatMessages.appendChild(message5);
}

function filterContacts(searchTerm) {
    const contactItems = document.querySelectorAll('.contact-item');

    contactItems.forEach(item => {
        const contactName = item.querySelector('.contact-name').textContent.toLowerCase();
        const contactSubtitle = item.querySelector('.contact-subtitle').textContent.toLowerCase();

        if (contactName.includes(searchTerm) || contactSubtitle.includes(searchTerm)) {
            item.style.display = 'flex';
        } else {
            item.style.display = 'none';
        }
    });
}

function scrollToBottom() {
    const chatMessages = document.getElementById('chatMessages');
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Utility function to format timestamps (for future use)
function formatTimestamp(timestamp) {
    const date = new Date(timestamp);
    const now = new Date();
    const diffInHours = (now - date) / (1000 * 60 * 60);

    if (diffInHours < 24) {
        return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } else if (diffInHours < 48) {
        return 'Yesterday';
    } else {
        return date.toLocaleDateString();
    }
}

// Function to handle typing indicators (for future use)
function showTypingIndicator(contactName) {
    const chatMessages = document.getElementById('chatMessages');
    const typingElement = document.createElement('div');
    typingElement.className = 'message-group sender-message typing-indicator';
    typingElement.innerHTML = `
        <div class="message-avatar">
            <img src="https://images.unsplash.com/photo-1559839734-2b71ea197ec2?w=40&h=40&fit=crop&crop=face" alt="${contactName}">
        </div>
        <div class="message-content">
            <div class="message-bubble sender-bubble">
                <div class="typing-dots">
                    <span></span>
                    <span></span>
                    <span></span>
                </div>
            </div>
        </div>
    `;

    chatMessages.appendChild(typingElement);
    scrollToBottom();

    return typingElement;
}

// Function to remove typing indicator
function removeTypingIndicator(typingElement) {
    if (typingElement && typingElement.parentNode) {
        typingElement.parentNode.removeChild(typingElement);
    }
}

// Export functions for potential use in other modules
window.MessagesInterface = {
    sendMessage,
    createMessageElement,
    loadMessagesForContact,
    filterContacts,
    scrollToBottom,
    formatTimestamp,
    showTypingIndicator,
    removeTypingIndicator
};
