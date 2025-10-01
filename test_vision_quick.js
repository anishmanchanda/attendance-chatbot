const axios = require('axios');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

async function testVisionAPI() {
    try {
        console.log('🧪 Testing GPT-4o Vision API...');
        
        // Find an image to test with
        const uploadsDir = path.join(__dirname, 'uploads');
        const imageFiles = fs.readdirSync(uploadsDir).filter(file => 
            file.endsWith('.png') || file.endsWith('.jpg') || file.endsWith('.jpeg')
        );
        
        if (imageFiles.length === 0) {
            console.log('❌ No test images found in uploads folder');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, imageFiles[0]);
        console.log(`📷 Testing with image: ${testImagePath}`);
        
        // Encode image to base64
        const imageBuffer = fs.readFileSync(testImagePath);
        const base64Image = imageBuffer.toString('base64');
        
        console.log('🔑 Using API key:', process.env.OPENAI_API_KEY ? 'Found' : 'Missing');
        
        const response = await axios({
            method: 'POST',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${process.env.OPENAI_API_KEY}`,
                'Content-Type': 'application/json'
            },
            timeout: 30000,
            data: {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "What do you see in this image? Describe it briefly."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/png;base64,${base64Image}`,
                                    detail: "low"
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 300
            }
        });
        
        console.log('✅ Vision API Response:');
        console.log(response.data.choices[0].message.content);
        
    } catch (error) {
        console.error('❌ Vision API Test Failed:');
        console.error('Status:', error.response?.status);
        console.error('Error:', error.response?.data || error.message);
    }
}

testVisionAPI();