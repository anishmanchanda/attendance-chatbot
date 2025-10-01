const qrcode = require('qrcode-terminal');
const { Client, MessageMedia } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Create WhatsApp client
const client = new Client();
let messageHandler = null;

// Generate QR code for login
client.on('qr', (qr) => {
    console.log('🔗 Scan this QR code with your WhatsApp app:');
    qrcode.generate(qr, { small: true });
    console.log('👆 Point your phone camera at the QR code above');
});

client.on('ready', () => {
    console.log('✅ WhatsApp client is ready and connected!');
    console.log('🤖 Your attendance bot is now active');
});

client.on('disconnected', (reason) => {
    console.log('❌ WhatsApp client was disconnected:', reason);
});

// Handle incoming messages
client.on('message', async (message) => {
    try {
        // Skip messages from groups or status updates
        if (message.isGroup || message.isStatus) return;
        
        console.log(`📱 Received message from ${message.from}: ${message.body}`);
        
        // Process the message using our message handler
        if (messageHandler) {
            const processedMessage = await parseIncomingMessage(message);
            await messageHandler(processedMessage);
        }
    } catch (error) {
        console.error("❌ Error processing message:", error);
        await sendMessage(message.from, "Sorry, I encountered an error. Please try again later.");
    }
});

// Parse incoming message to standard format
async function parseIncomingMessage(message) {
    const processedMessage = {
        from: message.from,
        type: 'text',
        content: message.body,
        timestamp: new Date()
    };

    // Handle media messages (images, documents)
    if (message.hasMedia) {
        try {
            const media = await message.downloadMedia();
            
            // Save media to temp file
            const tempDir = path.join(__dirname, '..', 'uploads');
            if (!fs.existsSync(tempDir)) {
                fs.mkdirSync(tempDir, { recursive: true });
            }
            
            const fileName = `${Date.now()}-${message.id.id}`;
            const filePath = path.join(tempDir, fileName);
            
            // Write media data to file
            fs.writeFileSync(filePath, media.data, 'base64');
            
            processedMessage.type = media.mimetype.startsWith('image/') ? 'image' : 'document';
            processedMessage.mediaPath = filePath;
            processedMessage.mimetype = media.mimetype;
            
            console.log(`📎 Saved media file: ${fileName}`);
        } catch (error) {
            console.error('❌ Error downloading media:', error);
        }
    }

    return processedMessage;
}

// Send message to a phone number
async function sendMessage(phoneNumber, messageText) {
    try {
        // Ensure phone number format is correct
        const formattedNumber = phoneNumber.includes('@c.us') ? phoneNumber : `${phoneNumber}@c.us`;
        
        await client.sendMessage(formattedNumber, messageText);
        console.log(`✅ Sent message to ${phoneNumber}: ${messageText.substring(0, 50)}...`);
        return true;
    } catch (error) {
        console.error(`❌ Failed to send message to ${phoneNumber}:`, error);
        return false;
    }
}

// Handle incoming messages from main app
async function handleIncomingMessage(body) {
    // This function is for WhatsApp Business API webhook
    // For now, we'll focus on whatsapp-web.js
    console.log('📨 Webhook message received:', body);
    return null;
}

// Register message handler from main app
function registerMessageHandler(handler) {
    messageHandler = handler;
    console.log('🔗 Message handler registered');
}

// Initialize WhatsApp connection
function init() {
    console.log('🚀 Initializing WhatsApp client...');
    client.initialize();
}

// Get client status
function getStatus() {
    return client.info;
}

module.exports = { 
    init, 
    sendMessage, 
    handleIncomingMessage, 
    registerMessageHandler,
    getStatus 
};