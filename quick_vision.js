const express = require('express');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
require('dotenv').config();

const app = express();
app.use(express.json());

// Create uploads directory
const uploadsDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadsDir)) {
    fs.mkdirSync(uploadsDir);
}

// Configure multer
const upload = multer({
    dest: 'uploads/',
    limits: { fileSize: 10 * 1024 * 1024 },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Only image files allowed'), false);
        }
    }
});

app.get('/', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🚀 Quick Vision Test</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; }
                .upload-area { border: 2px dashed #007cba; padding: 20px; text-align: center; margin: 20px 0; cursor: pointer; }
                .progress { margin: 20px 0; }
                .result { margin: 20px 0; padding: 15px; border-radius: 8px; }
                .success { background: #d4edda; color: #155724; }
                .error { background: #f8d7da; color: #721c24; }
                .loading { background: #d1ecf1; color: #0c5460; }
                pre { background: #f8f9fa; padding: 10px; border-radius: 5px; white-space: pre-wrap; max-height: 400px; overflow-y: auto; }
            </style>
        </head>
        <body>
            <h1>🚀 Quick GPT-4o Vision Test</h1>
            
            <div class="upload-area" onclick="document.getElementById('file').click()">
                📷 Click to upload ONE schedule image for quick test
                <input type="file" id="file" style="display: none;" accept="image/*">
            </div>
            
            <div id="status"></div>
            <div id="result"></div>

            <script>
                document.getElementById('file').addEventListener('change', async (e) => {
                    const file = e.target.files[0];
                    if (!file) return;

                    const formData = new FormData();
                    formData.append('image', file);

                    const status = document.getElementById('status');
                    const result = document.getElementById('result');

                    status.innerHTML = '<div class="loading">🔄 Uploading image...</div>';
                    result.innerHTML = '';

                    try {
                        const startTime = Date.now();
                        
                        status.innerHTML = '<div class="loading">🧠 Sending to GPT-4o Vision API...</div>';
                        
                        const response = await fetch('/quick-vision', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();
                        const duration = ((Date.now() - startTime) / 1000).toFixed(1);

                        status.innerHTML = \`<div class="success">✅ Complete in \${duration} seconds</div>\`;

                        if (data.success) {
                            result.innerHTML = \`
                                <div class="result success">
                                    <h3>✅ GPT-4o Vision Analysis</h3>
                                    <pre>\${data.analysis}</pre>
                                </div>
                            \`;
                        } else {
                            result.innerHTML = \`
                                <div class="result error">
                                    <h3>❌ Error</h3>
                                    <p>\${data.error}</p>
                                </div>
                            \`;
                        }

                    } catch (error) {
                        const duration = ((Date.now() - startTime) / 1000).toFixed(1);
                        status.innerHTML = \`<div class="error">❌ Failed after \${duration} seconds</div>\`;
                        result.innerHTML = \`
                            <div class="result error">
                                <h3>❌ Request Failed</h3>
                                <p>\${error.message}</p>
                            </div>
                        \`;
                    }
                });
            </script>
        </body>
        </html>
    `);
});

app.post('/quick-vision', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        console.log(`\n🚀 QUICK VISION TEST`);
        console.log(`📁 File: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Convert to base64
        const imageBuffer = fs.readFileSync(req.file.path);
        const base64Image = imageBuffer.toString('base64');
        const mimeType = req.file.mimetype;
        
        console.log(`📤 Sending to GPT-4o...`);
        const startTime = Date.now();

        // Simple vision request
        const response = await axios({
            method: 'POST',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000, // 1 minute timeout
            data: {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "Analyze this schedule/timetable image. Extract and list all subjects, time slots, and any student information you can see."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:${mimeType};base64,${base64Image}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 2000,
                temperature: 0.1
            }
        });

        const duration = Date.now() - startTime;
        console.log(`✅ Response received in ${duration}ms`);
        
        const analysis = response.data.choices[0].message.content;
        console.log(`📝 Analysis: ${analysis.substring(0, 200)}...`);

        // Clean up
        fs.unlinkSync(req.file.path);

        res.json({
            success: true,
            analysis: analysis,
            duration: duration
        });

    } catch (error) {
        console.error('❌ Quick vision error:', error.response?.data || error.message);
        
        if (req.file) {
            try { fs.unlinkSync(req.file.path); } catch (e) {}
        }
        
        res.status(500).json({
            error: error.response?.data?.error?.message || error.message
        });
    }
});

app.listen(3007, () => {
    console.log('🚀 QUICK VISION TEST SERVER');
    console.log('===========================');
    console.log('🌐 Open: http://localhost:3007');
    console.log('⚡ Test GPT-4o vision with timing');
});