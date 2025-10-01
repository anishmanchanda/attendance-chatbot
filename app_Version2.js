require('dotenv').config();
const express = require('express');
const connectDB = require('./config/config_db_Version2');
const whatsappService = require('./services/services_whatsapp_Version1');
const docProcessor = require('./services/services_docProcessor_Version2');
const aiService = require('./services/services_aiService_Version2');
const attendanceService = require('./services/services_attendanceService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');
const path = require('path');
const fs = require('fs');
const multer = require('multer');

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
    let mediaPath;
    let mimetype;
    
    if (message.mediaUrl) {
      // For WhatsApp Business API
      const tempPath = path.join(__dirname, 'uploads', `${Date.now()}-file`);
      fs.writeFileSync(tempPath, message.mediaUrl.buffer);
      mediaPath = tempPath;
      mimetype = message.mediaUrl.mimeType;
    } else {
      // For whatsapp-web.js
      mediaPath = message.mediaPath;
      mimetype = message.mimetype;
    }
    
    await whatsappService.sendMessage(phoneNumber, 
      "I received your document. Processing it now... This may take a moment."
    );
    
    // Process the document
    const extractedData = await docProcessor.processDocument(mediaPath, mimetype);
    
    // Create or update student record
    const updatedStudent = await attendanceService.registerStudent(phoneNumber, {
      rollNumber: extractedData.rollNumber,
      name: extractedData.name,
      semester: extractedData.semester,
      subjects: extractedData.subjects,
      schedule: extractedData.schedule
    });
    
    // Send confirmation
    await whatsappService.sendMessage(phoneNumber,
      `✅ Your schedule has been processed successfully!\n\n` +
      `Roll Number: ${extractedData.rollNumber}\n` +
      `Semester: ${extractedData.semester}\n` +
      `Subjects: ${extractedData.subjects.length}\n\n` +
      `You can now report your daily attendance. Just tell me which classes you attended today.`
    );
    
    // Clean up the file if needed
    fs.unlinkSync(mediaPath);
    
  } catch (error) {
    console.error('Error handling media message:', error);
    await whatsappService.sendMessage(phoneNumber, 
      "Sorry, I had trouble processing your document. Please make sure it's clear and contains your schedule information."
    );
  }
}

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});