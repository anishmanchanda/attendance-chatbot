const axios = require('axios');

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async processAttendanceQuery(message, studentContext) {
    try {
      const response = await axios({
        method: 'POST',
        url: 'https://api.openai.com/v1/chat/completions',
        headers: {
          'Authorization': `Bearer ${this.openaiApiKey}`,
          'Content-Type': 'application/json'
        },
        data: {
          model: "gpt-3.5-turbo-0125",
          messages: [
            {
              role: "system",
              content: `You are an attendance tracking assistant that helps parse student messages about their attendance.
              
              Current date: ${new Date().toISOString().split('T')[0]}
              Student schedule context: ${JSON.stringify(studentContext)}
              
              Parse the student's message and extract:
              1. Whether they're reporting attendance for today or another date
              2. Which classes they attended or missed
              3. Any classes that were cancelled
              4. If the entire day was a holiday
              
              Format your response as JSON with the following structure:
              {
                "date": "YYYY-MM-DD",
                "isHoliday": boolean,
                "attendance": [
                  {
                    "subjectCode": "string",
                    "status": "PRESENT|ABSENT|CANCELLED"
                  }
                ],
                "needsMoreInfo": boolean,
                "clarificationQuestion": "string (only if needsMoreInfo is true)"
              }`
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error processing attendance query:', error);
      throw error;
    }
  }
}

module.exports = new AIService();