const { createWorker } = require('tesseract.js');
const pdfParse = require('pdf-parse');
const fs = require('fs');
const path = require('path');
const axios = require('axios');
const sharp = require('sharp');

class DocumentProcessor {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async processDocument(filePath, mimeType) {
    try {
      let extractedText = '';
      
      if (mimeType.startsWith('image/')) {
        // Preprocess image for better OCR results
        const preprocessedPath = await this.preprocessImage(filePath);
        
        // Extract text using Tesseract
        extractedText = await this.extractTextFromImage(preprocessedPath);
        
        // Clean up preprocessed image
        fs.unlinkSync(preprocessedPath);
      } else if (mimeType === 'application/pdf') {
        // Extract text from PDF
        extractedText = await this.extractTextFromPdf(filePath);
      } else {
        throw new Error(`Unsupported document type: ${mimeType}`);
      }
      
      // Use AI to extract structured information
      return await this.extractStructuredInformation(extractedText);
    } catch (error) {
      console.error('Error processing document:', error);
      throw error;
    }
  }

  async preprocessImage(imagePath) {
    const outputPath = `${imagePath}_processed.png`;
    
    await sharp(imagePath)
      .resize(1800) // Resize to manageable size while keeping details
      .normalize() // Normalize contrast
      .sharpen() // Sharpen for better text recognition
      .threshold(128) // Convert to binary for better text contrast
      .toFile(outputPath);
      
    return outputPath;
  }

  async extractTextFromImage(imagePath) {
    const worker = await createWorker();
    await worker.loadLanguage('eng');
    await worker.initialize('eng');
    
    const { data: { text } } = await worker.recognize(imagePath);
    await worker.terminate();
    
    return text;
  }

  async extractTextFromPdf(pdfPath) {
    const dataBuffer = fs.readFileSync(pdfPath);
    const data = await pdfParse(dataBuffer);
    return data.text;
  }

  async extractStructuredInformation(text) {
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: "gpt-4",
          messages: [
            {
              role: "system",
              content: `You are a specialized document parser for student schedules. 
              Extract the following from the text:
              1. Student roll number
              2. Student name (if available)
              3. Semester information
              4. List of subjects with their codes
              5. Weekly schedule with days, times, and subjects
              
              Format your response as JSON with the following structure:
              {
                "rollNumber": "string",
                "name": "string",
                "semester": number,
                "subjects": [
                  {
                    "code": "string",
                    "name": "string"
                  }
                ],
                "schedule": [
                  {
                    "day": "string",
                    "slots": [
                      {
                        "subject": "string (code)",
                        "startTime": "string (HH:MM)",
                        "endTime": "string (HH:MM)"
                      }
                    ]
                  }
                ]
              }`
            },
            {
              role: "user",
              content: text
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error extracting structured information:', error);
      throw error;
    }
  }
}

module.exports = new DocumentProcessor();