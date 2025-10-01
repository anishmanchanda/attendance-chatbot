const FormData = require('form-data');
const fs = require('fs');
const path = require('path');
const axios = require('axios');

async function testUploadEndpoint() {
    try {
        console.log('📤 Testing image upload endpoint...');
        
        // Find a test image
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        if (files.length === 0) {
            console.log('❌ No test images found');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Uploading: ${files[0]}`);
        
        // Create form data
        const formData = new FormData();
        formData.append('scheduleImages', fs.createReadStream(testImagePath));
        formData.append('phoneNumber', '+1234567890');
        
        // Make request to upload endpoint
        const response = await axios.post('http://localhost:3003/api/whatsapp-demo/upload', formData, {
            headers: {
                ...formData.getHeaders()
            },
            timeout: 60000
        });
        
        console.log('✅ Upload successful!');
        console.log('Response:', response.data);
        
    } catch (error) {
        console.error('❌ Upload failed:', error.response?.data || error.message);
    }
}

testUploadEndpoint();