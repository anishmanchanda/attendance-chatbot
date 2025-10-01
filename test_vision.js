require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test the Vision API directly
async function testVisionAPI() {
    try {
        console.log('🧠 Testing GPT-4o Vision API...');
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.error('❌ No OpenAI API key found');
            return;
        }
        
        console.log(`✅ API key found: ${apiKey.substring(0, 10)}...`);
        
        // Check if we have any test images
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        if (files.length === 0) {
            console.log('❌ No test images found in uploads folder');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Testing with image: ${files[0]}`);
        
        // Encode image to base64
        const imageBuffer = fs.readFileSync(testImagePath);
        const base64Image = imageBuffer.toString('base64');
        
        const response = await axios({
            method: 'POST',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 60000,
            data: {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: "What do you see in this image? Be descriptive."
                            },
                            {
                                type: "image_url",
                                image_url: {
                                    url: `data:image/jpeg;base64,${base64Image}`,
                                    detail: "high"
                                }
                            }
                        ]
                    }
                ],
                max_tokens: 1000
            }
        });
        
        console.log('✅ Vision API Response:');
        console.log(response.data.choices[0].message.content);
        
    } catch (error) {
        console.error('❌ Vision API Error:', error.response?.data || error.message);
    }
}

testVisionAPI();