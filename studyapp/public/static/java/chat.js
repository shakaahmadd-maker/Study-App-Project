// Chat Window Functionality
document.addEventListener('DOMContentLoaded', function () {
    const chatWindow = document.getElementById('chatWindow');
    const chatBubbleBtn = document.getElementById('chatBubbleBtn');
    const closeChatBtn = document.getElementById('closeChatBtn');
    const chatInput = document.getElementById('chatInput');
    const sendBtn = document.getElementById('sendBtn');
    const chatMessages = document.getElementById('chatMessages');

    let isChatOpen = false;

    // Toggle chat window
    function toggleChat() {
        isChatOpen = !isChatOpen;
        if (isChatOpen) {
            chatWindow.classList.remove('chat-closed');
            chatWindow.classList.add('chat-open');
            chatInput.focus();
        } else {
            chatWindow.classList.remove('chat-open');
            chatWindow.classList.add('chat-closed');
        }
    }

    // Close chat window
    function closeChat() {
        isChatOpen = false;
        chatWindow.classList.remove('chat-open');
        chatWindow.classList.add('chat-closed');
    }

    // Add message to chat
    function addMessage(message, isUser = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'flex items-start gap-2 chat-message';

        if (isUser) {
            messageDiv.innerHTML = `
                <div class="flex-1"></div>
                <div class="bg-[var(--primary-color)] text-white rounded-lg p-3 max-w-[80%]">
                    <p class="text-sm">${message}</p>
                    <span class="text-xs text-white/80 mt-1 block">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        } else {
            messageDiv.innerHTML = `
                <div class="w-6 h-6 bg-[var(--primary-color)]/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <span class="material-symbols-outlined text-xs text-[var(--primary-color)]">support_agent</span>
                </div>
                <div class="bg-gray-100 rounded-lg p-3 max-w-[80%]">
                    <p class="text-sm text-gray-800">${message}</p>
                    <span class="text-xs text-gray-500 mt-1 block">${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                </div>
            `;
        }

        chatMessages.appendChild(messageDiv);
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }

    // Send message
    function sendMessage() {
        const message = chatInput.value.trim();
        if (message) {
            addMessage(message, true);
            chatInput.value = '';

            // Simulate bot response
            setTimeout(() => {
                const responses = [
                    "Thank you for your message! How can I help you with Nano Problems?",
                    "I'm here to assist you. What specific subject or topic would you like help with?",
                    "Great question! Let me connect you with the right information.",
                    "I understand you need help. Can you tell me more about your academic goals?",
                    "That's a great question! Our tutors are experts in that area. Would you like to schedule a session?"
                ];
                const randomResponse = responses[Math.floor(Math.random() * responses.length)];
                addMessage(randomResponse, false);
            }, 1000);
        }
    }

    // Event listeners
    chatBubbleBtn.addEventListener('click', toggleChat);
    closeChatBtn.addEventListener('click', closeChat);
    sendBtn.addEventListener('click', sendMessage);

    chatInput.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // Close chat when clicking outside
    document.addEventListener('click', function (e) {
        if (isChatOpen && !chatWindow.contains(e.target) && !chatBubbleBtn.contains(e.target)) {
            closeChat();
        }
    });

    // Initialize chat as closed
    chatWindow.classList.add('chat-closed');
});
