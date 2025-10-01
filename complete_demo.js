const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Import services
const attendanceService = require('./services/services_attendanceService_Version2');
const AIService = require('./services/services_aiService_Version2');
const aiService = new AIService();
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

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

Extract:
1. Student info (name, roll number, semester)
2. Subject codes and full names
3. Weekly schedule with days and times

NOTE: Ignore teacher codes - set room to null.

Return JSON:
{
  "studentInfo": {
    "name": "name or null",
    "rollNumber": "roll or null",
    "semester": number or null
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
  "confidence": "high/medium/low"
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
            
            try {
                return JSON.parse(result);
            } catch (parseError) {
                console.log('📝 Non-JSON response, extracting key info...');
                return {
                    studentInfo: { name: null, rollNumber: null, semester: null },
                    subjects: [],
                    schedule: [],
                    extractedText: result,
                    confidence: "medium"
                };
            }

        } catch (error) {
            console.error('❌ Vision API Error:', error.response?.data || error.message);
            throw new Error(`Vision analysis failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
}

const visionService = new VisionService();

// Store chat sessions (simulating WhatsApp conversations)
let chatSessions = {};

app.get('/', (req, res) => {
    res.send(`
        <h1>🤖 AI Attendance Bot Demo</h1>
        <p><strong>Available Interfaces:</strong></p>
        <ul>
            <li><a href="/chat">💬 Web Chat Interface</a></li>
            <li><a href="/whatsapp-demo">📱 WhatsApp Demo Interface</a></li>
        </ul>
    `);
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
                            <div>💬 Or just chat with me normally.</div>
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
                const phoneNumber = '+1234567890'; // Demo phone number
                
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
                    
                    const typingMsg = addMessage('🧠 AI analyzing images with GPT-4o Vision...', false, true);
                    
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

// WhatsApp demo message endpoint
app.post('/api/whatsapp-demo/message', async (req, res) => {
    try {
        const { phoneNumber, message, type } = req.body;
        
        console.log(`📱 WhatsApp Demo - Message from ${phoneNumber}: ${message}`);
        
        // Get or create student
        let student = await Student.findOne({ phoneNumber });
        
        let studentContext = {
            isRegistered: !!student,
            studentInfo: student ? {
                name: student.name,
                rollNumber: student.rollNumber,
                semester: student.semester
            } : null,
            availableSubjects: [
                { code: 'CS101', name: 'Computer Science' },
                { code: 'MATH201', name: 'Mathematics' },
                { code: 'PHY101', name: 'Physics' },
                { code: 'CHEM101', name: 'Chemistry' }
            ]
        };

        if (student) {
            const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
            if (schedule) {
                studentContext.schedule = {
                    subjects: schedule.subjects,
                    timeSlots: schedule.timeSlots
                };
            }
        }

        // Special WhatsApp-style commands
        const lowerMessage = message.toLowerCase().trim();
        
        if (lowerMessage === 'help') {
            return res.json({
                reply: `🤖 *Attendance Bot Help*\\n\\n` +
                       `📷 Upload schedule images\\n` +
                       `📝 Report daily attendance\\n` +
                       `📊 Type "attendance" for summary\\n` +
                       `📚 Type "subjects" for details\\n` +
                       `🔄 Type "reset" to start over`
            });
        }
        
        if (lowerMessage === 'attendance' || lowerMessage === 'summary') {
            if (!student) {
                return res.json({ reply: 'Please upload your schedule first!' });
            }
            
            const summary = await attendanceService.getAttendanceSummary(student._id);
            
            let reply = `📊 *Attendance Summary*\\n\\n` +
                       `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)\\n\\n` +
                       `*Subject-wise:*\\n`;
                       
            for (const subject of summary.subjects) {
                reply += `• ${subject.code}: ${subject.present}/${subject.total} (${subject.percentage}%)\\n`;
            }
            
            return res.json({ reply });
        }

        // Use AI for general conversation
        const aiResponse = await aiService.processConversation(message, studentContext);
        
        if (aiResponse.action === 'register_student') {
            const studentData = {
                rollNumber: aiResponse.rollNumber || 'DEMO' + Math.floor(Math.random() * 10000),
                name: aiResponse.name || 'Demo Student',
                semester: aiResponse.semester || 5,
                subjects: studentContext.availableSubjects,
                schedule: [
                    {
                        day: 'Monday',
                        slots: [
                            { subject: 'CS101', startTime: '09:00', endTime: '10:00' },
                            { subject: 'MATH201', startTime: '11:00', endTime: '12:00' }
                        ]
                    }
                ]
            };
            
            student = await attendanceService.registerStudent(phoneNumber, studentData);
            res.json({ reply: aiResponse.message + '\\n\\n✅ Registration completed!' });
        }
        else if (aiResponse.action === 'record_attendance') {
            if (!student) {
                res.json({ reply: aiResponse.message });
                return;
            }

            await attendanceService.recordAttendance(student._id, aiResponse.attendanceData);
            res.json({ reply: aiResponse.message + '\\n\\n✅ Attendance recorded!' });
        }
        else {
            res.json({ reply: aiResponse.message });
        }
        
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

        // Find or create student
        let student = await Student.findOne({ phoneNumber });
        
        const studentData = {
            rollNumber: analysis.studentInfo?.rollNumber || 'DEMO' + Math.floor(Math.random() * 10000),
            name: analysis.studentInfo?.name || 'Demo Student',
            semester: analysis.studentInfo?.semester || 5,
            subjects: analysis.subjects || [],
            schedule: analysis.schedule || []
        };

        if (!student) {
            student = await attendanceService.registerStudent(phoneNumber, studentData);
            console.log('✅ Created student from vision analysis');
        } else {
            // Update schedule
            const existingSchedule = await Schedule.findOne({ student: student._id });
            if (existingSchedule) {
                existingSchedule.subjects = analysis.subjects || existingSchedule.subjects;
                existingSchedule.timeSlots = analysis.schedule || existingSchedule.timeSlots;
                await existingSchedule.save();
            } else {
                const newSchedule = new Schedule({
                    student: student._id,
                    subjects: analysis.subjects || [],
                    timeSlots: analysis.schedule || []
                });
                await newSchedule.save();
            }
            console.log('✅ Updated schedule from vision analysis');
        }

        // Clean up files
        req.files.forEach(file => {
            try {
                fs.unlinkSync(file.path);
            } catch (err) {
                console.log('File cleanup warning:', err.message);
            }
        });

        let message = `✅ *Schedule processed successfully!*\\n\\n`;
        
        if (analysis.studentInfo?.name) {
            message += `👤 Name: ${analysis.studentInfo.name}\\n`;
        }
        if (analysis.studentInfo?.rollNumber) {
            message += `🆔 Roll: ${analysis.studentInfo.rollNumber}\\n`;
        }
        
        message += `\\n📊 Extracted Data:\\n`;
        message += `• ${analysis.subjects?.length || 0} subjects found\\n`;
        message += `• ${analysis.schedule?.reduce((total, day) => total + (day.slots?.length || 0), 0) || 0} time slots\\n`;
        message += `• Confidence: ${analysis.confidence}\\n\\n`;
        
        message += `🤖 *Ready!* You can now:\\n`;
        message += `• Report daily attendance\\n`;
        message += `• Type "attendance" for summary\\n`;
        message += `• Type "subjects" for details`;

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

// Regular chat interface (keep existing)
app.get('/chat', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 AI Attendance Chat</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .upload-section { 
                    border: 2px dashed #007cba; 
                    border-radius: 8px; 
                    padding: 20px; 
                    text-align: center; 
                    margin: 20px 0;
                    background: #f8f9fa;
                    cursor: pointer;
                }
                .upload-section:hover { background: #e3f2fd; }
                #messages { 
                    border: 1px solid #ddd; 
                    height: 400px; 
                    overflow-y: auto; 
                    padding: 15px; 
                    background: #fafafa; 
                    border-radius: 8px; 
                    margin: 20px 0; 
                }
                .message { margin-bottom: 15px; }
                .user-msg { background: #e3f2fd; padding: 10px; border-radius: 8px; margin: 5px 0; }
                .bot-msg { background: #f0f0f0; padding: 10px; border-radius: 8px; margin: 5px 0; }
                .input-area { display: flex; gap: 10px; margin-top: 10px; }
                #textInput { flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 8px; }
                button { 
                    padding: 12px 20px; 
                    background: #007cba; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                }
                button:hover { background: #0056b3; }
                .image-preview { max-width: 200px; margin: 10px; border-radius: 8px; }
                .processing { font-style: italic; color: #666; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🤖 AI Attendance Bot</h1>
                <p><strong>✨ Chat + Upload schedule images for automatic processing!</strong></p>
                
                <div id="messages">
                    <div class="bot-msg">
                        <strong>🤖 AI Bot:</strong> Hi! Upload schedule images or chat with me about attendance.
                    </div>
                </div>
                
                <div class="input-area">
                    <input type="text" id="textInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter') sendText();">
                    <button onclick="sendText()">Send</button>
                </div>
            </div>
        </body>
        </html>
    `);
});

app.listen(3003, () => {
    console.log('🎉 COMPLETE ATTENDANCE BOT DEMO RUNNING!');
    console.log('========================================');
    console.log('🌐 Main: http://localhost:3003');
    console.log('💬 Chat: http://localhost:3003/chat');
    console.log('📱 WhatsApp Demo: http://localhost:3003/whatsapp-demo');
    console.log('');
    console.log('✨ Features:');
    console.log('📷 GPT-4o Vision image processing');
    console.log('💬 AI-powered conversation');
    console.log('📊 Attendance tracking');
    console.log('🗄️ MongoDB Atlas storage');
    console.log('📱 WhatsApp-like interface');
});