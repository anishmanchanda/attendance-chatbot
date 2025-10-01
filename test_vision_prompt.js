require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test the Vision API with a more specific prompt
async function testVisionPrompt() {
    try {
        console.log('🧠 Testing Vision API with improved prompt...');
        
        const apiKey = process.env.OPENAI_API_KEY;
        
        // Find test image
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        if (files.length === 0) {
            console.log('❌ No test images found');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Testing with: ${files[0]}`);
        
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
                                text: `You are a data extraction expert. Analyze this academic schedule/timetable image and extract information in STRICT JSON format.

IMPORTANT: Respond ONLY with valid JSON, no other text.

Extract and return this exact JSON structure:
{
  "studentInfo": {
    "name": "extracted name or null",
    "rollNumber": "extracted roll number or null",
    "semester": "extracted semester number or null"
  },
  "subjects": [
    {
      "code": "subject code like CS101",
      "name": "full subject name",
      "credits": "number of credits"
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
          "room": null
        }
      ]
    }
  ],
  "confidence": "high"
}

RESPOND ONLY WITH JSON - NO OTHER TEXT`
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
                max_tokens: 3000,
                temperature: 0
            }
        });
        
        const result = response.data.choices[0].message.content;
        console.log('📝 Raw Response:');
        console.log(result);
        console.log('\n🔍 Attempting to parse JSON...');
        
        try {
            const parsed = JSON.parse(result);
            console.log('✅ Successfully parsed JSON:');
            console.log(JSON.stringify(parsed, null, 2));
        } catch (parseError) {
            console.log('❌ JSON Parse Error:', parseError.message);
            console.log('📝 Cleaning response and trying again...');
            
            // Try to extract JSON from response
            const jsonMatch = result.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
                try {
                    const cleaned = jsonMatch[0];
                    const parsed = JSON.parse(cleaned);
                    console.log('✅ Extracted and parsed JSON:');
                    console.log(JSON.stringify(parsed, null, 2));
                } catch (secondError) {
                    console.log('❌ Still failed to parse:', secondError.message);
                }
            } else {
                console.log('❌ No JSON found in response');
            }
        }
        
    } catch (error) {
        console.error('❌ Vision API Error:', error.response?.data || error.message);
    }
}

testVisionPrompt();