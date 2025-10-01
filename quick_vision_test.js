// Test vision without starting a server
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Load environment manually
const dotenv = require('dotenv');
dotenv.config();

async function quickVisionTest() {
    try {
        console.log('🧠 Quick Vision Test...');
        
        const apiKey = process.env.OPENAI_API_KEY;
        if (!apiKey) {
            console.log('❌ No API key');
            return;
        }
        
        console.log('✅ API key loaded');
        
        // Find test image
        const uploadsDir = path.join(__dirname, 'uploads');
        if (!fs.existsSync(uploadsDir)) {
            console.log('❌ No uploads directory');
            return;
        }
        
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        if (files.length === 0) {
            console.log('❌ No test images found');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Testing with: ${files[0]}`);
        
        const imageBuffer = fs.readFileSync(testImagePath);
        const base64Image = imageBuffer.toString('base64');
        
        console.log('🌐 Making API request...');
        
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
                                text: "Return ONLY valid JSON. Extract student info and subjects from this schedule image. Format: {\"studentInfo\":{\"name\":\"...\",\"rollNumber\":\"...\",\"semester\":\"...\"},\"subjects\":[{\"code\":\"...\",\"name\":\"...\"}],\"confidence\":\"high\"}"
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
                max_tokens: 2000,
                temperature: 0
            }
        });
        
        const result = response.data.choices[0].message.content;
        console.log('📝 Raw Response:');
        console.log(result);
        console.log('\n---');
        
        try {
            const parsed = JSON.parse(result);
            console.log('✅ JSON Parse Success!');
            console.log(JSON.stringify(parsed, null, 2));
        } catch (error) {
            console.log('❌ JSON Parse Failed:', error.message);
            
            // Try to find JSON in the response
            const jsonMatch = result.match(/\{.*\}/s);
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('✅ Extracted JSON Success!');
                    console.log(JSON.stringify(parsed, null, 2));
                } catch (e) {
                    console.log('❌ Extracted JSON also failed');
                }
            }
        }
        
    } catch (error) {
        console.error('❌ Error:', error.response?.data || error.message);
    }
}

quickVisionTest();