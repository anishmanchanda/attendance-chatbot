require('dotenv').config();
const axios = require('axios');
const fs = require('fs');
const path = require('path');

// Test the exact same Vision API call the server would make
async function testServerVisionCall() {
    try {
        console.log('🔍 Testing server Vision API call...');
        
        const apiKey = process.env.OPENAI_API_KEY;
        
        // Use the exact same parameters as the server
        const uploadsDir = path.join(__dirname, 'uploads');
        const files = fs.readdirSync(uploadsDir).filter(f => f.match(/\.(jpg|jpeg|png|gif)$/i));
        
        if (files.length === 0) {
            console.log('❌ No test images');
            return;
        }
        
        const testImagePath = path.join(uploadsDir, files[0]);
        console.log(`📷 Using: ${files[0]}`);
        
        const imageBuffer = fs.readFileSync(testImagePath);
        const base64Image = imageBuffer.toString('base64');
        
        // Use exact same prompt and parameters as the fixed_demo.js server
        const response = await axios({
            method: 'POST',
            url: 'https://api.openai.com/v1/chat/completions',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json'
            },
            timeout: 120000,
            data: {
                model: "gpt-4o",
                messages: [
                    {
                        role: "user",
                        content: [
                            {
                                type: "text",
                                text: `Analyze these schedule/timetable images and extract structured data.

IMPORTANT: Respond with ONLY valid JSON, no markdown code blocks.

Extract:
1. Student info (name, roll number, semester)
2. Subject codes and full names
3. Weekly schedule with days and times

NOTE: Ignore teacher codes - set room to null.

Return this exact JSON format (no \`\`\`json\`\`\`):
{
  "studentInfo": {
    "name": "name or null",
    "rollNumber": "roll or null",
    "semester": "semester or null"
  },
  "subjects": [
    {"code": "CS101", "name": "Computer Science", "credits": 3}
  ],
  "schedule": [
    {
      "day": "Monday",
      "slots": [
        {"subject": "CS101", "startTime": "09:00", "endTime": "10:00", "room": null}
      ]
    }
  ],
  "confidence": "high"
}`
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
                max_tokens: 4000,
                temperature: 0.1
            }
        });
        
        const result = response.data.choices[0].message.content;
        console.log('📝 Raw response:');
        console.log(result);
        console.log('\n🔧 Testing parsing logic...');
        
        try {
            // Try direct parsing first
            const parsed = JSON.parse(result);
            console.log('✅ Direct JSON parse SUCCESS!');
            console.log(JSON.stringify(parsed, null, 2));
            return parsed;
        } catch (parseError) {
            console.log('📝 Cleaning response and trying again...');
            
            // Remove markdown code blocks and extract JSON
            let cleanedResult = result;
            
            // Remove ```json and ``` markers
            cleanedResult = cleanedResult.replace(/```json\s*/g, '').replace(/```\s*/g, '');
            
            // Try to find JSON object in the response
            const jsonMatch = cleanedResult.match(/\{[\s\S]*\}/);
            
            if (jsonMatch) {
                try {
                    const parsed = JSON.parse(jsonMatch[0]);
                    console.log('✅ Successfully extracted and parsed JSON');
                    console.log(JSON.stringify(parsed, null, 2));
                    return parsed;
                } catch (secondError) {
                    console.log('❌ Second parse attempt failed:', secondError.message);
                }
            }
            
            console.log('📝 Fallback: extracting key info from text...');
            return {
                studentInfo: { name: null, rollNumber: null, semester: null },
                subjects: [],
                schedule: [],
                extractedText: result,
                confidence: "low"
            };
        }
        
    } catch (error) {
        console.error('❌ API Error:', error.response?.data || error.message);
    }
}

testServerVisionCall();