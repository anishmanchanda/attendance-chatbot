const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

console.log('🔍 Loading complete demo step by step...');

try {
    console.log('✅ Basic imports loaded');
    
    // Import services
    const attendanceService = require('./services/services_attendanceService_Version2');
    console.log('✅ Attendance service loaded');
    
    const AIService = require('./services/services_aiService_Version2');
    const aiService = new AIService();
    console.log('✅ AI service loaded');
    
    const Student = require('./models/models_Student_Version2');
    const { Schedule } = require('./models/models_Schedule_Version2');
    console.log('✅ Models loaded');

    const app = express();
    app.use(express.json());
    console.log('✅ Express app created');

    // Connect to MongoDB
    mongoose.connect(process.env.MONGODB_URI)
        .then(() => console.log('✅ Database connected'))
        .catch(err => {
            console.error('❌ Database error:', err);
            process.exit(1);
        });

    // Create uploads directory
    const uploadsDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir);
    }
    console.log('✅ Uploads directory ready');

    // Configure multer for image uploads
    const storage = multer.diskStorage({
        destination: (req, file, cb) => {
            cb(null, 'uploads/');
        },
        filename: (req, file, cb) => {
            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
            cb(null, 'demo-' + uniqueSuffix + path.extname(file.originalname));
        }
    });

    const upload = multer({
        storage: storage,
        limits: {
            fileSize: 10 * 1024 * 1024 // 10MB limit
        },
        fileFilter: (req, file, cb) => {
            if (file.mimetype.startsWith('image/')) {
                cb(null, true);
            } else {
                cb(new Error('Only image files are allowed!'), false);
            }
        }
    });
    console.log('✅ Multer configured');

    // GPT-4o Vision Service
    class VisionService {
        constructor() {
            this.apiKey = process.env.OPENAI_API_KEY;
        }

        encodeImageToBase64(filePath) {
            const imageBuffer = fs.readFileSync(filePath);
            return imageBuffer.toString('base64');
        }

        getMimeType(filePath) {
            const ext = path.extname(filePath).toLowerCase();
            const mimeTypes = {
                '.jpg': 'image/jpeg',
                '.jpeg': 'image/jpeg',
                '.png': 'image/png',
                '.gif': 'image/gif',
                '.webp': 'image/webp'
            };
            return mimeTypes[ext] || 'image/jpeg';
        }

        async analyzeScheduleImages(imagePaths) {
            try {
                console.log(`🧠 Analyzing ${imagePaths.length} images with GPT-4o Vision...`);

                const imageMessages = imagePaths.map((imagePath, index) => {
                    const base64Image = this.encodeImageToBase64(imagePath);
                    const mimeType = this.getMimeType(imagePath);
                    
                    return {
                        type: "image_url",
                        image_url: {
                            url: `data:${mimeType};base64,${base64Image}`,
                            detail: "high"
                        }
                    };
                });

                const response = await axios({
                    method: 'POST',
                    url: 'https://api.openai.com/v1/chat/completions',
                    headers: {
                        'Authorization': `Bearer ${this.apiKey}`,
                        'Content-Type': 'application/json'
                    },
                    timeout: 120000,
                    data: {
                        model: "gpt-4o",
                        messages: [
                            {
                                role: "user",
                                content: [
                                    {
                                        type: "text",
                                        text: `Analyze these schedule/timetable images and extract structured data.

IMPORTANT: Respond with ONLY valid JSON, no markdown code blocks.

Extract:
1. Student info (name, roll number, semester)
2. Subject codes and full names
3. Weekly schedule with days and times

NOTE: Ignore teacher codes - set room to null.

Return this exact JSON format (no \`\`\`json\`\`\`):
{
  "studentInfo": {
    "name": "name or null",
    "rollNumber": "roll or null",
    "semester": "semester or null"
  },
  "subjects": [
    {"code": "CS101", "name": "Computer Science", "credits": 3}
  ],
  "schedule": [
    {
      "day": "Monday",
      "slots": [
        {"subject": "CS101", "startTime": "09:00", "endTime": "10:00", "room": null}
      ]
    }
  ],
  "confidence": "high"
}`
                                    },
                                    ...imageMessages
                                ]
                            }
                        ],
                        max_tokens: 4000,
                        temperature: 0.1
                    }
                });

            const result = response.data.choices[0].message.content;
            console.log('📝 Vision API raw response received, length:', result.length);
            console.log('📝 First 200 chars:', result.substring(0, 200));
            
            try {
                // Try direct parsing first
                const parsed = JSON.parse(result);
                console.log('✅ Direct JSON parse SUCCESS!');
                console.log('📊 Extracted subjects:', parsed.subjects?.length || 0);
                return parsed;
            } catch (parseError) {
                console.log('📝 Direct parse failed, cleaning response...');
                
                // Remove markdown code blocks and extract JSON
                let cleanedResult = result;
                
                // Remove ```json and ``` markers
                cleanedResult = cleanedResult.replace(/```json\s*/g, '').replace(/```\s*/g, '');
                
                // Try to find JSON object in the response
                const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
                
                if (jsonMatch) {
                    try {
                        const parsed = JSON.parse(jsonMatch[0]);
                        console.log('✅ Successfully extracted and parsed JSON');
                        console.log('📊 Extracted subjects:', parsed.subjects?.length || 0);
                        return parsed;
                    } catch (secondError) {
                        console.log('❌ Second parse attempt failed:', secondError.message);
                    }
                }
                
                console.log('📝 Fallback: extracting key info from text...');
                return {
                    studentInfo: { name: null, rollNumber: null, semester: null },
                    subjects: [],
                    schedule: [],
                    extractedText: result,
                    confidence: "low"
                };
            }            } catch (error) {
                console.error('❌ Vision API Error:', error.response?.data || error.message);
                throw new Error(`Vision analysis failed: ${error.response?.data?.error?.message || error.message}`);
            }
        }
    }

    const visionService = new VisionService();
    console.log('✅ Vision service created');

    // Routes
    app.get('/', (req, res) => {
        res.send(`
            <h1>🤖 AI Attendance Bot Demo</h1>
            <p><strong>Available Interfaces:</strong></p>
            <ul>
                <li><a href="/whatsapp-demo">📱 WhatsApp Demo Interface</a></li>
            </ul>
        `);
    });

    // WhatsApp demo message endpoint
    app.post('/api/whatsapp-demo/message', async (req, res) => {
        try {
            const { phoneNumber, message, type } = req.body;
            
            console.log(`📱 WhatsApp Demo - Message from ${phoneNumber}: ${message}`);
            
            // Get or create student
            let student = await Student.findOne({ phoneNumber });
            
            // Handle help command
            if (message.toLowerCase().trim() === 'help') {
                return res.json({
                    reply: `🤖 *Attendance Bot Help*\\n\\n` +
                           `📷 Upload schedule images\\n` +
                           `📝 Report daily attendance\\n` +
                           `📊 Type "attendance" for summary\\n` +
                           `📚 Type "subjects" for details\\n` +
                           `🔄 Type "reset" to start over`
                });
            }
            
            // Use AI for general conversation
            let studentContext = {
                isRegistered: !!student,
                studentInfo: student ? {
                    name: student.name,
                    rollNumber: student.rollNumber,
                    semester: student.semester
                } : null
            };

            const aiResponse = await aiService.processConversation(message, studentContext);
            res.json({ reply: aiResponse.message });
            
        } catch (error) {
            console.error('❌ WhatsApp Demo Error:', error);
            res.status(500).json({ 
                reply: `❌ Error: ${error.message}` 
            });
        }
    });

    // WhatsApp demo image upload endpoint
    app.post('/api/whatsapp-demo/upload', upload.array('scheduleImages', 5), async (req, res) => {
        try {
            if (!req.files || req.files.length === 0) {
                return res.status(400).json({ error: 'No images uploaded' });
            }

            const { phoneNumber } = req.body;
            console.log(`📷 WhatsApp Demo - Processing ${req.files.length} images for ${phoneNumber}`);

            // Analyze with Vision
            const imagePaths = req.files.map(file => file.path);
            const analysis = await visionService.analyzeScheduleImages(imagePaths);

            // Clean up files
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.log('File cleanup warning:', err.message);
                }
            });

            let message = `✅ *Schedule processed successfully!*\\n\\n`;
            message += `📊 Extracted Data:\\n`;
            message += `• ${analysis.subjects?.length || 0} subjects found\\n`;
            message += `• ${analysis.schedule?.reduce((total, day) => total + (day.slots?.length || 0), 0) || 0} time slots\\n`;
            message += `• Confidence: ${analysis.confidence}\\n\\n`;
            message += `🤖 *Ready!* You can now report attendance.`;

            res.json({
                success: true,
                message: message,
                analysis: analysis
            });

        } catch (error) {
            console.error('❌ WhatsApp Demo Upload Error:', error);
            
            if (req.files) {
                req.files.forEach(file => {
                    try { fs.unlinkSync(file.path); } catch (e) {}
                });
            }
            
            res.status(500).json({ 
                error: 'Image processing failed: ' + error.message 
            });
        }
    });

    // WhatsApp-like demo interface
    app.get('/whatsapp-demo', (req, res) => {
        res.send(`
            <!DOCTYPE html>
            <html>
            <head>
                <title>📱 WhatsApp Attendance Bot Demo</title>
                <style>
                    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; margin: 0; background: #111b21; }
                    .whatsapp-container { 
                        max-width: 400px; 
                        margin: 20px auto; 
                        background: #0b141a; 
                        border-radius: 10px; 
                        overflow: hidden;
                        box-shadow: 0 4px 20px rgba(0,0,0,0.3);
                    }
                    .whatsapp-header {
                        background: #202c33;
                        color: #d9dee0;
                        padding: 15px;
                        display: flex;
                        align-items: center;
                        border-bottom: 1px solid #313a42;
                    }
                    .header-avatar {
                        width: 40px;
                        height: 40px;
                        border-radius: 50%;
                        background: #00a884;
                        display: flex;
                        align-items: center;
                        justify-content: center;
                        margin-right: 12px;
                        font-size: 18px;
                    }
                    .header-info h3 { margin: 0; font-size: 16px; }
                    .header-info p { margin: 0; font-size: 12px; color: #8696a0; }
                    .chat-area {
                        height: 500px;
                        overflow-y: auto;
                        padding: 10px;
                        background: #0b141a;
                    }
                    .message {
                        margin: 8px 0;
                        display: flex;
                    }
                    .message.received {
                        justify-content: flex-start;
                    }
                    .message.sent {
                        justify-content: flex-end;
                    }
                    .message-bubble {
                        max-width: 80%;
                        padding: 8px 12px;
                        border-radius: 8px;
                        position: relative;
                    }
                    .message.received .message-bubble {
                        background: #202c33;
                        color: #d9dee0;
                    }
                    .message.sent .message-bubble {
                        background: #005c4b;
                        color: #d9dee0;
                    }
                    .message-time {
                        font-size: 11px;
                        color: #8696a0;
                        margin-top: 4px;
                    }
                    .input-area {
                        background: #202c33;
                        padding: 10px;
                        display: flex;
                        gap: 8px;
                        align-items: center;
                    }
                    .upload-btn {
                        background: #00a884;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    .message-input {
                        flex: 1;
                        background: #2a3942;
                        border: none;
                        border-radius: 20px;
                        padding: 8px 16px;
                        color: #d9dee0;
                        font-size: 14px;
                    }
                    .send-btn {
                        background: #00a884;
                        color: white;
                        border: none;
                        border-radius: 50%;
                        width: 40px;
                        height: 40px;
                        cursor: pointer;
                        font-size: 16px;
                    }
                    .typing-indicator { font-style: italic; color: #8696a0; }
                    .image-upload { display: none; }
                </style>
            </head>
            <body>
                <div class="whatsapp-container">
                    <div class="whatsapp-header">
                        <div class="header-avatar">🤖</div>
                        <div class="header-info">
                            <h3>Attendance Bot</h3>
                            <p>Online - AI Assistant</p>
                        </div>
                    </div>
                    
                    <div class="chat-area" id="chatArea">
                        <div class="message received">
                            <div class="message-bubble">
                                <div>🤖 Hi! I'm your AI attendance assistant.</div>
                                <div>📷 Upload your schedule image to get started!</div>
                                <div>💬 Or type "help" for options.</div>
                                <div class="message-time">${new Date().toLocaleTimeString()}</div>
                            </div>
                        </div>
                    </div>
                    
                    <div class="input-area">
                        <input type="file" id="imageUpload" class="image-upload" accept="image/*" multiple>
                        <button class="upload-btn" onclick="document.getElementById('imageUpload').click()">📎</button>
                        <input type="text" class="message-input" id="messageInput" placeholder="Type a message..." 
                               onkeypress="if(event.key==='Enter') sendMessage()">
                        <button class="send-btn" onclick="sendMessage()">➤</button>
                    </div>
                </div>

                <script>
                    const phoneNumber = '+1234567890';
                    
                    document.getElementById('imageUpload').addEventListener('change', uploadImages);
                    
                    function addMessage(content, isSent = false, isTyping = false) {
                        const chatArea = document.getElementById('chatArea');
                        const messageDiv = document.createElement('div');
                        messageDiv.className = \`message \${isSent ? 'sent' : 'received'}\`;
                        
                        const bubbleDiv = document.createElement('div');
                        bubbleDiv.className = 'message-bubble';
                        
                        if (isTyping) {
                            bubbleDiv.innerHTML = \`<div class="typing-indicator">\${content}</div>\`;
                        } else {
                            bubbleDiv.innerHTML = \`
                                <div>\${content}</div>
                                <div class="message-time">\${new Date().toLocaleTimeString()}</div>
                            \`;
                        }
                        
                        messageDiv.appendChild(bubbleDiv);
                        chatArea.appendChild(messageDiv);
                        chatArea.scrollTop = chatArea.scrollHeight;
                        
                        return messageDiv;
                    }
                    
                    async function sendMessage() {
                        const input = document.getElementById('messageInput');
                        const message = input.value.trim();
                        
                        if (!message) return;
                        
                        addMessage(message, true);
                        input.value = '';
                        
                        const typingMsg = addMessage('🤖 AI typing...', false, true);
                        
                        try {
                            const response = await fetch('/api/whatsapp-demo/message', {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({ 
                                    phoneNumber: phoneNumber,
                                    message: message,
                                    type: 'text'
                                })
                            });
                            
                            const data = await response.json();
                            
                            typingMsg.remove();
                            addMessage(data.reply);
                            
                        } catch (error) {
                            typingMsg.remove();
                            addMessage('❌ Error: ' + error.message);
                        }
                    }
                    
                    async function uploadImages() {
                        const files = document.getElementById('imageUpload').files;
                        if (files.length === 0) return;
                        
                        addMessage(\`📷 Uploaded \${files.length} image(s)\`, true);
                        
                        const typingMsg = addMessage('🧠 AI analyzing images...', false, true);
                        
                        const formData = new FormData();
                        for (let file of files) {
                            formData.append('scheduleImages', file);
                        }
                        formData.append('phoneNumber', phoneNumber);
                        
                        try {
                            const response = await fetch('/api/whatsapp-demo/upload', {
                                method: 'POST',
                                body: formData
                            });
                            
                            const data = await response.json();
                            
                            typingMsg.remove();
                            
                            if (data.success) {
                                addMessage(data.message);
                            } else {
                                addMessage('❌ ' + data.error);
                            }
                            
                            document.getElementById('imageUpload').value = '';
                            
                        } catch (error) {
                            typingMsg.remove();
                            addMessage('❌ Upload failed: ' + error.message);
                        }
                    }
                </script>
            </body>
            </html>
        `);
    });

    console.log('✅ Routes configured');

    // Start server
    const PORT = 3003;
    app.listen(PORT, () => {
        console.log('🎉 FIXED ATTENDANCE BOT DEMO RUNNING!');
        console.log('=====================================');
        console.log(`🌐 Main: http://localhost:${PORT}`);
        console.log(`📱 WhatsApp Demo: http://localhost:${PORT}/whatsapp-demo`);
        console.log('');
        console.log('✨ Features:');
        console.log('📷 GPT-4o Vision image processing');
        console.log('💬 AI-powered conversation');
        console.log('📊 Attendance tracking');
        console.log('🗄️ MongoDB Atlas storage');
        console.log('📱 WhatsApp-like interface');
    });

} catch (error) {
    console.error('❌ Complete demo error:', error);
    process.exit(1);
}