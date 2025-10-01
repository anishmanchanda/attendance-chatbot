require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const attendanceService = require('./services/services_attendanceService_Version2');
const aiService = require('./services/services_aiService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

const app = express();
app.use(express.json());

console.log('🌐 Starting Web Test Interface...');
console.log('==================================');

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

// Simple test endpoint
app.get('/', (req, res) => {
    res.send(`
    <html>
    <body style="font-family: Arial; padding: 20px;">
        <h1>🤖 Your Attendance Bot is Working!</h1>
        <p>✅ Database: Connected</p>
        <p>✅ Server: Running on port ${PORT}</p>
        <p><a href="/test">Click here to test the chat interface</a></p>
    </body>
    </html>
    `);
});

// Test page with chat interface
app.get('/test', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>🤖 Attendance Bot Test</title>
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                padding: 20px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                min-height: 100vh;
            }
            .container { 
                max-width: 800px; 
                margin: 0 auto; 
                background: white; 
                border-radius: 10px; 
                box-shadow: 0 10px 30px rgba(0,0,0,0.2);
                overflow: hidden;
            }
            .header { 
                background: #25D366; 
                color: white; 
                padding: 20px; 
                text-align: center;
            }
            .chat { 
                height: 400px; 
                overflow-y: scroll; 
                padding: 20px; 
                background: #f5f5f5;
            }
            .message { 
                margin: 10px 0; 
                padding: 10px; 
                border-radius: 10px; 
                max-width: 70%;
            }
            .user-message { 
                background: #DCF8C6; 
                margin-left: auto; 
                text-align: right;
            }
            .bot-message { 
                background: white; 
                border: 1px solid #ddd;
            }
            .input-area { 
                padding: 20px; 
                background: white; 
                display: flex; 
                gap: 10px;
            }
            #messageInput { 
                flex: 1; 
                padding: 12px; 
                border: 2px solid #ddd; 
                border-radius: 25px; 
                outline: none;
            }
            #messageInput:focus {
                border-color: #25D366;
            }
            button { 
                padding: 12px 20px; 
                background: #25D366; 
                color: white; 
                border: none; 
                border-radius: 25px; 
                cursor: pointer;
                font-weight: bold;
            }
            button:hover {
                background: #128C7E;
            }
            .examples {
                padding: 20px;
                background: #f9f9f9;
                border-top: 1px solid #ddd;
            }
            .example-btn {
                display: inline-block;
                margin: 5px;
                padding: 8px 15px;
                background: #e3f2fd;
                color: #1976d2;
                border: 1px solid #bbdefb;
                border-radius: 20px;
                cursor: pointer;
                font-size: 12px;
            }
            .example-btn:hover {
                background: #bbdefb;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <div class="header">
                <h1>🤖 Attendance Chatbot</h1>
                <p>Test your AI-powered attendance tracking system!</p>
            </div>
            
            <div class="chat" id="chat">
                <div class="message bot-message">
                    <strong>🤖 Bot:</strong> Hi! I'm your attendance tracking assistant. 
                    I can help you register, track attendance, and get summaries. 
                    Try sending me a message!
                </div>
            </div>
            
            <div class="examples">
                <strong>💡 Try these examples:</strong><br>
                <span class="example-btn" onclick="sendExample('register me')">Register Me</span>
                <span class="example-btn" onclick="sendExample('I attended Math and Physics today')">Report Attendance</span>
                <span class="example-btn" onclick="sendExample('attendance summary')">Get Summary</span>
                <span class="example-btn" onclick="sendExample('help')">Help</span>
                <span class="example-btn" onclick="sendExample('subjects')">Subject List</span>
            </div>
            
            <div class="input-area">
                <input type="text" id="messageInput" placeholder="Type your message here..." 
                       onkeypress="if(event.key==='Enter') sendMessage()">
                <button onclick="sendMessage()">Send 📤</button>
            </div>
        </div>
        
        <script>
            function sendExample(text) {
                document.getElementById('messageInput').value = text;
                sendMessage();
            }
            
            async function sendMessage() {
                const input = document.getElementById('messageInput');
                const chat = document.getElementById('chat');
                const message = input.value.trim();
                if (!message) return;
                
                // Add user message
                chat.innerHTML += '<div class="message user-message"><strong>You:</strong> ' + message + '</div>';
                input.value = '';
                
                // Add loading message
                chat.innerHTML += '<div class="message bot-message" id="loading"><strong>🤖 Bot:</strong> <em>Thinking... 🤔</em></div>';
                chat.scrollTop = chat.scrollHeight;
                
                try {
                    const response = await fetch('/api/message', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message, phone: '+1234567890' })
                    });
                    const data = await response.json();
                    
                    // Remove loading message
                    document.getElementById('loading').remove();
                    
                    // Add bot response
                    chat.innerHTML += '<div class="message bot-message"><strong>🤖 Bot:</strong> ' + data.reply.replace(/\\n/g, '<br>') + '</div>';
                } catch (error) {
                    document.getElementById('loading').remove();
                    chat.innerHTML += '<div class="message bot-message"><strong>🤖 Bot:</strong> ❌ Sorry, there was an error processing your message!</div>';
                }
                
                chat.scrollTop = chat.scrollHeight;
            }
            
            // Focus on input when page loads
            window.onload = function() {
                document.getElementById('messageInput').focus();
            }
        </script>
    </body>
    </html>
    `);
});

// API endpoint to process messages
app.post('/api/message', async (req, res) => {
    try {
        const { message, phone } = req.body;
        console.log('📱 Received message:', message);
        
        let reply = "";
        const lowerMessage = message.toLowerCase().trim();
        
        // Find or create test student
        let student = await Student.findOne({ phoneNumber: phone });
        
        if (lowerMessage === 'help') {
            reply = `🤖 *Attendance Tracker Help* 🤖\\n\\n` +
                   `Available commands:\\n` +
                   `• "register me" - Set up your profile\\n` +
                   `• "I attended [subjects]" - Report attendance\\n` +
                   `• "attendance" or "summary" - View your stats\\n` +
                   `• "subjects" - See subject-wise breakdown\\n` +
                   `• "reset" - Clear your data\\n\\n` +
                   `Example: "I attended Math and Physics today"`;
        }
        else if (lowerMessage.includes('register')) {
            // Create a test student if none exists
            if (!student) {
                const testStudentData = {
                    rollNumber: 'TEST' + Math.floor(Math.random() * 1000),
                    name: 'Test Student',
                    semester: 5,
                    subjects: [
                        { code: 'CS101', name: 'Computer Science' },
                        { code: 'MATH201', name: 'Mathematics' },
                        { code: 'PHY101', name: 'Physics' },
                        { code: 'CHEM101', name: 'Chemistry' }
                    ],
                    schedule: [
                        {
                            day: 'Monday',
                            slots: [
                                { subject: 'CS101', startTime: '09:00', endTime: '10:00' },
                                { subject: 'MATH201', startTime: '11:00', endTime: '12:00' }
                            ]
                        },
                        {
                            day: 'Tuesday',
                            slots: [
                                { subject: 'PHY101', startTime: '10:00', endTime: '11:00' },
                                { subject: 'CHEM101', startTime: '14:00', endTime: '15:00' }
                            ]
                        }
                    ]
                };
                
                student = await attendanceService.registerStudent(phone, testStudentData);
                reply = `✅ Registration successful!\\n\\n` +
                       `Roll Number: ${student.rollNumber}\\n` +
                       `Name: ${student.name}\\n` +
                       `Subjects: 4 subjects enrolled\\n\\n` +
                       `You can now report your daily attendance!`;
            } else {
                reply = `✅ You're already registered!\\n\\n` +
                       `Roll Number: ${student.rollNumber}\\n` +
                       `Name: ${student.name}\\n\\n` +
                       `Ready to track attendance!`;
            }
        }
        else if (lowerMessage.includes('attendance') || lowerMessage.includes('summary')) {
            if (!student) {
                reply = `❌ Please register first by typing "register me"`;
            } else {
                const summary = await attendanceService.getAttendanceSummary(student._id);
                
                reply = `📊 *Attendance Summary* 📊\\n\\n` +
                       `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)\\n\\n` +
                       `*Subject-wise Breakdown:*\\n`;
                       
                for (const subject of summary.subjects) {
                    const percentage = parseFloat(subject.percentage) || 0;
                    let status = '';
                    if (percentage < 75) status = '⚠️';
                    else if (percentage >= 90) status = '🌟';
                    else status = '✅';
                    
                    reply += `${status} ${subject.name}: ${subject.present}/${subject.total} (${subject.percentage}%)\\n`;
                }
            }
        }
        else if (lowerMessage === 'subjects') {
            if (!student) {
                reply = `❌ Please register first by typing "register me"`;
            } else {
                const summary = await attendanceService.getAttendanceSummary(student._id);
                reply = `📚 *Your Subjects* 📚\\n\\n`;
                
                for (const subject of summary.subjects) {
                    reply += `• ${subject.name} (${subject.code})\\n`;
                }
                
                reply += `\\nTo report attendance, say: "I attended [subject names] today"`;
            }
        }
        else if (lowerMessage === 'reset') {
            if (student) {
                await Student.deleteOne({ _id: student._id });
                reply = `🔄 Your data has been reset. Type "register me" to start over.`;
            } else {
                reply = `✅ No data to reset. Type "register me" to get started.`;
            }
        }
        else if (lowerMessage.includes('attended') || lowerMessage.includes('present') || lowerMessage.includes('went to')) {
            if (!student) {
                reply = `❌ Please register first by typing "register me"`;
            } else {
                try {
                    // Get student's schedule for AI context
                    const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
                    
                    if (!schedule) {
                        reply = `❌ No schedule found. Please contact admin.`;
                    } else {
                        // Use your REAL AI service to process attendance
                        console.log('🧠 Using REAL OpenAI to process:', message);
                        const aiResponse = await aiService.processAttendanceQuery(message, {
                            schedule: schedule.timeSlots,
                            subjects: schedule.subjects
                        });
                        
                        if (aiResponse.needsMoreInfo) {
                            reply = `🤔 ${aiResponse.clarificationQuestion}`;
                        } else {
                            // Record attendance using real service
                            await attendanceService.recordAttendance(student._id, aiResponse);
                            
                            reply = `✅ *REAL AI PROCESSED & SAVED!*\\n\\n📅 Date: ${aiResponse.date}\\n\\n`;
                            
                            if (aiResponse.isHoliday) {
                                reply += `🏖️ Marked as holiday - no classes counted.`;
                            } else {
                                reply += `*OpenAI understood and recorded:*\\n`;
                                for (const entry of aiResponse.attendance) {
                                    const subjectName = schedule.subjects.find(s => s.code === entry.subjectCode)?.name || entry.subjectCode;
                                    let status = '';
                                    
                                    if (entry.status === 'PRESENT') status = '✅ Present';
                                    else if (entry.status === 'ABSENT') status = '❌ Absent';
                                    else if (entry.status === 'CANCELLED') status = '🚫 Cancelled';
                                    
                                    reply += `• ${subjectName}: ${status}\\n`;
                                }
                            }
                            
                            reply += `\\n*Processed by OpenAI GPT and saved to MongoDB!*`;
                        }
                    }
                } catch (aiError) {
                    console.error('❌ OpenAI Error:', aiError);
                    reply = `🤖 OpenAI processing failed: ${aiError.message}\\n\\nCheck your OPENAI_API_KEY in .env file!`;
                }
            }
        }
        else {
            reply = `🤔 I didn't understand that. Here's what I can help with:\\n\\n` +
                   `• Type "register me" to get started\\n` +
                   `• "I attended [subjects] today" to report attendance\\n` +
                   `• "summary" to see your attendance stats\\n` +
                   `• "help" for more commands\\n\\n` +
                   `Example: "I attended Math and Physics today"`;
        }
        
        console.log('🤖 Bot reply:', reply);
        res.json({ reply });
    } catch (error) {
        console.error('❌ Error processing message:', error);
        res.status(500).json({ 
            reply: '❌ Sorry, I encountered an error. Please try again!' 
        });
    }
});

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
    console.log('🎉 SUCCESS! Your bot is running!');
    console.log('============================');
    console.log('🌐 Open your browser and visit:');
    console.log(`   👉 http://localhost:${PORT}/test`);
    console.log('');
    console.log('💡 Try these commands in the chat:');
    console.log('   • "register me"');
    console.log('   • "I attended Math and Physics today"');
    console.log('   • "attendance summary"');
    console.log('');
});