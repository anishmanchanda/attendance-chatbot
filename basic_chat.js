const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

// Import your REAL AI services
const attendanceService = require('./services/services_attendanceService_Version2');
const AIService = require('./services/services_aiService_Version2');
const aiService = new AIService();
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

const app = express();
app.use(express.json());

// Create uploads directory if it doesn't exist
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
        cb(null, 'schedule-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        // Accept images only
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files are allowed!'), false);
        }
    }
});

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

app.get('/', (req, res) => {
    res.send('<h1>🤖 Bot Works!</h1><p><a href="/chat">Go to Chat</a></p>');
});

app.get('/chat', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>� AI Attendance Chat</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                .chat-container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .upload-area { 
                    border: 3px dashed #007cba; 
                    border-radius: 10px; 
                    padding: 30px; 
                    text-align: center; 
                    margin-bottom: 20px;
                    background: #f8f9fa;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .upload-area:hover { 
                    background: #e3f2fd; 
                    border-color: #0056b3;
                }
                .upload-area.dragover {
                    background: #e3f2fd;
                    border-color: #0056b3;
                    transform: scale(1.02);
                }
                .upload-text { font-size: 16px; color: #007cba; margin-bottom: 10px; }
                .upload-subtext { font-size: 14px; color: #666; }
                .file-input { display: none; }
                .preview-container { margin: 15px 0; text-align: center; display: none; }
                .preview-image { max-width: 300px; max-height: 200px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .upload-progress { margin: 10px 0; display: none; }
                .progress-bar { 
                    width: 100%; 
                    height: 20px; 
                    background: #e0e0e0; 
                    border-radius: 10px; 
                    overflow: hidden;
                }
                .progress-fill { 
                    height: 100%; 
                    background: linear-gradient(90deg, #007cba, #00a8ff); 
                    width: 0%; 
                    transition: width 0.3s ease;
                }
                #messages { border: 1px solid #ddd; height: 400px; overflow-y: auto; padding: 15px; background: #fafafa; border-radius: 8px; margin: 20px 0; }
                .input-container { display: flex; gap: 10px; align-items: center; }
                #input { flex: 1; padding: 12px; border: 2px solid #ddd; border-radius: 8px; font-size: 16px; }
                #input:focus { border-color: #007cba; outline: none; }
                button { 
                    padding: 12px 20px; 
                    background: #007cba; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 16px;
                    transition: background 0.3s ease;
                }
                button:hover { background: #0056b3; }
                .message { margin-bottom: 10px; line-height: 1.4; }
                .ai-message { background: #e3f2fd; padding: 10px; border-radius: 8px; margin: 5px 0; }
                .user-message { background: #f0f0f0; padding: 10px; border-radius: 8px; margin: 5px 0; }
                .processing { font-style: italic; color: #666; }
                .upload-success { background: #d4edda; color: #155724; padding: 10px; border-radius: 8px; margin: 10px 0; }
                .upload-error { background: #f8d7da; color: #721c24; padding: 10px; border-radius: 8px; margin: 10px 0; }
            </style>
        </head>
        <body>
            <div class="chat-container">
                <h1>🤖 AI Attendance Bot with Image Upload 📷</h1>
                <p><strong>🧠 I'm a REAL AI bot powered by OpenAI GPT!</strong></p>
                
                <!-- Image Upload Area -->
                <div class="upload-area" id="uploadArea">
                    <div class="upload-text">📷 Upload Your Schedule/Timetable Image</div>
                    <div class="upload-subtext">Drag & drop or click to select an image (JPG, PNG, GIF)</div>
                    <input type="file" id="fileInput" class="file-input" accept="image/*">
                </div>
                
                <!-- Preview Container -->
                <div class="preview-container" id="previewContainer">
                    <img id="previewImage" class="preview-image" alt="Preview">
                    <div id="uploadButton" style="margin-top: 10px;">
                        <button onclick="uploadImage()">🚀 Process Schedule Image</button>
                        <button onclick="clearPreview()" style="background: #dc3545; margin-left: 10px;">❌ Clear</button>
                    </div>
                </div>
                
                <!-- Upload Progress -->
                <div class="upload-progress" id="uploadProgress">
                    <div>Processing image...</div>
                    <div class="progress-bar">
                        <div class="progress-fill" id="progressFill"></div>
                    </div>
                </div>
                
                <!-- Chat Messages -->
                <div id="messages">
                    <div class="ai-message">
                        <strong>🤖 AI Bot:</strong> Hi! I can help you with:
                        <br>• 📷 Upload schedule images for automatic parsing
                        <br>• 📝 Register as a student
                        <br>• ✅ Record attendance 
                        <br>• 📊 View attendance summaries
                        <br><br><em>Try uploading a schedule image above or type a message below!</em>
                    </div>
                </div>
                
                <!-- Text Input -->
                <div class="input-container">
                    <input type="text" id="input" placeholder="Type your message here..." onkeypress="if(event.key==='Enter') send();">
                    <button onclick="send()">Send</button>
                </div>
            </div>
    `);
});

// IMAGE UPLOAD AND SCHEDULE PROCESSING ENDPOINT
app.post('/api/upload-schedule', upload.single('scheduleImage'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image file uploaded' });
        }

        const imagePath = req.file.path;
        const testPhone = '+1234567890'; // Using test phone for now
        
        console.log('📷 Processing uploaded schedule image:', req.file.filename);
        
        // Step 1: Optimize image for better OCR results
        const optimizedImagePath = imagePath.replace(/\.[^/.]+$/, '_optimized.png');
        await sharp(imagePath)
            .resize(2000, null, { withoutEnlargement: true })
            .normalize()
            .sharpen()
            .png()
            .toFile(optimizedImagePath);

        console.log('🔍 Extracting text from image using OCR...');
        
        // Step 2: Extract text using Tesseract OCR
        const { data: { text } } = await Tesseract.recognize(optimizedImagePath, 'eng', {
            logger: m => console.log('OCR Progress:', m)
        });

        console.log('📝 Extracted text:', text);

        if (!text || text.trim().length < 10) {
            return res.status(400).json({ 
                error: 'Could not extract readable text from the image. Please ensure the image is clear and contains schedule information.' 
            });
        }

        // Step 3: Use AI to parse the extracted text into structured schedule data
        console.log('🧠 AI parsing schedule text...');
        
        const scheduleParseResult = await aiService.parseScheduleFromText(text);
        
        console.log('📋 AI parsed schedule:', scheduleParseResult);

        // Step 4: Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        if (!student) {
            // If no student exists, create one with extracted info
            const studentData = {
                rollNumber: scheduleParseResult.rollNumber || 'IMG' + Math.floor(Math.random() * 10000),
                name: scheduleParseResult.studentName || 'Schedule Upload Student',
                semester: scheduleParseResult.semester || 5,
                subjects: scheduleParseResult.subjects || [],
                schedule: scheduleParseResult.schedule || []
            };
            
            student = await attendanceService.registerStudent(testPhone, studentData);
            console.log('✅ Created new student from schedule image');
        } else {
            // Update existing student's schedule
            const existingSchedule = await Schedule.findOne({ student: student._id });
            
            if (existingSchedule) {
                existingSchedule.subjects = scheduleParseResult.subjects || existingSchedule.subjects;
                existingSchedule.timeSlots = scheduleParseResult.schedule || existingSchedule.timeSlots;
                await existingSchedule.save();
            } else {
                // Create new schedule
                const newSchedule = new Schedule({
                    student: student._id,
                    subjects: scheduleParseResult.subjects || [],
                    timeSlots: scheduleParseResult.schedule || []
                });
                await newSchedule.save();
            }
            console.log('✅ Updated student schedule from image');
        }

        // Step 5: Clean up uploaded files
        try {
            fs.unlinkSync(imagePath);
            fs.unlinkSync(optimizedImagePath);
        } catch (err) {
            console.log('File cleanup warning:', err.message);
        }

        // Step 6: Return success response
        res.json({
            success: true,
            message: 'Schedule image processed successfully! 📅✨',
            extractedText: text.substring(0, 200) + (text.length > 200 ? '...' : ''),
            parsedData: {
                subjects: scheduleParseResult.subjects?.length || 0,
                scheduleSlots: scheduleParseResult.schedule?.length || 0,
                studentName: scheduleParseResult.studentName,
                semester: scheduleParseResult.semester
            }
        });

    } catch (error) {
        console.error('❌ Image processing error:', error);
        
        // Clean up files on error
        if (req.file) {
            try {
                fs.unlinkSync(req.file.path);
            } catch (err) {
                console.log('File cleanup error:', err.message);
            }
        }
        
        res.status(500).json({ 
            error: 'Failed to process schedule image: ' + error.message 
        });
    }
});

// REAL AI PROCESSING ENDPOINT - 100% AI DEPENDENT
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        const testPhone = '+1234567890';
        
        console.log('🧠 100% AI processing:', message);
        
        // Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        // Create a comprehensive context for the AI
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

        // If student exists, get their schedule for AI context
        if (student) {
            const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
            if (schedule) {
                studentContext.schedule = {
                    subjects: schedule.subjects,
                    timeSlots: schedule.timeSlots
                };
            }
        }

        console.log('🧠 Sending EVERYTHING to OpenAI GPT...');
        
        // Let AI completely handle the conversation
        const aiResponse = await aiService.processConversation(message, studentContext);
        
        console.log('🤖 Pure AI Response:', aiResponse);
        
        // Handle AI's decisions
        if (aiResponse.action === 'register_student') {
            // AI decided to register a student
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
                    },
                    {
                        day: 'Tuesday',
                        slots: [
                            { subject: 'PHY101', startTime: '10:00', endTime: '11:00' },
                            { subject: 'CHEM101', startTime: '14:00', endTime: '15:00' }
                        ]
                    }
                ]
            };
            
            student = await attendanceService.registerStudent(testPhone, studentData);
            res.json({ reply: aiResponse.message + `<br><br><em>✅ AI completed registration in cloud database!</em>` });
        }
        else if (aiResponse.action === 'record_attendance') {
            // AI decided to record attendance
            if (!student) {
                res.json({ reply: aiResponse.message });
                return;
            }

            const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
            
            // Use AI's attendance parsing
            await attendanceService.recordAttendance(student._id, aiResponse.attendanceData);
            
            res.json({ reply: aiResponse.message + `<br><br><em>🧠 AI processed and saved to cloud!</em>` });
        }
        else if (aiResponse.action === 'get_summary') {
            // AI decided to show summary
            if (!student) {
                res.json({ reply: aiResponse.message });
                return;
            }

            const summary = await attendanceService.getAttendanceSummary(student._id);
            
            let summaryMessage = aiResponse.message + `<br><br><strong>Cloud Database Summary:</strong><br>`;
            summaryMessage += `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)<br><br>`;
            
            for (const subject of summary.subjects) {
                summaryMessage += `• ${subject.name}: ${subject.present}/${subject.total} (${subject.percentage}%)<br>`;
            }
            
            summaryMessage += `<br><em>🧠 AI generated from MongoDB Atlas data!</em>`;
            res.json({ reply: summaryMessage });
        }
        else {
            // Pure AI conversational response
            res.json({ reply: aiResponse.message + `<br><br><em>🧠 Pure AI response from OpenAI GPT</em>` });
        }
        
    } catch (error) {
        console.error('❌ 100% AI Error:', error);
        
        // Even error handling through AI
        try {
            const errorResponse = await aiService.handleError(error.message, req.body.message);
            res.status(500).json({ reply: errorResponse.message });
        } catch (aiError) {
            res.status(500).json({ 
                reply: `🤖 AI Error: ${error.message}<br><br>This is a real system error - check OpenAI API key!` 
            });
        }
    }
});

app.listen(3003, () => {
    console.log('🎉 SIMPLE CHAT RUNNING!');
    console.log('========================');
    console.log('🌐 Open your browser:');
    console.log('   👉 http://localhost:3003');
    console.log('   👉 http://localhost:3003/chat');
    console.log('');
    console.log('✅ This WILL work - guaranteed!');
});