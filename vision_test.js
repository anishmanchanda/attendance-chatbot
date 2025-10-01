const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const attendanceService = require('./services/services_attendanceService_Version2');
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
        cb(null, 'vision-' + uniqueSuffix + path.extname(file.originalname));
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

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

// GPT-4 Vision Service
class VisionService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
    }

    // Convert image file to base64
    encodeImageToBase64(filePath) {
        const imageBuffer = fs.readFileSync(filePath);
        return imageBuffer.toString('base64');
    }

    // Get MIME type from file extension
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
            console.log(`🧠 Analyzing ${imagePaths.length} images with GPT-4 Vision...`);

            // Prepare images for the API
            const imageMessages = imagePaths.map((imagePath, index) => {
                const base64Image = this.encodeImageToBase64(imagePath);
                const mimeType = this.getMimeType(imagePath);
                
                console.log(`📷 Image ${index + 1}: ${path.basename(imagePath)} (${mimeType})`);
                
                return {
                    type: "image_url",
                    image_url: {
                        url: `data:${mimeType};base64,${base64Image}`,
                        detail: "high"
                    }
                };
            });

            // Create the API request
            const response = await axios({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
                    'Content-Type': 'application/json'
                },
                data: {
                    model: "gpt-4o",
                    messages: [
                        {
                            role: "user",
                            content: [
                                {
                                    type: "text",
                                    text: `Please analyze these schedule/timetable images and extract all the information to create a comprehensive student schedule.

I need you to find:
1. Student information (name, roll number, semester/year)
2. All subject codes and their full names
3. Weekly schedule with days, times, and subjects

IMPORTANT NOTES:
- What looks like "room numbers" in the schedule are actually TEACHER CODES (e.g., "an", "Re", "R6") - ignore these or set room to null
- Focus on extracting subject codes, subject names, days, and time slots
- Don't worry about teacher codes or instructor information

These images may contain:
- Main timetable with subject codes and time slots
- Subject code reference sheets with full subject names
- Student information pages

Please extract ALL visible information and correlate data across multiple images when needed (e.g., match subject codes from the timetable with full names from the reference sheet).

Return your analysis in this JSON format:
{
  "studentInfo": {
    "name": "student name or null",
    "rollNumber": "roll/student ID or null", 
    "semester": number or null,
    "department": "department name or null"
  },
  "subjects": [
    {
      "code": "CS101",
      "name": "Computer Science Fundamentals",
      "credits": number or null,
      "type": "core/elective/lab or null"
    }
  ],
  "schedule": [
    {
      "day": "Monday",
      "slots": [
        {
          "subject": "CS101",
          "startTime": "09:00",
          "endTime": "10:00", 
          "room": null,
          "type": "lecture/lab/tutorial or null"
        }
      ]
    }
  ],
  "extractedText": "key text and information visible in the images",
  "confidence": "high/medium/low",
  "notes": "any additional observations or unclear items"
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
            console.log('🎯 GPT-4 Vision response received');
            
            // Try to parse as JSON, fallback to text analysis if needed
            try {
                return JSON.parse(result);
            } catch (parseError) {
                console.log('📝 Response is not JSON, parsing manually...');
                return this.parseTextResponse(result);
            }

        } catch (error) {
            console.error('❌ GPT-4 Vision API Error:', error.response?.data || error.message);
            throw new Error(`Vision API failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }

    // Fallback parser if JSON parsing fails
    parseTextResponse(textResponse) {
        return {
            studentInfo: {
                name: null,
                rollNumber: null,
                semester: null,
                department: null
            },
            subjects: [],
            schedule: [],
            extractedText: textResponse,
            confidence: "low",
            notes: "GPT-4 returned text instead of JSON - manual parsing needed"
        };
    }
}

const visionService = new VisionService();

app.get('/', (req, res) => {
    res.send('<h1>🧠 GPT-4 Vision Schedule Parser</h1><p><a href="/vision">Upload Schedule Images</a></p>');
});

app.get('/vision', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🧠 GPT-4 Vision Schedule Parser</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .upload-area { 
                    border: 3px dashed #28a745; 
                    border-radius: 10px; 
                    padding: 30px; 
                    text-align: center; 
                    margin: 20px 0;
                    background: #f8fff8;
                    cursor: pointer;
                    transition: all 0.3s ease;
                }
                .upload-area:hover { 
                    background: #e8f5e8; 
                    border-color: #1e7e34;
                }
                .preview-container { margin: 15px 0; text-align: center; display: none; }
                .preview-gallery { display: flex; flex-wrap: wrap; gap: 10px; justify-content: center; }
                .preview-item { text-align: center; margin: 5px; }
                .preview-image { width: 150px; height: 100px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1); }
                .result { margin: 20px 0; padding: 15px; border-radius: 8px; }
                .success { background: #d4edda; color: #155724; border: 1px solid #c3e6cb; }
                .error { background: #f8d7da; color: #721c24; border: 1px solid #f5c6cb; }
                .loading { background: #d1ecf1; color: #0c5460; border: 1px solid #bee5eb; }
                button { 
                    padding: 12px 20px; 
                    background: #28a745; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 16px;
                    margin: 5px;
                }
                button:hover { background: #218838; }
                .danger { background: #dc3545; }
                .danger:hover { background: #c82333; }
                .json-display { background: #f8f9fa; padding: 15px; border-radius: 5px; font-family: monospace; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>🧠 GPT-4 Vision Schedule Parser</h1>
                <p><strong>✨ Same technology as ChatGPT web - no OCR needed!</strong></p>
                
                <div class="upload-area" id="uploadArea">
                    <div style="font-size: 20px; color: #28a745; margin-bottom: 10px;">📷 Upload Schedule Images</div>
                    <div style="font-size: 14px; color: #666;">GPT-4 Vision will analyze your images directly</div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">📚 Upload timetable + subject codes (multiple images supported)</div>
                    <input type="file" id="fileInput" style="display: none;" accept="image/*" multiple>
                </div>
                
                <div class="preview-container" id="previewContainer">
                    <div id="previewGallery" class="preview-gallery"></div>
                    <div style="margin-top: 15px;">
                        <button onclick="analyzeWithVision()">🧠 Analyze with GPT-4 Vision</button>
                        <button onclick="clearPreviews()" class="danger">❌ Clear All</button>
                    </div>
                </div>
                
                <div id="result"></div>
            </div>

            <script>
                let selectedFiles = [];

                const uploadArea = document.getElementById('uploadArea');
                const fileInput = document.getElementById('fileInput');
                const previewContainer = document.getElementById('previewContainer');
                const previewGallery = document.getElementById('previewGallery');
                const result = document.getElementById('result');

                uploadArea.addEventListener('click', () => fileInput.click());

                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.style.borderColor = '#1e7e34';
                    uploadArea.style.background = '#e8f5e8';
                });

                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.style.borderColor = '#28a745';
                    uploadArea.style.background = '#f8fff8';
                });

                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.style.borderColor = '#28a745';
                    uploadArea.style.background = '#f8fff8';
                    const files = Array.from(e.dataTransfer.files);
                    handleFilesSelect(files);
                });

                fileInput.addEventListener('change', (e) => {
                    const files = Array.from(e.target.files);
                    handleFilesSelect(files);
                });

                function handleFilesSelect(files) {
                    const imageFiles = files.filter(file => file.type.startsWith('image/'));
                    
                    if (imageFiles.length === 0) {
                        alert('Please select image files only!');
                        return;
                    }

                    selectedFiles = imageFiles;
                    showPreviews();
                    result.innerHTML = '';
                }

                function showPreviews() {
                    previewGallery.innerHTML = '';
                    
                    selectedFiles.forEach((file, index) => {
                        const reader = new FileReader();
                        reader.onload = (e) => {
                            const previewDiv = document.createElement('div');
                            previewDiv.className = 'preview-item';
                            previewDiv.innerHTML = \`
                                <img src="\${e.target.result}" class="preview-image">
                                <div style="font-size: 12px; color: #666; margin-top: 5px;">\${file.name}</div>
                                <button onclick="removeFile(\${index})" style="font-size: 10px; padding: 2px 6px; background: #dc3545; color: white; border: none; border-radius: 4px; margin-top: 3px;">Remove</button>
                            \`;
                            previewGallery.appendChild(previewDiv);
                        };
                        reader.readAsDataURL(file);
                    });

                    previewContainer.style.display = selectedFiles.length > 0 ? 'block' : 'none';
                }

                function removeFile(index) {
                    selectedFiles.splice(index, 1);
                    showPreviews();
                }

                function clearPreviews() {
                    selectedFiles = [];
                    previewContainer.style.display = 'none';
                    fileInput.value = '';
                    result.innerHTML = '';
                }

                async function analyzeWithVision() {
                    if (selectedFiles.length === 0) {
                        alert('Please select at least one image!');
                        return;
                    }

                    const formData = new FormData();
                    selectedFiles.forEach(file => {
                        formData.append('scheduleImages', file);
                    });

                    result.innerHTML = \`
                        <div class="result loading">
                            <h3>🧠 GPT-4 Vision Processing...</h3>
                            <p>Analyzing \${selectedFiles.length} image(s) with AI vision technology...</p>
                            <p><em>This may take 15-30 seconds for detailed analysis</em></p>
                        </div>
                    \`;

                    try {
                        const response = await fetch('/api/vision-schedule', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();

                        if (data.success) {
                            result.innerHTML = \`
                                <div class="result success">
                                    <h3>✅ GPT-4 Vision Analysis Complete!</h3>
                                    <p><strong>Message:</strong> \${data.message}</p>
                                    
                                    <h4>👤 Student Information:</h4>
                                    <ul>
                                        <li><strong>Name:</strong> \${data.analysis.studentInfo.name || 'Not found'}</li>
                                        <li><strong>Roll Number:</strong> \${data.analysis.studentInfo.rollNumber || 'Not found'}</li>
                                        <li><strong>Semester:</strong> \${data.analysis.studentInfo.semester || 'Not found'}</li>
                                        <li><strong>Department:</strong> \${data.analysis.studentInfo.department || 'Not found'}</li>
                                    </ul>
                                    
                                    <h4>📚 Subjects Found:</h4>
                                    <ul>
                                        \${data.analysis.subjects.map(subject => 
                                            \`<li><strong>\${subject.code}:</strong> \${subject.name} \${subject.credits ? '(' + subject.credits + ' credits)' : ''}</li>\`
                                        ).join('')}
                                    </ul>
                                    
                                    <h4>📅 Schedule Slots:</h4>
                                    <p>\${data.analysis.schedule.length} days with \${data.analysis.schedule.reduce((total, day) => total + day.slots.length, 0)} total time slots</p>
                                    
                                    <h4>🎯 Analysis Details:</h4>
                                    <ul>
                                        <li><strong>Confidence:</strong> \${data.analysis.confidence}</li>
                                        <li><strong>Notes:</strong> \${data.analysis.notes || 'None'}</li>
                                    </ul>
                                    
                                    <h4>📝 Extracted Information:</h4>
                                    <div class="json-display">\${data.analysis.extractedText}</div>
                                    
                                    <h4>🔧 Raw Analysis (JSON):</h4>
                                    <div class="json-display">\${JSON.stringify(data.analysis, null, 2)}</div>
                                </div>
                            \`;
                        } else {
                            result.innerHTML = \`
                                <div class="result error">
                                    <h3>❌ Analysis Failed</h3>
                                    <p><strong>Error:</strong> \${data.error}</p>
                                </div>
                            \`;
                        }

                    } catch (error) {
                        result.innerHTML = \`
                            <div class="result error">
                                <h3>❌ Request Failed</h3>
                                <p><strong>Error:</strong> \${error.message}</p>
                            </div>
                        \`;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// GPT-4 VISION SCHEDULE ANALYSIS ENDPOINT
app.post('/api/vision-schedule', upload.array('scheduleImages', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files uploaded' });
        }

        const testPhone = '+1234567890';
        console.log(`\n🧠 === GPT-4 VISION ANALYSIS STARTED ===`);
        console.log(`📷 Processing ${req.files.length} images`);

        // Collect image paths
        const imagePaths = req.files.map(file => {
            console.log(`📁 Image: ${file.originalname} (${file.size} bytes)`);
            return file.path;
        });

        // Analyze with GPT-4 Vision
        const analysis = await visionService.analyzeScheduleImages(imagePaths);
        
        console.log('🎯 Analysis complete:', analysis.confidence);

        // Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        const studentData = {
            rollNumber: analysis.studentInfo.rollNumber || 'VIS' + Math.floor(Math.random() * 10000),
            name: analysis.studentInfo.name || 'Vision Upload Student',
            semester: analysis.studentInfo.semester || 5,
            subjects: analysis.subjects || [],
            schedule: analysis.schedule || []
        };

        if (!student) {
            student = await attendanceService.registerStudent(testPhone, studentData);
            console.log('✅ Created new student from vision analysis');
        } else {
            // Update existing student's schedule
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
            console.log('✅ Updated student schedule from vision analysis');
        }

        // Clean up uploaded files
        req.files.forEach(file => {
            try {
                fs.unlinkSync(file.path);
            } catch (err) {
                console.log('File cleanup warning:', err.message);
            }
        });

        res.json({
            success: true,
            message: `GPT-4 Vision successfully analyzed ${req.files.length} images! 🧠✨`,
            analysis: analysis,
            studentCreated: !student.createdAt
        });

    } catch (error) {
        console.error('❌ GPT-4 Vision Error:', error);
        
        // Clean up files on error
        if (req.files) {
            req.files.forEach(file => {
                try {
                    fs.unlinkSync(file.path);
                } catch (err) {
                    console.log('File cleanup error:', err.message);
                }
            });
        }
        
        res.status(500).json({ 
            error: 'GPT-4 Vision analysis failed: ' + error.message 
        });
    }
});

app.listen(3006, () => {
    console.log('🧠 GPT-4 VISION SERVER RUNNING!');
    console.log('===============================');
    console.log('🌐 Open: http://localhost:3006/vision');
    console.log('');
    console.log('✨ Same technology as ChatGPT web!');
    console.log('📷 Direct image analysis - no OCR needed');
});