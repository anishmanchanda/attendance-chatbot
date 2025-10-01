#!/usr/bin/env node

const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const http = require('http');

async function testImageUpload() {
    try {
        console.log('🧪 Testing image upload...');
        
        // Find test image
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        if (files.length === 0) {
            console.log('❌ No test images found');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Using: ${files[0]}`);
        
        // Create form data
        const form = new FormData();
        form.append('scheduleImages', fs.createReadStream(testImagePath));
        form.append('phoneNumber', '+1234567890');
        
        // Make request
        const options = {
            hostname: 'localhost',
            port: 3003,
            path: '/api/whatsapp-demo/upload',
            method: 'POST',
            headers: form.getHeaders()
        };
        
        return new Promise((resolve, reject) => {
            const req = http.request(options, (res) => {
                let data = '';
                
                res.on('data', (chunk) => {
                    data += chunk;
                });
                
                res.on('end', () => {
                    try {
                        const response = JSON.parse(data);
                        if (response.success) {
                            console.log('✅ Upload successful!');
                            console.log('📊 Analysis result:', response.analysis?.confidence);
                            console.log('📚 Subjects found:', response.analysis?.subjects?.length || 0);
                        } else {
                            console.log('❌ Upload failed:', response.error);
                        }
                    } catch (e) {
                        console.log('❌ Parse error:', e.message);
                        console.log('Raw response:', data);
                    }
                    resolve();
                });
            });
            
            req.on('error', (err) => {
                console.log('❌ Request error:', err.message);
                reject(err);
            });
            
            form.pipe(req);
        });
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
    }
}

// Only run if called directly
if (require.main === module) {
    testImageUpload();
}