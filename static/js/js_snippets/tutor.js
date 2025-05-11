// Auto-resize textarea
function autoResize(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = textarea.scrollHeight + 'px';
}

// Handle file selection
document.getElementById('file-input').addEventListener('change', function (e) {
    const files = Array.from(e.target.files);
    files.forEach(file => {
        if (file.type.startsWith('image/')) {
            const reader = new FileReader();
            reader.onload = function (e) {
                addAttachmentPreview(e.target.result);
            };
            reader.readAsDataURL(file);
        }
    });
});

// Add attachment preview
function addAttachmentPreview(dataUrl) {
    const messageInput = document.getElementById('message-input');
    const preview = document.createElement('img');
    preview.src = dataUrl;
    preview.classList.add('message-image');
    messageInput.parentElement.appendChild(preview);
}

// Send message
async function sendMessage() {
    const messageInput = document.getElementById('message-input');
    const message = messageInput.value.trim();
    const attachments = Array.from(messageInput.parentElement.querySelectorAll('.message-image')).map(img => img.src);

    if (message || attachments.length > 0) {
        // Add user message to chat
        addMessage(message, attachments, true);
        messageInput.value = '';
        messageInput.style.height = 'auto';

        // Remove attachment previews
        messageInput.parentElement.querySelectorAll('.message-image').forEach(img => img.remove());

        // Show typing indicator while waiting for response
        showTypingIndicator();

        try {
            // Send request to tutor endpoint
            const response = await fetch('/api/tutor', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    message: message
                })
            });

            const data = await response.json();

            // Remove typing indicator
            removeTypingIndicator();

            if (data.error) {
                addMessage("Sorry, I encountered an error: " + data.error, [], false);
            } else {
                addMessage(data.response, [], false);
            }

        } catch (error) {
            removeTypingIndicator();
            addMessage("Sorry, I encountered an error while processing your request.", [], false);
            console.error('Error:', error);
        }
    }
}

// Show typing indicator
function showTypingIndicator() {
    const typingIndicator = document.createElement('div');
    typingIndicator.classList.add('typing-indicator');
    typingIndicator.innerHTML = `
                <div class="message-avatar">T</div>
                <div class="message-content">
                    <div class="typing-dots">
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                        <div class="typing-dot"></div>
                    </div>
                </div>
            `;
    document.getElementById('chat-messages').appendChild(typingIndicator);
    scrollToBottom();
}

// Remove typing indicator
function removeTypingIndicator() {
    const typingIndicator = document.querySelector('.typing-indicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// Add message to chat
function addMessage(text, attachments = [], isUser = false) {
    const chatMessages = document.getElementById('chat-messages');
    const messageDiv = document.createElement('div');
    messageDiv.classList.add('message', isUser ? 'user' : 'tutor');

    const contentDiv = document.createElement('div');
    contentDiv.classList.add('message-content');

    // Convert newlines to <br>
    const formattedText = text.replace(/\n/g, '<br>');
    contentDiv.innerHTML = `<p class="message-text">${formattedText}</p>`;

    // Append attachments if any
    attachments.forEach(src => {
        const img = document.createElement('img');
        img.src = src;
        img.classList.add('message-image');
        contentDiv.appendChild(img);
    });

    messageDiv.appendChild(contentDiv);
    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}


// Scroll to bottom of chat
function scrollToBottom() {
    const messagesContainer = document.getElementById('chat-messages');
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
}

// Handle Enter key
document.getElementById('message-input').addEventListener('keydown', function (e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
});

// Add initial message
addMessage("Hello! How can I assist you today?", [], false);