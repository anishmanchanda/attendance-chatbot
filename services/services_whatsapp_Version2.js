const qrcode = require('qrcode-terminal');
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Create WhatsApp client with enhanced configuration for better compatibility
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "attendance-bot"
    }),
    puppeteer: {
        // Enhanced Puppeteer options for better compatibility
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--single-process', // This helps with resource constraints
            '--disable-gpu',
            '--disable-web-security',
            '--disable-features=VizDisplayCompositor'
        ],
        timeout: 60000, // Increase timeout for slow systems
    },
    takeoverOnConflict: true,
    takeoverTimeoutMs: 60000
});

let messageHandler = null;
let isReady = false;

// Generate QR code for login
client.on('qr', (qr) => {
    console.log('');
    console.log('🔗 WHATSAPP LOGIN REQUIRED');
    console.log('=========================');
    qrcode.generate(qr, { small: true });
    console.log('📱 1. Open WhatsApp on your phone');
    console.log('📷 2. Go to Settings > Linked Devices');
    console.log('🔗 3. Tap "Link a Device"');
    console.log('📸 4. Point your camera at the QR code above');
    console.log('⏳ 5. Wait for connection...');
    console.log('');
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated successfully');
});

client.on('auth_failure', (message) => {
    console.error('❌ WhatsApp authentication failed:', message);
    console.log('💡 Try deleting the .wwebjs_auth folder and restart');
});

client.on('ready', () => {
    isReady = true;
    console.log('');
    console.log('🎉 WHATSAPP BOT IS READY!');
    console.log('========================');
    console.log('✅ WhatsApp client connected');
    console.log('🤖 Attendance bot is now active');
    console.log('📱 Send messages to test the bot');
    console.log('');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('❌ WhatsApp client disconnected:', reason);
    console.log('🔄 Attempting to reconnect...');
});

// Handle loading states
client.on('loading_screen', (percent, message) => {
    console.log(`⏳ Loading WhatsApp: ${percent}% - ${message}`);
});

// Handle incoming messages
client.on('message', async (message) => {
    try {
        // Skip messages from groups or status updates
        if (message.isGroup || message.isStatus) return;
        
        // Skip messages from self
        if (message.fromMe) return;
        
        console.log(`\n📱 NEW MESSAGE`);
        console.log(`From: ${message.from}`);
        console.log(`Type: ${message.type}`);
        console.log(`Content: ${message.body || '[Media]'}`);
        
        // Process the message using our message handler
        if (messageHandler && isReady) {
            const processedMessage = await parseIncomingMessage(message);
            await messageHandler(processedMessage);
        } else {
            console.log('⚠️ Bot not ready or no handler registered');
        }
    } catch (error) {
        console.error("❌ Error processing message:", error);
        try {
            await sendMessage(message.from, "Sorry, I encountered an error processing your message. Please try again.");
        } catch (sendError) {
            console.error("❌ Failed to send error message:", sendError);
        }
    }
});

// Parse incoming message to standard format
async function parseIncomingMessage(message) {
    const processedMessage = {
        from: message.from,
        type: 'text',
        content: message.body,
        timestamp: new Date(),
        messageId: message.id._serialized
    };

    // Handle media messages (images, documents, etc.)
    if (message.hasMedia) {
        try {
            console.log('📷 Processing media message...');
            const media = await message.downloadMedia();
            
            if (media) {
                processedMessage.type = 'media';
                processedMessage.media = {
                    mimetype: media.mimetype,
                    data: media.data,
                    filename: media.filename || `attachment_${Date.now()}`
                };
                
                // For images, set type to image
                if (media.mimetype.startsWith('image/')) {
                    processedMessage.type = 'image';
                }
                
                console.log(`✅ Media downloaded: ${media.mimetype}`);
            }
        } catch (error) {
            console.error('❌ Error downloading media:', error);
            processedMessage.content = '[Media - Download Failed]';
        }
    }

    return processedMessage;
}

// Send message to WhatsApp number
async function sendMessage(to, text) {
    try {
        if (!isReady) {
            console.log('⚠️ WhatsApp not ready, cannot send message');
            return false;
        }

        // Ensure the number has the correct format
        const formattedNumber = formatPhoneNumber(to);
        
        console.log(`📤 Sending to ${formattedNumber}: ${text.substring(0, 50)}...`);
        
        await client.sendMessage(formattedNumber, text);
        console.log('✅ Message sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

// Send media to WhatsApp number
async function sendMedia(to, media, caption = '') {
    try {
        if (!isReady) {
            console.log('⚠️ WhatsApp not ready, cannot send media');
            return false;
        }

        const formattedNumber = formatPhoneNumber(to);
        
        console.log(`📤 Sending media to ${formattedNumber}`);
        
        await client.sendMessage(formattedNumber, media, { caption });
        console.log('✅ Media sent successfully');
        return true;
    } catch (error) {
        console.error('❌ Error sending media:', error);
        return false;
    }
}

// Format phone number for WhatsApp
function formatPhoneNumber(number) {
    // Remove any non-digit characters except +
    let cleaned = number.replace(/[^\d+]/g, '');
    
    // If it starts with +, keep it
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    
    // Add country code if missing (assuming India +91, change as needed)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    
    return cleaned + '@c.us';
}

// Initialize the WhatsApp client
async function init() {
    try {
        console.log('🚀 Initializing WhatsApp client...');
        console.log('📱 This may take a few moments...');
        
        await client.initialize();
        
        // Set a timeout to detect if initialization is taking too long
        setTimeout(() => {
            if (!isReady) {
                console.log('⚠️ WhatsApp initialization taking longer than expected');
                console.log('💡 If this persists, try:');
                console.log('   1. Delete .wwebjs_auth folder');
                console.log('   2. Restart the application');
                console.log('   3. Check your internet connection');
            }
        }, 120000); // 2 minutes
        
        return true;
    } catch (error) {
        console.error('❌ Failed to initialize WhatsApp client:', error);
        console.log('💡 Troubleshooting tips:');
        console.log('   1. Make sure you have a stable internet connection');
        console.log('   2. Close other WhatsApp Web sessions');
        console.log('   3. Delete .wwebjs_auth folder and try again');
        console.log('   4. Restart your computer if issues persist');
        return false;
    }
}

// Register message handler
function registerMessageHandler(handler) {
    messageHandler = handler;
    console.log('✅ Message handler registered');
}

// Graceful shutdown
async function shutdown() {
    try {
        console.log('🔄 Shutting down WhatsApp client...');
        await client.destroy();
        console.log('✅ WhatsApp client shut down cleanly');
    } catch (error) {
        console.error('❌ Error during shutdown:', error);
    }
}

// Check if client is ready
function isClientReady() {
    return isReady;
}

// Get client info
async function getClientInfo() {
    try {
        if (!isReady) return null;
        
        const info = await client.info;
        return {
            wid: info.wid,
            pushname: info.pushname,
            platform: info.platform
        };
    } catch (error) {
        console.error('❌ Error getting client info:', error);
        return null;
    }
}

// Export the functions
module.exports = {
    init,
    sendMessage,
    sendMedia,
    registerMessageHandler,
    shutdown,
    isClientReady,
    getClientInfo,
    
    // For handling Business API webhooks (future use)
    handleIncomingMessage: async (body) => {
        // This would be implemented for WhatsApp Business API
        console.log('📥 Business API webhook received:', body);
        return null;
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Received SIGINT, shutting down gracefully...');
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Received SIGTERM, shutting down gracefully...');
    await shutdown();
    process.exit(0);
});