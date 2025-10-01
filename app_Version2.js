require('dotenv').config();
const express = require('express');
const connectDB = require('./config/config_db_Version2');
const whatsappService = require('./services/services_whatsapp_Version2');
const aiService = require('./services/services_aiService_Version2');
const attendanceService = require('./services/services_attendanceService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const axios = require('axios');

// Initialize Express app
const app = express();
app.use(express.json());

// Add error logging
const logError = (context, error) => {
  console.error(`❌ [${context}] Error:`, error.message);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack trace:', error.stack);
  }
};

// Add success logging
const logSuccess = (context, message) => {
  console.log(`✅ [${context}] ${message}`);
};

// Connect to MongoDB with error handling
connectDB().catch(error => {
  logError('Database', error);
  process.exit(1);
});

// Set up storage for uploaded files
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});
const upload = multer({ storage });

// GPT-4o Vision Service for WhatsApp image processing
class VisionService {
    constructor() {
        this.apiKey = process.env.OPENAI_API_KEY;
    }

    encodeImageToBase64(filePath) {
        const imageBuffer = fs.readFileSync(filePath);
        return imageBuffer.toString('base64');
    }

    getMimeType(filePath) {
        const ext = path.extname(filePath).toLowerCase();
        const mimeTypes = {
            '.jpg': 'image/jpeg',
            '.jpeg': 'image/jpeg',
            '.png': 'image/png',
            '.gif': 'image/gif',
            '.webp': 'image/webp'
        };
        return mimeTypes[ext] || 'image/jpeg';
    }

    async analyzeScheduleImage(imagePath) {
        try {
            console.log(`🧠 Analyzing schedule image with GPT-4o Vision...`);

            const base64Image = this.encodeImageToBase64(imagePath);
            const mimeType = this.getMimeType(imagePath);

            const response = await axios({
                method: 'POST',
                url: 'https://api.openai.com/v1/chat/completions',
                headers: {
                    'Authorization': `Bearer ${this.apiKey}`,
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
                                    text: `Analyze this schedule/timetable image and extract structured data.

Extract:
1. Student info (name, roll number, semester)
2. Subject codes and full names  
3. Weekly schedule with days and times

NOTE: Ignore teacher codes - set room to null.

Return JSON:
{
  "studentInfo": {
    "name": "name or null",
    "rollNumber": "roll or null", 
    "semester": number or null
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
  "confidence": "high/medium/low"
}`
                                },
                                {
                                    type: "image_url",
                                    image_url: {
                                        url: `data:${mimeType};base64,${base64Image}`,
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
            
            try {
                return JSON.parse(result);
            } catch (parseError) {
                console.log('📝 Non-JSON response, extracting key info...');
                return {
                    studentInfo: { name: null, rollNumber: null, semester: null },
                    subjects: [],
                    schedule: [],
                    extractedText: result,
                    confidence: "medium"
                };
            }

        } catch (error) {
            console.error('❌ Vision API Error:', error.response?.data || error.message);
            throw new Error(`Vision analysis failed: ${error.response?.data?.error?.message || error.message}`);
        }
    }
}

const visionService = new VisionService();

// Initialize WhatsApp service
whatsappService.init();
whatsappService.registerMessageHandler(async (message) => {
  await processMessage(message);
});

// For WhatsApp Business API (for production use later)
app.post('/webhook', async (req, res) => {
  try {
    // Verify the callback URL (needed for initial verification)
    const mode = req.query['hub.mode'];
    const token = req.query['hub.verify_token'];
    const challenge = req.query['hub.challenge'];
    
    // Check if a token and challenge were sent
    if (mode === 'subscribe' && token === process.env.WHATSAPP_VERIFY_TOKEN) {
      // Respond with the challenge token from the request
      console.log('WEBHOOK_VERIFIED');
      return res.status(200).send(challenge);
    } else {
      // Process incoming messages
      const message = await whatsappService.handleIncomingMessage(req.body);
      
      if (message) {
        await processMessage(message);
      }
      
      return res.status(200).send('EVENT_RECEIVED');
    }
  } catch (error) {
    console.error('Error in webhook:', error);
    return res.status(500).send('Error processing webhook');
  }
});

// For development with whatsapp-web.js
// Uncomment this if using whatsapp-web.js instead of WhatsApp Business API
/*
whatsappService.init();
whatsappService.registerMessageHandler(async (message) => {
  await processMessage(message);
});
*/

async function processMessage(message) {
  try {
    const phoneNumber = message.from;
    logSuccess('Message Processing', `Processing message from ${phoneNumber}`);
    
    let student = await Student.findOne({ phoneNumber });
    
    // Process based on message type
    if (message.type === 'text') {
      await handleTextMessage(student, phoneNumber, message.content);
    } else if (message.type === 'image' || message.type === 'document') {
      await handleMediaMessage(student, phoneNumber, message);
    }
    
    logSuccess('Message Processing', `Successfully processed message from ${phoneNumber}`);
  } catch (error) {
    logError('Message Processing', error);
    
    // Send a friendly error message to the user
    try {
      await whatsappService.sendMessage(message.from, 
        "😅 Oops! I'm having a small technical issue. Please try again in a moment. " +
        "If the problem continues, type 'help' for assistance."
      );
    } catch (sendError) {
      logError('Error Recovery', sendError);
    }
  }
}

async function handleTextMessage(student, phoneNumber, text) {
  try {
    // If student not found, send welcome message
    if (!student) {
      await whatsappService.sendMessage(phoneNumber, 
        "Welcome to the Attendance Tracker! Please share your schedule as a PDF or image to get started. " +
        "You can also type 'help' for assistance."
      );
      return;
    }
    
    // Handle different states
    if (student.chatState === 'AWAITING_SCHEDULE') {
      await whatsappService.sendMessage(phoneNumber, 
        "I'm waiting for your schedule. Please send it as a PDF or image."
      );
      return;
    }
    
    // Check for commands
    const lowerText = text.toLowerCase().trim();
    if (lowerText === 'help') {
      await whatsappService.sendMessage(phoneNumber,
        "🤖 *Attendance Tracker Help* 🤖\n\n" +
        "- Send your schedule as a PDF or image\n" +
        "- Tell me which classes you attended today\n" +
        "- Use 'attendance' to see your overall attendance\n" +
        "- Use 'subjects' to see subject-wise attendance\n" +
        "- Use 'reset' to upload a new schedule"
      );
      return;
    }
    
    if (lowerText === 'reset') {
      student.chatState = 'AWAITING_SCHEDULE';
      await student.save();
      await whatsappService.sendMessage(phoneNumber,
        "Your data has been reset. Please send your new schedule as a PDF or image."
      );
      return;
    }
    
    if (lowerText === 'attendance' || lowerText === 'summary') {
      const summary = await attendanceService.getAttendanceSummary(student._id);
      
      let message = `📊 *Attendance Summary* 📊\n\n` +
                    `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)\n\n` +
                    `*Subject-wise Breakdown:*\n`;
                    
      for (const subject of summary.subjects) {
        message += `- ${subject.code}: ${subject.present}/${subject.total} (${subject.percentage}%)\n`;
      }
      
      await whatsappService.sendMessage(phoneNumber, message);
      return;
    }
    
    if (lowerText === 'subjects') {
      const summary = await attendanceService.getAttendanceSummary(student._id);
      
      let message = `📚 *Subject-wise Attendance* 📚\n\n`;
      
      for (const subject of summary.subjects) {
        const percentage = parseFloat(subject.percentage);
        let status = '';
        
        if (percentage < 75) status = '⚠️';
        else if (percentage >= 90) status = '🌟';
        
        message += `${status} *${subject.name} (${subject.code})*\n` +
                   `   ${subject.present}/${subject.total} classes (${subject.percentage}%)\n\n`;
      }
      
      await whatsappService.sendMessage(phoneNumber, message);
      return;
    }
    
    // Process attendance reporting
    const schedule = await Schedule.findOne({ student: student._id })
      .populate('subjects');
      
    if (!schedule) {
      await whatsappService.sendMessage(phoneNumber,
        "I don't have your schedule yet. Please send it as a PDF or image."
      );
      return;
    }
    
    // Use AI to parse the attendance message
    const aiResponse = await aiService.processAttendanceQuery(text, {
      schedule: schedule.timeSlots,
      subjects: schedule.subjects
    });
    
    // If AI needs more info
    if (aiResponse.needsMoreInfo) {
      await whatsappService.sendMessage(phoneNumber, aiResponse.clarificationQuestion);
      return;
    }
    
    // Record attendance
    await attendanceService.recordAttendance(student._id, aiResponse);
    
    // Confirm to the student
    let confirmationMessage = '';
    
    if (aiResponse.isHoliday) {
      confirmationMessage = `Marked ${aiResponse.date} as a holiday. No classes counted for this day.`;
    } else {
      confirmationMessage = `Attendance recorded for ${aiResponse.date}:\n\n`;
      
      for (const entry of aiResponse.attendance) {
        const subjectName = schedule.subjects.find(s => s.code === entry.subjectCode)?.name || entry.subjectCode;
        let status = '';
        
        if (entry.status === 'PRESENT') status = '✅ Present';
        else if (entry.status === 'ABSENT') status = '❌ Absent';
        else if (entry.status === 'CANCELLED') status = '🚫 Cancelled';
        
        confirmationMessage += `- ${subjectName}: ${status}\n`;
      }
    }
    
    await whatsappService.sendMessage(phoneNumber, confirmationMessage);
    
  } catch (error) {
    logError('Text Message Handler', error);
    
    let errorMessage = "😔 I'm sorry, I had trouble understanding your message. ";
    
    // Provide specific help based on the error type
    if (error.message.includes('schedule')) {
      errorMessage += "It seems there's an issue with your schedule. Please try uploading it again.";
    } else if (error.message.includes('attendance')) {
      errorMessage += "There was a problem recording your attendance. Please try again.";
    } else {
      errorMessage += "Please type 'help' to see what I can do for you.";
    }
    
    await whatsappService.sendMessage(phoneNumber, errorMessage);
  }
}

async function handleMediaMessage(student, phoneNumber, message) {
  try {
    // Only process images for now
    if (!message.type === 'image' && !message.media?.mimetype?.startsWith('image/')) {
      await whatsappService.sendMessage(phoneNumber, 
        "Please send your schedule as an image (JPG, PNG, etc.). PDF processing will be available soon!"
      );
      return;
    }
    
    await whatsappService.sendMessage(phoneNumber, 
      "📷 I received your schedule image! Processing with AI... This may take a moment."
    );

    // Save the media to a temporary file
    let tempImagePath;
    
    if (message.media && message.media.data) {
      // From whatsapp-web.js
      const buffer = Buffer.from(message.media.data, 'base64');
      tempImagePath = path.join(__dirname, 'uploads', `whatsapp_${Date.now()}.jpg`);
      fs.writeFileSync(tempImagePath, buffer);
    } else {
      // Fallback
      throw new Error('No image data received');
    }

    console.log(`📷 Processing WhatsApp image: ${tempImagePath}`);

    // Analyze with Vision API
    const analysis = await visionService.analyzeScheduleImage(tempImagePath);
    
    console.log('🧠 Vision analysis result:', analysis);

    // Create student data from analysis
    const studentData = {
      rollNumber: analysis.studentInfo?.rollNumber || 'WA' + Math.floor(Math.random() * 10000),
      name: analysis.studentInfo?.name || 'WhatsApp Student',
      semester: analysis.studentInfo?.semester || 5,
      subjects: analysis.subjects || [],
      schedule: analysis.schedule || []
    };

    // Register or update student
    const updatedStudent = await attendanceService.registerStudent(phoneNumber, studentData);
    
    // Create or update schedule
    const existingSchedule = await Schedule.findOne({ student: updatedStudent._id });
    if (existingSchedule) {
      existingSchedule.subjects = analysis.subjects || existingSchedule.subjects;
      existingSchedule.timeSlots = analysis.schedule || existingSchedule.timeSlots;
      await existingSchedule.save();
    } else {
      const newSchedule = new Schedule({
        student: updatedStudent._id,
        subjects: analysis.subjects || [],
        timeSlots: analysis.schedule || []
      });
      await newSchedule.save();
    }

    // Send confirmation message
    let confirmationMessage = `✅ *Schedule processed successfully!*\n\n`;
    
    if (analysis.studentInfo?.name) {
      confirmationMessage += `👤 Name: ${analysis.studentInfo.name}\n`;
    }
    if (analysis.studentInfo?.rollNumber) {
      confirmationMessage += `🆔 Roll: ${analysis.studentInfo.rollNumber}\n`;
    }
    if (analysis.studentInfo?.semester) {
      confirmationMessage += `📚 Semester: ${analysis.studentInfo.semester}\n`;
    }
    
    confirmationMessage += `\n📊 Extracted Data:\n`;
    confirmationMessage += `• ${analysis.subjects?.length || 0} subjects found\n`;
    confirmationMessage += `• ${analysis.schedule?.reduce((total, day) => total + (day.slots?.length || 0), 0) || 0} time slots\n`;
    confirmationMessage += `• Confidence: ${analysis.confidence}\n\n`;
    
    confirmationMessage += `🤖 *You're all set!* Now you can:\n`;
    confirmationMessage += `• Report daily attendance\n`;
    confirmationMessage += `• Type "attendance" for summary\n`;
    confirmationMessage += `• Type "subjects" for details\n`;
    confirmationMessage += `• Type "help" for more options`;

    await whatsappService.sendMessage(phoneNumber, confirmationMessage);
    
    // Clean up the temporary file
    if (fs.existsSync(tempImagePath)) {
      fs.unlinkSync(tempImagePath);
    }
    
  } catch (error) {
    logError('Media Message Handler', error);
    
    await whatsappService.sendMessage(phoneNumber, 
      "❌ Sorry, I had trouble processing your schedule image. Please make sure:\n" +
      "• The image is clear and readable\n" +
      "• It contains your timetable/schedule\n" +
      "• Try taking a new photo with good lighting\n\n" +
      "Type 'help' if you need assistance!"
    );
    
    // Clean up any temporary files
    try {
      if (tempImagePath && fs.existsSync(tempImagePath)) {
        fs.unlinkSync(tempImagePath);
      }
    } catch (cleanupError) {
      console.error('File cleanup error:', cleanupError);
    }
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});