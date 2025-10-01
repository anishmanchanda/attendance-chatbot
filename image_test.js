const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
    res.send('<h1>📷 Image Upload Test</h1><p><a href="/upload">Test Image Upload</a></p>');
});

app.get('/upload', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>📷 Schedule Image Upload Test</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 800px; margin: 0 auto; padding: 20px; background: #f5f5f5; }
                .container { background: white; border-radius: 10px; padding: 20px; box-shadow: 0 2px 10px rgba(0,0,0,0.1); }
                .upload-area { 
                    border: 3px dashed #007cba; 
                    border-radius: 10px; 
                    padding: 30px; 
                    text-align: center; 
                    margin: 20px 0;
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
                .preview-container { margin: 15px 0; text-align: center; display: none; }
                .preview-image { max-width: 400px; max-height: 300px; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.1); }
                .result { margin: 20px 0; padding: 15px; border-radius: 8px; }
                .success { background: #d4edda; color: #155724; }
                .error { background: #f8d7da; color: #721c24; }
                button { 
                    padding: 12px 20px; 
                    background: #007cba; 
                    color: white; 
                    border: none; 
                    border-radius: 8px; 
                    cursor: pointer;
                    font-size: 16px;
                    margin: 5px;
                }
                button:hover { background: #0056b3; }
                .danger { background: #dc3545; }
                .danger:hover { background: #c82333; }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>📷 Schedule Image Upload & Processing Test</h1>
                <p><strong>🧠 AI-Powered Schedule Parser</strong></p>
                
                <div class="upload-area" id="uploadArea">
                    <div style="font-size: 18px; color: #007cba; margin-bottom: 10px;">📷 Upload Multiple Schedule Images</div>
                    <div style="font-size: 14px; color: #666;">Drag & drop multiple images or click to select</div>
                    <div style="font-size: 12px; color: #888; margin-top: 5px;">📚 Example: Schedule + Subject Codes (up to 5 images)</div>
                    <input type="file" id="fileInput" style="display: none;" accept="image/*" multiple>
                </div>
                
                <div class="preview-container" id="previewContainer">
                    <div id="previewGallery" style="display: flex; flex-wrap: wrap; gap: 10px; justify-content: center;"></div>
                    <div style="margin-top: 15px;">
                        <button onclick="uploadImages()">🚀 Process All Images with AI</button>
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

                // Click to upload
                uploadArea.addEventListener('click', () => fileInput.click());

                // Drag and drop events
                uploadArea.addEventListener('dragover', (e) => {
                    e.preventDefault();
                    uploadArea.classList.add('dragover');
                });

                uploadArea.addEventListener('dragleave', () => {
                    uploadArea.classList.remove('dragover');
                });

                uploadArea.addEventListener('drop', (e) => {
                    e.preventDefault();
                    uploadArea.classList.remove('dragover');
                    const files = Array.from(e.dataTransfer.files);
                    handleFilesSelect(files);
                });

                // File input change
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

                    if (imageFiles.length > 5) {
                        alert('Maximum 5 images allowed!');
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
                            previewDiv.style.cssText = 'text-align: center; margin: 5px;';
                            previewDiv.innerHTML = \`
                                <img src="\${e.target.result}" style="width: 150px; height: 100px; object-fit: cover; border-radius: 8px; box-shadow: 0 2px 4px rgba(0,0,0,0.1);">
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
                    
                    // Update file input
                    const dt = new DataTransfer();
                    selectedFiles.forEach(file => dt.items.add(file));
                    fileInput.files = dt.files;
                }

                function clearPreviews() {
                    selectedFiles = [];
                    previewContainer.style.display = 'none';
                    fileInput.value = '';
                    result.innerHTML = '';
                }

                async function uploadImages() {
                    if (selectedFiles.length === 0) {
                        alert('Please select at least one image!');
                        return;
                    }

                    const formData = new FormData();
                    selectedFiles.forEach(file => {
                        formData.append('scheduleImages', file);
                    });

                    result.innerHTML = \`
                        <div style="padding: 15px; text-align: center; font-style: italic;">
                            🔄 Processing \${selectedFiles.length} images with OCR and AI...<br>
                            <small>This may take 30-60 seconds depending on image complexity...</small>
                        </div>
                    \`;

                    try {
                        const response = await fetch('/api/upload-schedule', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();

                        if (data.success) {
                            result.innerHTML = \`
                                <div class="result success">
                                    <h3>✅ Success! All Images Processed</h3>
                                    <p><strong>Message:</strong> \${data.message}</p>
                                    
                                    <h4>📊 Combined Parsed Data:</h4>
                                    <ul>
                                        <li><strong>Images processed:</strong> \${data.processedImages.length}</li>
                                        <li><strong>Subjects found:</strong> \${data.parsedData.subjects}</li>
                                        <li><strong>Schedule slots:</strong> \${data.parsedData.scheduleSlots}</li>
                                        <li><strong>AI Confidence:</strong> \${data.parsedData.confidence}</li>
                                        \${data.parsedData.studentName ? '<li><strong>Student:</strong> ' + data.parsedData.studentName + '</li>' : ''}
                                        \${data.parsedData.semester ? '<li><strong>Semester:</strong> ' + data.parsedData.semester + '</li>' : ''}
                                    </ul>
                                    
                                    <h4>📷 Processed Images:</h4>
                                    <ul>
                                        \${data.processedImages.map(img => 
                                            \`<li><strong>\${img.filename}:</strong> \${img.textLength} characters extracted</li>\`
                                        ).join('')}
                                    </ul>
                                    
                                    <h4>🔍 Combined Extracted Text Sample:</h4>
                                    <div style="background: #f8f9fa; padding: 10px; border-radius: 5px; font-family: monospace; font-size: 12px; max-height: 200px; overflow-y: auto;">
                                        \${data.extractedText}
                                    </div>
                                </div>
                            \`;
                        } else {
                            result.innerHTML = \`
                                <div class="result error">
                                    <h3>❌ Processing Failed</h3>
                                    <p><strong>Error:</strong> \${data.error}</p>
                                    <p><em>Tips: Ensure all images are clear, well-lit, and contain visible schedule/subject code text.</em></p>
                                </div>
                            \`;
                        }

                    } catch (error) {
                        result.innerHTML = \`
                            <div class="result error">
                                <h3>❌ Upload Failed</h3>
                                <p><strong>Error:</strong> \${error.message}</p>
                                <p><em>Please check your connection and try again.</em></p>
                            </div>
                        \`;
                    }
                }
            </script>
        </body>
        </html>
    `);
});

// IMAGE UPLOAD AND SCHEDULE PROCESSING ENDPOINT - MULTIPLE FILES
app.post('/api/upload-schedule', upload.array('scheduleImages', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No image files uploaded' });
        }

        const testPhone = '+1234567890';
        const uploadedFiles = req.files;
        
        console.log(`📷 Processing ${uploadedFiles.length} uploaded schedule images`);
        
        let allExtractedText = '';
        const processedImages = [];

        // Step 1: Process each image with OCR
        for (let i = 0; i < uploadedFiles.length; i++) {
            const file = uploadedFiles[i];
            const imagePath = file.path;
            
            console.log(`� Processing image ${i + 1}/${uploadedFiles.length}: ${file.filename}`);
            
            // Optimize image for better OCR results
            const optimizedImagePath = imagePath.replace(/\.[^/.]+$/, '_optimized.png');
            await sharp(imagePath)
                .resize(2000, null, { withoutEnlargement: true })
                .normalize()
                .sharpen()
                .png()
                .toFile(optimizedImagePath);

            // Extract text using Tesseract OCR
            const { data: { text } } = await Tesseract.recognize(optimizedImagePath, 'eng', {
                logger: m => console.log(`OCR Image ${i + 1}:`, m)
            });

            console.log(`📝 Image ${i + 1} extracted text (${text.length} chars):`, text.substring(0, 200) + '...');

            if (text && text.trim().length > 5) {
                allExtractedText += `\n\n=== IMAGE ${i + 1}: ${file.originalname} ===\n${text}`;
                processedImages.push({
                    filename: file.originalname,
                    textLength: text.length,
                    preview: text.substring(0, 100) + '...'
                });
            }

            // Clean up files
            try {
                fs.unlinkSync(imagePath);
                fs.unlinkSync(optimizedImagePath);
            } catch (err) {
                console.log('File cleanup warning:', err.message);
            }
        }

        console.log(`📝 Combined text from all images (${allExtractedText.length} chars total)`);

        if (!allExtractedText || allExtractedText.trim().length < 20) {
            return res.status(400).json({ 
                error: 'Could not extract sufficient readable text from the images. Please ensure the images are clear and contain schedule information.' 
            });
        }

        // Step 2: Use AI to parse the combined extracted text into structured schedule data
        console.log('🧠 AI parsing combined schedule text...');
        
        const scheduleParseResult = await aiService.parseScheduleFromText(allExtractedText);
        
        console.log('📋 AI parsed schedule:', scheduleParseResult);

        // Step 3: Find or create student
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
            console.log('✅ Created new student from schedule images');
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
            console.log('✅ Updated student schedule from images');
        }

        // Step 4: Return success response
        res.json({
            success: true,
            message: `Successfully processed ${uploadedFiles.length} schedule images! 📅✨`,
            processedImages: processedImages,
            extractedText: allExtractedText.substring(0, 500) + (allExtractedText.length > 500 ? '...' : ''),
            parsedData: {
                subjects: scheduleParseResult.subjects?.length || 0,
                scheduleSlots: scheduleParseResult.schedule?.length || 0,
                studentName: scheduleParseResult.studentName,
                semester: scheduleParseResult.semester,
                confidence: scheduleParseResult.confidence
            }
        });

    } catch (error) {
        console.error('❌ Multi-image processing error:', error);
        
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
            error: 'Failed to process schedule images: ' + error.message 
        });
    }
});

app.listen(3004, () => {
    console.log('🎉 IMAGE UPLOAD TEST RUNNING!');
    console.log('=============================');
    console.log('🌐 Open your browser:');
    console.log('   👉 http://localhost:3004');
    console.log('   👉 http://localhost:3004/upload');
    console.log('');
    console.log('📷 Ready to test schedule image uploads!');
});