const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const sharp = require('sharp');
const Tesseract = require('tesseract.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

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
        cb(null, 'debug-' + uniqueSuffix + path.extname(file.originalname));
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

app.get('/', (req, res) => {
    res.send('<h1>🔍 OCR Debug Test</h1><p><a href="/debug">Test OCR Processing</a></p>');
});

app.get('/debug', (req, res) => {
    res.send(`
        <!DOCTYPE html>
        <html>
        <head>
            <title>🔍 OCR Debug Test</title>
            <style>
                body { font-family: Arial, sans-serif; max-width: 1000px; margin: 0 auto; padding: 20px; }
                .upload-area { 
                    border: 2px dashed #007cba; 
                    padding: 20px; 
                    text-align: center; 
                    margin: 20px 0;
                    cursor: pointer;
                }
                .results { margin: 20px 0; }
                .image-result { 
                    border: 1px solid #ddd; 
                    padding: 15px; 
                    margin: 10px 0; 
                    border-radius: 8px;
                }
                .text-output {
                    background: #f5f5f5;
                    padding: 10px;
                    border-radius: 5px;
                    font-family: monospace;
                    white-space: pre-wrap;
                    max-height: 300px;
                    overflow-y: auto;
                }
            </style>
        </head>
        <body>
            <h1>🔍 OCR Debug Test</h1>
            <p>This will show you exactly what OCR is extracting from your images</p>
            
            <div class="upload-area" onclick="document.getElementById('fileInput').click()">
                📷 Click to upload schedule images for OCR testing
                <input type="file" id="fileInput" style="display: none;" accept="image/*" multiple>
            </div>
            
            <div id="results"></div>

            <script>
                document.getElementById('fileInput').addEventListener('change', async (e) => {
                    const files = Array.from(e.target.files);
                    if (files.length === 0) return;

                    const formData = new FormData();
                    files.forEach(file => formData.append('images', file));

                    document.getElementById('results').innerHTML = '<p>🔄 Processing images with detailed OCR analysis...</p>';

                    try {
                        const response = await fetch('/api/debug-ocr', {
                            method: 'POST',
                            body: formData
                        });

                        const data = await response.json();
                        
                        let html = '<h2>📊 OCR Results</h2>';
                        
                        data.results.forEach((result, i) => {
                            html += \`
                                <div class="image-result">
                                    <h3>Image \${i + 1}: \${result.filename}</h3>
                                    <p><strong>File Size:</strong> \${result.fileSize} bytes</p>
                                    <p><strong>MIME Type:</strong> \${result.mimeType}</p>
                                    <p><strong>OCR Confidence:</strong> \${result.confidence}%</p>
                                    <p><strong>Text Length:</strong> \${result.textLength} characters</p>
                                    
                                    \${result.optimizedPath ? \`<p><strong>Optimized Image:</strong> <a href="/uploads/\${result.optimizedPath.split('/').pop()}" target="_blank">View Processed Image</a></p>\` : ''}
                                    
                                    <h4>Extracted Text:</h4>
                                    <div class="text-output">\${result.extractedText || 'No text extracted'}</div>
                                    
                                    \${result.error ? \`<p style="color: red;"><strong>Error:</strong> \${result.error}</p>\` : ''}
                                </div>
                            \`;
                        });
                        
                        document.getElementById('results').innerHTML = html;
                        
                    } catch (error) {
                        document.getElementById('results').innerHTML = \`<p style="color: red;">Error: \${error.message}</p>\`;
                    }
                });
            </script>
        </body>
        </html>
    `);
});

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// OCR DEBUG ENDPOINT
app.post('/api/debug-ocr', upload.array('images', 5), async (req, res) => {
    try {
        if (!req.files || req.files.length === 0) {
            return res.status(400).json({ error: 'No files uploaded' });
        }

        console.log(`\n🔍 === OCR DEBUG SESSION STARTED ===`);
        console.log(`📁 Processing ${req.files.length} files`);

        const results = [];

        for (let i = 0; i < req.files.length; i++) {
            const file = req.files[i];
            const imagePath = file.path;
            
            console.log(`\n--- IMAGE ${i + 1} ---`);
            console.log(`📁 Original File: ${file.originalname}`);
            console.log(`📐 Size: ${file.size} bytes`);
            console.log(`🎭 MIME: ${file.mimetype}`);
            console.log(`📂 Stored at: ${imagePath}`);

            const result = {
                filename: file.originalname,
                fileSize: file.size,
                mimeType: file.mimetype,
                originalPath: imagePath
            };

            try {
                // Step 1: Try different image optimizations
                const optimizedPath = imagePath.replace(/\.[^/.]+$/, '_optimized.png');
                
                console.log(`🔧 Optimizing image...`);
                await sharp(imagePath)
                    .resize(2400, null, { withoutEnlargement: true })
                    .normalize()
                    .sharpen({ sigma: 1, flat: 1, jagged: 2 })
                    .grayscale()
                    .gamma(1.2)
                    .linear(1.2, -(128 * 1.2) + 128) // Increase contrast
                    .png({ quality: 100 })
                    .toFile(optimizedPath);
                
                result.optimizedPath = optimizedPath;
                console.log(`✅ Image optimized: ${optimizedPath}`);

                // Step 2: Run OCR with different configurations
                console.log(`🔍 Running OCR...`);
                
                const ocrResult = await Tesseract.recognize(optimizedPath, 'eng', {
                    logger: m => {
                        if (m.status === 'recognizing text') {
                            console.log(`   OCR Progress: ${Math.round(m.progress * 100)}%`);
                        }
                    },
                    tessedit_pageseg_mode: Tesseract.PSM.AUTO,
                    tessedit_ocr_engine_mode: Tesseract.OEM.LSTM_ONLY,
                });

                const { data: { text, confidence } } = ocrResult;
                
                result.confidence = Math.round(confidence);
                result.textLength = text.length;
                result.extractedText = text;
                
                console.log(`📊 OCR Complete:`);
                console.log(`   Confidence: ${result.confidence}%`);
                console.log(`   Text Length: ${result.textLength} chars`);
                console.log(`   First 200 chars: "${text.substring(0, 200)}"`);
                
                if (text.length < 10) {
                    console.log(`⚠️  Very little text extracted - possible OCR issue`);
                }

            } catch (error) {
                console.error(`❌ Error processing image ${i + 1}:`, error);
                result.error = error.message;
                result.confidence = 0;
                result.textLength = 0;
                result.extractedText = '';
            }

            results.push(result);
        }

        console.log(`\n✅ OCR Debug Complete - ${results.length} images processed`);
        
        res.json({
            success: true,
            message: `Processed ${results.length} images`,
            results: results
        });

    } catch (error) {
        console.error('❌ Debug OCR Error:', error);
        res.status(500).json({ 
            error: 'Debug processing failed: ' + error.message 
        });
    }
});

app.listen(3005, () => {
    console.log('🔍 OCR DEBUG SERVER RUNNING!');
    console.log('=============================');
    console.log('🌐 Open: http://localhost:3005/debug');
    console.log('');
    console.log('This will show you exactly what OCR sees in your images');
});