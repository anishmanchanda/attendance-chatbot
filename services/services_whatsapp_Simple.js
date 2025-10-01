const qrcode = require('qrcode-terminal');
const { Client, MessageMedia, LocalAuth } = require('whatsapp-web.js');
const fs = require('fs');
const path = require('path');

// Simplified WhatsApp client for macOS compatibility
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: "attendance-bot"
    }),
    puppeteer: {
        headless: true,
        args: [
            '--no-sandbox',
            '--disable-setuid-sandbox',
            '--disable-dev-shm-usage',
            '--disable-accelerated-2d-canvas',
            '--no-first-run',
            '--no-zygote',
            '--disable-gpu',
            '--disable-web-security'
        ],
    }
});

let messageHandler = null;
let isReady = false;

// Generate QR code for login
client.on('qr', (qr) => {
    console.log('');
    console.log('🔗 WHATSAPP QR CODE');
    console.log('==================');
    qrcode.generate(qr, { small: true });
    console.log('📱 Scan with WhatsApp on your phone');
    console.log('');
});

client.on('authenticated', () => {
    console.log('✅ WhatsApp authenticated');
});

client.on('auth_failure', (message) => {
    console.error('❌ Authentication failed:', message);
});

client.on('ready', () => {
    isReady = true;
    console.log('');
    console.log('🎉 WHATSAPP BOT READY!');
    console.log('=====================');
    console.log('✅ Connected and ready to receive messages');
    console.log('📱 Send messages to test the bot');
    console.log('');
});

client.on('disconnected', (reason) => {
    isReady = false;
    console.log('❌ Disconnected:', reason);
});

// Handle incoming messages
client.on('message', async (message) => {
    try {
        if (message.isGroup || message.isStatus || message.fromMe) return;
        
        console.log(`\n📱 Message from ${message.from}: ${message.body || '[Media]'}`);
        
        if (messageHandler && isReady) {
            const processedMessage = await parseIncomingMessage(message);
            await messageHandler(processedMessage);
        }
    } catch (error) {
        console.error("❌ Error processing message:", error);
        try {
            await sendMessage(message.from, "Sorry, I encountered an error. Please try again.");
        } catch (sendError) {
            console.error("❌ Failed to send error message:", sendError);
        }
    }
});

// Parse incoming message
async function parseIncomingMessage(message) {
    const processedMessage = {
        from: message.from,
        type: 'text',
        content: message.body,
        timestamp: new Date(),
        messageId: message.id._serialized
    };

    // Handle media messages
    if (message.hasMedia) {
        try {
            console.log('📷 Downloading media...');
            const media = await message.downloadMedia();
            
            if (media) {
                processedMessage.type = 'media';
                processedMessage.media = {
                    mimetype: media.mimetype,
                    data: media.data,
                    filename: media.filename || `attachment_${Date.now()}`
                };
                
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

// Send message
async function sendMessage(to, text) {
    try {
        if (!isReady) {
            console.log('⚠️ WhatsApp not ready');
            return false;
        }

        const formattedNumber = formatPhoneNumber(to);
        console.log(`📤 Sending to ${formattedNumber}: ${text.substring(0, 50)}...`);
        
        await client.sendMessage(formattedNumber, text);
        console.log('✅ Message sent');
        return true;
    } catch (error) {
        console.error('❌ Error sending message:', error);
        return false;
    }
}

// Format phone number
function formatPhoneNumber(number) {
    let cleaned = number.replace(/[^\d+]/g, '');
    
    if (cleaned.startsWith('+')) {
        cleaned = cleaned.substring(1);
    }
    
    // Add country code if missing (India +91)
    if (!cleaned.startsWith('91') && cleaned.length === 10) {
        cleaned = '91' + cleaned;
    }
    
    return cleaned + '@c.us';
}

// Initialize
async function init() {
    try {
        console.log('🚀 Starting WhatsApp client...');
        await client.initialize();
        return true;
    } catch (error) {
        console.error('❌ Initialization failed:', error);
        
        // Suggest solutions for common macOS issues
        console.log('\n💡 macOS Troubleshooting:');
        console.log('1. Install/Update Chrome: brew install --cask google-chrome');
        console.log('2. Clear auth data: rm -rf .wwebjs_auth');
        console.log('3. Update Node.js: brew install node');
        console.log('4. Restart terminal and try again');
        
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
        console.log('🔄 Shutting down...');
        await client.destroy();
        console.log('✅ Shutdown complete');
    } catch (error) {
        console.error('❌ Shutdown error:', error);
    }
}

// Check ready state
function isClientReady() {
    return isReady;
}

// Export functions
module.exports = {
    init,
    sendMessage,
    registerMessageHandler,
    shutdown,
    isClientReady,
    
    // For Business API (future)
    handleIncomingMessage: async (body) => {
        console.log('📥 Business API webhook:', body);
        return null;
    }
};

// Handle process termination
process.on('SIGINT', async () => {
    console.log('\n🛑 Shutting down...');
    await shutdown();
    process.exit(0);
});

process.on('SIGTERM', async () => {
    console.log('\n🛑 Shutting down...');
    await shutdown();
    process.exit(0);
});