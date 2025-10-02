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
const { Subject, Schedule } = require('./models/models_Schedule_Version2');

const app = express();
app.use(express.json());

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
        cb(null, 'chat-' + uniqueSuffix + path.extname(file.originalname));
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
            
            console.log('🔍 Vision API Response:', result.substring(0, 500) + '...');
            
            // Clean markdown code blocks from response
            let cleanedResult = result.trim();
            if (cleanedResult.startsWith('```json')) {
                cleanedResult = cleanedResult.replace(/^```json\s*/, '').replace(/\s*```$/, '');
            } else if (cleanedResult.startsWith('```')) {
                cleanedResult = cleanedResult.replace(/^```\s*/, '').replace(/\s*```$/, '');
            }
            
            try {
                const parsedResult = JSON.parse(cleanedResult);
                console.log(`✅ Successfully parsed JSON! Found ${parsedResult.subjects?.length || 0} subjects`);
                console.log('📅 Schedule structure:', JSON.stringify(parsedResult.schedule, null, 2));
                return parsedResult;
            } catch (parseError) {
                console.log('📝 Non-JSON response, extracting key info...');
                console.log('❌ Parse error:', parseError.message);
                console.log('🔢 Raw response:', result);
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

app.get('/', (req, res) => {
    res.send('<h1>🤖 AI Attendance Bot</h1><p><a href="/chat">Go to Chat</a></p>');
});

app.get('/chat', (req, res) => {
    console.log('📥 Chat route accessed');
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🤖 AI Attendance Chat with Image Upload</title>
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
                <h1>🤖 AI Attendance Bot with Schedule Upload</h1>
                <p><strong>✨ Chat + Upload schedule images for automatic processing!</strong></p>
                
                <!-- Image Upload Section -->
                <div class="upload-section" onclick="document.getElementById('imageInput').click()">
                    <div style="font-size: 18px; color: #007cba; margin-bottom: 10px;">📷 Upload Schedule Images</div>
                    <div style="font-size: 14px; color: #666;">Click to upload timetable + subject codes</div>
                    <input type="file" id="imageInput" style="display: none;" accept="image/*" multiple>
                </div>
                
                <!-- Preview Area -->
                <div id="imagePreview" style="text-align: center; margin: 10px 0;"></div>
                
                <!-- Chat Messages -->
                <div id="messages">
                    <div class="bot-msg">
                        <strong>🤖 AI Bot:</strong> Hi! I can help you with:
                        <br>• 📷 Upload schedule images for automatic parsing
                        <br>• 📝 Register as a student (or just chat normally)
                        <br>• ✅ Record attendance 
                        <br>• 📊 View attendance summaries
                        <br><br><em>Upload images above or type below!</em>
                    </div>
                </div>
                
                <!-- Text Input -->
                <div class="input-area">
                    <input type="text" id="textInput" placeholder="Type your message..." onkeypress="if(event.key==='Enter') sendText();">
                    <button onclick="sendText()">Send</button>
                </div>
            </div>

            <script>
                let selectedFiles = [];

                // Image upload handling
                document.getElementById('imageInput').addEventListener('change', (e) => {
                    selectedFiles = Array.from(e.target.files);
                    showImagePreviews();
                });

                function showImagePreviews() {
                    const preview = document.getElementById('imagePreview');
                    preview.innerHTML = '';
                    
                    if (selectedFiles.length > 0) {
                        preview.innerHTML = '<div style="margin: 10px 0;"><strong>Ready to upload:</strong></div>';
                        selectedFiles.forEach((file, index) => {
                            const reader = new FileReader();
                            reader.onload = (e) => {
                                preview.innerHTML += \`
                                    <div style="display: inline-block; margin: 5px;">
                                        <img src="\${e.target.result}" class="image-preview">
                                        <div style="font-size: 12px;">\${file.name}</div>
                                    </div>
                                \`;
                            };
                            reader.readAsDataURL(file);
                        });
                        
                        preview.innerHTML += \`
                            <div style="margin: 15px 0;">
                                <button onclick="uploadImages()" style="background: #28a745;">🚀 Process Images with AI</button>
                                <button onclick="clearImages()" style="background: #dc3545; margin-left: 10px;">Clear</button>
                            </div>
                        \`;
                    }
                }

                function clearImages() {
                    selectedFiles = [];
                    document.getElementById('imageInput').value = '';
                    document.getElementById('imagePreview').innerHTML = '';
                }

                async function uploadImages() {
                    if (selectedFiles.length === 0) {
                        alert('Please select images first!');
                        return;
                    }

                    const formData = new FormData();
                    selectedFiles.forEach(file => {
                        formData.append('scheduleImages', file);
                    });

                    const messages = document.getElementById('messages');
                    messages.innerHTML += \`
                        <div class="user-msg">
                            <strong>You:</strong> 📷 Uploaded \${selectedFiles.length} schedule image(s)
                        </div>
                        <div class="processing">🧠 Processing with GPT-4o Vision...</div>
                    \`;
                    messages.scrollTop = messages.scrollHeight;

                    try {
                        const response = await fetch('/api/upload-images', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();
                        
                        // Remove processing message
                        const processingMsg = messages.lastElementChild;
                        if (processingMsg && processingMsg.innerHTML.includes('Processing')) {
                            processingMsg.remove();
                        }

                        if (data.success) {
                            messages.innerHTML += \`
                                <div class="bot-msg">
                                    <strong>🤖 AI Bot:</strong> \${data.message}
                                    <br><br><strong>📊 Extracted Data:</strong>
                                    <br>• Subjects: \${data.analysis.subjects?.length || 0}
                                    <br>• Schedule slots: \${data.analysis.schedule?.reduce((total, day) => total + day.slots?.length || 0, 0) || 0}
                                    <br>• Confidence: \${data.analysis.confidence}
                                    <br><br><em>🧠 Processed with GPT-4o Vision + saved to database!</em>
                                </div>
                            \`;
                        } else {
                            messages.innerHTML += \`
                                <div class="bot-msg" style="background: #f8d7da; color: #721c24;">
                                    <strong>❌ Error:</strong> \${data.error}
                                </div>
                            \`;
                        }

                        clearImages();
                        messages.scrollTop = messages.scrollHeight;

                    } catch (error) {
                        messages.innerHTML += \`
                            <div class="bot-msg" style="background: #f8d7da; color: #721c24;">
                                <strong>❌ Upload Failed:</strong> \${error.message}
                            </div>
                        \`;
                        messages.scrollTop = messages.scrollHeight;
                    }
                }

                // Text chat functionality
                async function sendText() {
                    const input = document.getElementById('textInput');
                    const message = input.value.trim();
                    
                    if (!message) return;
                    
                    const messages = document.getElementById('messages');
                    messages.innerHTML += \`<div class="user-msg"><strong>You:</strong> \${message}</div>\`;
                    messages.innerHTML += \`<div class="processing">🧠 AI thinking...</div>\`;
                    messages.scrollTop = messages.scrollHeight;
                    
                    try {
                        const response = await fetch('/api/ai-chat', {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({ message: message })
                        });
                        
                        const data = await response.json();
                        
                        // Remove processing message
                        const processingMsg = messages.lastElementChild;
                        if (processingMsg && processingMsg.innerHTML.includes('thinking')) {
                            processingMsg.remove();
                        }
                        
                        messages.innerHTML += \`<div class="bot-msg"><strong>🤖 AI Bot:</strong> \${data.reply}</div>\`;
                    } catch (error) {
                        messages.innerHTML += \`<div class="bot-msg" style="background: #f8d7da;"><strong>❌ Error:</strong> \${error.message}</div>\`;
                    }
                    
                    messages.scrollTop = messages.scrollHeight;
                    input.value = '';
                }
            </script>
        </body>
        </html>
    `);
});

// IMAGE UPLOAD ENDPOINT WITH VISION
app.post('/api/upload-images', upload.array('scheduleImages', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No images uploaded' });
        }

        const testPhone = '+1234567890';
        console.log(`\\n🧠 Processing ${req.files.length} images with Vision...`);

        // Analyze with Vision
        const imagePaths = req.files.map(file => file.path);
        const analysis = await visionService.analyzeScheduleImages(imagePaths);

        // Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        const studentData = {
            rollNumber: analysis.studentInfo?.rollNumber || 'VIS' + Math.floor(Math.random() * 10000),
            name: analysis.studentInfo?.name || 'Vision Student',
            semester: analysis.studentInfo?.semester || 5,
            subjects: analysis.subjects || [],
            schedule: analysis.schedule || []
        };

        if (!student) {
            student = await attendanceService.registerStudent(testPhone, studentData);
            console.log('✅ Created student from vision analysis');
        } else {
            // First, create or find Subject documents
            const subjectRefs = {};
            if (analysis.subjects && Array.isArray(analysis.subjects)) {
                for (const subjectData of analysis.subjects) {
                    if (subjectData.code && subjectData.name) {
                        // Try to find existing subject or create new one
                        let subject = await Subject.findOne({ code: subjectData.code });
                        if (!subject) {
                            subject = new Subject({
                                code: subjectData.code,
                                name: subjectData.name,
                                totalClasses: 0
                            });
                            await subject.save();
                        }
                        subjectRefs[subjectData.code] = subject._id;
                    }
                }
            }

            // Transform schedule structure for database
            const transformedTimeSlots = [];
            console.log('🔧 Transforming schedule...', JSON.stringify(analysis.schedule, null, 2));
            console.log('📚 Available subject references:', Object.keys(subjectRefs));
            
            if (analysis.schedule && Array.isArray(analysis.schedule)) {
                for (const daySchedule of analysis.schedule) {
                    console.log(`📅 Processing day: ${daySchedule.day}, slots: ${daySchedule.slots?.length || 0}`);
                    if (daySchedule.slots && Array.isArray(daySchedule.slots)) {
                        for (const slot of daySchedule.slots) {
                            if (slot.startTime && slot.endTime && slot.subject) {
                                // Find the subject ObjectId
                                const subjectCode = slot.subject;
                                let matchedSubjectId = null;
                                
                                // First try exact match
                                if (subjectRefs[subjectCode]) {
                                    matchedSubjectId = subjectRefs[subjectCode];
                                } else {
                                    // Try fuzzy match (remove dashes, case insensitive)
                                    const normalizedSlotCode = subjectCode.replace('-', '').toLowerCase();
                                    for (const [refCode, refId] of Object.entries(subjectRefs)) {
                                        const normalizedRefCode = refCode.replace('-', '').toLowerCase();
                                        if (normalizedSlotCode === normalizedRefCode) {
                                            matchedSubjectId = refId;
                                            break;
                                        }
                                    }
                                }
                                
                                console.log(`🔍 Slot: ${slot.subject} ${slot.startTime}-${slot.endTime}, found subject: ${matchedSubjectId ? 'YES' : 'NO'}`);
                                
                                if (matchedSubjectId) {
                                    transformedTimeSlots.push({
                                        day: daySchedule.day,
                                        startTime: slot.startTime,
                                        endTime: slot.endTime,
                                        subject: matchedSubjectId
                                    });
                                } else {
                                    console.log(`⚠️ No subject match found for: ${subjectCode}`);
                                }
                            }
                        }
                    }
                }
            }
            
            // Update schedule (subjects here are just for reference, the actual subjects are separate documents)
            const existingSchedule = await Schedule.findOne({ student: student._id });
            if (existingSchedule) {
                existingSchedule.subjects = analysis.subjects || existingSchedule.subjects;
                existingSchedule.timeSlots = transformedTimeSlots;
                existingSchedule.semester = analysis.studentInfo?.semester || existingSchedule.semester || 3;
                await existingSchedule.save();
            } else {
                const newSchedule = new Schedule({
                    student: student._id,
                    semester: analysis.studentInfo?.semester || 3,
                    subjects: analysis.subjects || [],
                    timeSlots: transformedTimeSlots
                });
                await newSchedule.save();
            }
            console.log(`✅ Updated schedule: ${transformedTimeSlots.length} time slots, ${Object.keys(subjectRefs).length} subjects created`);
        }

        // Clean up files
        req.files.forEach(file => {
            try {
                fs.unlinkSync(file.path);
            } catch (err) {
                console.log('File cleanup warning:', err.message);
            }
        });

        res.json({
            success: true,
            message: `Successfully processed ${req.files.length} schedule images!`,
            analysis: analysis
        });

    } catch (error) {
        console.error('❌ Image upload error:', error);
        
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

// EXISTING AI CHAT ENDPOINT (keep as is)
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        const testPhone = '+1234567890';
        
        console.log('🧠 100% AI processing:', message);
        
        let student = await Student.findOne({ phoneNumber: testPhone });
        
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

        const aiResponse = await aiService.processConversation(message, studentContext);
        
        if (aiResponse.action === 'register_student') {
            const studentData = {
                rollNumber: aiResponse.rollNumber || 'AI' + Math.floor(Math.random() * 10000),
                name: aiResponse.name || 'AI Student',
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
            
            student = await attendanceService.registerStudent(testPhone, studentData);
            res.json({ reply: aiResponse.message + `<br><br><em>✅ AI completed registration!</em>` });
        }
        else if (aiResponse.action === 'record_attendance') {
            if (!student) {
                res.json({ reply: aiResponse.message });
                return;
            }

            await attendanceService.recordAttendance(student._id, aiResponse.attendanceData);
            res.json({ reply: aiResponse.message + `<br><br><em>🧠 AI processed and saved!</em>` });
        }
        else if (aiResponse.action === 'get_summary') {
            if (!student) {
                res.json({ reply: aiResponse.message });
                return;
            }

            const summary = await attendanceService.getAttendanceSummary(student._id);
            
            let summaryMessage = aiResponse.message + `<br><br><strong>Summary:</strong><br>`;
            summaryMessage += `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)<br><br>`;
            
            for (const subject of summary.subjects) {
                summaryMessage += `• ${subject.name}: ${subject.present}/${subject.total} (${subject.percentage}%)<br>`;
            }
            
            res.json({ reply: summaryMessage });
        }
        else {
            res.json({ reply: aiResponse.message + `<br><br><em>🧠 Pure AI response</em>` });
        }
        
    } catch (error) {
        console.error('❌ AI Error:', error);
        res.status(500).json({ 
            reply: `AI Error: ${error.message}` 
        });
    }
});

app.listen(3003, () => {
    console.log('🎉 INTEGRATED CHAT WITH VISION RUNNING!');
    console.log('======================================');
    console.log('🌐 Open: http://localhost:3003/chat');
    console.log('');
    console.log('✨ Features:');
    console.log('📷 Image upload with GPT-4o Vision');
    console.log('💬 AI-powered chat');
    console.log('📊 Attendance tracking');
    console.log('🗄️ MongoDB Atlas storage');
});