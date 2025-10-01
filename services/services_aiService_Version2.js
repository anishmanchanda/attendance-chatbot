const axios = require('axios');

class AIService {
  constructor() {
    this.openaiApiKey = process.env.OPENAI_API_KEY;
  }

  async processConversation(message, studentContext) {
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
              content: `You are an intelligent attendance tracking assistant. You handle ALL aspects of student interaction.

              Current student context: ${JSON.stringify(studentContext)}
              Current date: ${new Date().toISOString().split('T')[0]}
              
              Based on the student's message, decide what action to take and respond appropriately.
              
              AVAILABLE ACTIONS:
              1. "register_student" - when student wants to register
              2. "record_attendance" - when student reports attendance 
              3. "get_summary" - when student wants attendance summary
              4. "general_conversation" - for any other conversation
              
              For registration, extract name and roll number from the message.
              For attendance, parse which subjects they attended/missed and create attendance data.
              For summaries, acknowledge the request.
              For general conversation, be helpful and guide them.
              
              ALWAYS respond in this JSON format:
              {
                "action": "register_student|record_attendance|get_summary|general_conversation",
                "message": "Your conversational response to the student",
                "name": "extracted name (for registration)",
                "rollNumber": "extracted roll number (for registration)", 
                "semester": number (for registration),
                "attendanceData": {
                  "date": "YYYY-MM-DD",
                  "isHoliday": boolean,
                  "attendance": [
                    {"subjectCode": "CS101", "status": "PRESENT|ABSENT|CANCELLED"}
                  ]
                }
              }
              
              Be conversational, friendly, and intelligent. Understand context and natural language.`
            },
            {
              role: "user",
              content: message
            }
          ],
          temperature: 0.3,
          response_format: { type: "json_object" }
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error in AI conversation processing:', error);
      throw error;
    }
  }

  async handleError(errorMessage, userMessage) {
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
              content: `You are helping handle an error in an attendance tracking system. 
              
              The user said: "${userMessage}"
              The system error was: "${errorMessage}"
              
              Provide a helpful, user-friendly response that explains what went wrong and suggests a solution.
              
              Respond in JSON format:
              {
                "message": "Your helpful error explanation and suggestion"
              }`
            }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      return { message: "I'm having trouble processing your request right now. Please try again later." };
    }
  }

  async parseScheduleFromText(extractedText) {
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
              content: `You are an intelligent schedule parser that extracts structured data from OCR text of student timetables/schedules.

              IMPORTANT: The input may contain text from MULTIPLE images (e.g., main schedule + subject codes sheet).
              Look for patterns across all the text to build a complete picture.

              Parse the following OCR-extracted text and identify:
              1. Student name (if mentioned)
              2. Roll number/Student ID (if mentioned)  
              3. Semester/Year (if mentioned)
              4. Subject codes and names (may be in separate sections)
              5. Time slots and days for each subject
              6. Class timings and rooms

              Common patterns to look for:
              - Subject codes like: CS101, MATH201, PHY301, CSE101, ECE201, etc.
              - Subject names like: Computer Science, Mathematics, Physics, Electronics, etc.
              - Days: Monday, Tuesday, Wed, Thu, Fri, Sat, Sun, Mon, Tue, etc.
              - Times: 9:00 AM, 10:30, 14:00, 2 PM, etc.
              - Student info: Name: John, Roll: 12345, Semester: 3, etc.
              - Subject code mappings: CS101 = Computer Science Fundamentals

              When processing multiple images:
              - Combine information from all sources
              - Look for subject code definitions in one image and timetable in another
              - Cross-reference codes with full names when possible
              - Build the most complete schedule possible

              Return a JSON object with this structure:
              {
                "studentName": "extracted name or null",
                "rollNumber": "extracted roll number or null",
                "semester": number or null,
                "subjects": [
                  {
                    "code": "CS101",
                    "name": "Computer Science Fundamentals", 
                    "credits": number or null
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
                        "room": "A101 or null"
                      }
                    ]
                  }
                ],
                "confidence": "high|medium|low - based on how complete and clear the data is",
                "sourceImages": "brief description of what each image seemed to contain"
              }

              If you can't find specific information, set it to null. Extract whatever is clearly visible and correlate information across multiple images when possible.`
            },
            {
              role: "user",
              content: `Please parse this OCR text from a student schedule image:\n\n${extractedText}`
            }
          ],
          temperature: 0.1,
          response_format: { type: "json_object" }
        }
      });
      
      return JSON.parse(response.data.choices[0].message.content);
    } catch (error) {
      console.error('Error parsing schedule from text:', error);
      // Return a basic fallback structure
      return {
        studentName: null,
        rollNumber: null,
        semester: null,
        subjects: [],
        schedule: [],
        confidence: "low",
        error: "Failed to parse schedule text"
      };
    }
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

module.exports = AIService;