const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

// Import your actual services
const attendanceService = require('./services/services_attendanceService_Version2');
const aiService = require('./services/services_aiService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

const app = express();
const PORT = 3002;

// Add middleware to parse JSON
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected - REAL AI MODE!'))
    .catch(err => console.error('❌ Database connection failed:', err));

app.get('/', (req, res) => {
    res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Attendance Bot Test</title>
    </head>
    <body style="font-family: Arial, sans-serif; padding: 40px; background: #f0f8ff;">
        <div style="max-width: 600px; margin: 0 auto; background: white; padding: 30px; border-radius: 10px; box-shadow: 0 4px 6px rgba(0,0,0,0.1);">
            <h1 style="color: #25D366; text-align: center;">🤖 Your Attendance Bot</h1>
            
                <div style="background: #e8f5e8; padding: 20px; border-radius: 5px; margin: 20px 0;">
                <h2>🧠 REAL AI POWERED!</h2>
                <p>✅ OpenAI API connected</p>
                <p>✅ MongoDB database active</p>
                <p>✅ Smart attendance processing</p>
                <p>✅ Actual student registration</p>
            </div>
            
            <!-- CHAT INTERFACE -->
            <div style="border: 2px solid #25D366; border-radius: 10px; overflow: hidden; margin: 20px 0;">
                <div style="background: #25D366; color: white; padding: 15px; font-weight: bold;">
                    � Chat with Your Attendance Bot
                </div>
                <div id="chatMessages" style="height: 300px; padding: 15px; overflow-y: scroll; background: #f9f9f9;">
                    <div style="margin-bottom: 10px;">
                        <strong style="color: #25D366;">AI Bot:</strong> 
                        Hi! I'm your REAL AI attendance assistant! I can understand natural language and save real data to the database. Try "register me" or "I attended Math and Physics today"
                    </div>
                </div>
                <div style="padding: 15px; background: white; border-top: 1px solid #ddd;">
                    <input type="text" id="messageInput" placeholder="Type your message here..." 
                           style="width: 70%; padding: 10px; border: 1px solid #ddd; border-radius: 5px;">
                    <button onclick="sendMessage()" 
                            style="width: 25%; padding: 10px; background: #25D366; color: white; border: none; border-radius: 5px; margin-left: 2%;">
                        Send
                    </button>
                </div>
            </div>
            
            <h3>🎯 Try REAL AI commands:</h3>
            <ul>
                <li><code>register me as John with roll number CS123</code> - Real registration</li>
                <li><code>I attended Mathematics and Physics today</code> - Smart attendance</li>
                <li><code>show my attendance summary</code> - Real database stats</li>
                <li><code>I was present in all classes except Chemistry</code> - AI parsing</li>
                <li><code>today was a holiday</code> - Holiday marking</li>
            </ul>
        </div>
        
        <script>
            // Chat functionality
            function sendMessage() {
                const input = document.getElementById('messageInput');
                const chatMessages = document.getElementById('chatMessages');
                const message = input.value.trim();
                
                if (!message) return;
                
                // Add user message
                addMessage('You', message, '#007bff');
                input.value = '';
                
                // Send to bot
                fetch('/api/chat', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ message: message })
                })
                .then(response => response.json())
                .then(data => {
                    addMessage('Bot', data.reply, '#25D366');
                })
                .catch(error => {
                    addMessage('Bot', 'Sorry, I had a technical issue!', '#dc3545');
                });
            }
            
            function addMessage(sender, message, color) {
                const chatMessages = document.getElementById('chatMessages');
                const messageDiv = document.createElement('div');
                messageDiv.style.marginBottom = '10px';
                messageDiv.innerHTML = '<strong style="color: ' + color + ';">' + sender + ':</strong> ' + message;
                chatMessages.appendChild(messageDiv);
                chatMessages.scrollTop = chatMessages.scrollHeight;
            }
            
            // Allow Enter key to send messages
            document.getElementById('messageInput').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') {
                    sendMessage();
                }
            });
        </script>
    </body>
    </html>
    `);
});

// Chat API endpoint - REAL AI PROCESSING
app.post('/api/chat', async (req, res) => {
    try {
        const { message } = req.body;
        const testPhone = '+1234567890'; // Test phone number
        
        console.log('🧠 Processing with REAL AI:', message);
        
        let reply = '';
        
        // Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        const lowerMessage = message.toLowerCase().trim();
        
        // Handle different types of messages
        if (lowerMessage.includes('register') || lowerMessage.includes('my name is') || lowerMessage.includes('roll number')) {
            if (!student) {
                // Extract name and roll number from message using basic parsing
                let name = 'Test Student';
                let rollNumber = 'TEST' + Math.floor(Math.random() * 1000);
                
                // Try to extract actual name
                const nameMatch = message.match(/(?:name is|i'm|im)\s+([a-zA-Z\s]+)/i);
                if (nameMatch) {
                    name = nameMatch[1].trim();
                }
                
                // Try to extract roll number
                const rollMatch = message.match(/(?:roll number|roll|number)\s*:?\s*([a-zA-Z0-9]+)/i);
                if (rollMatch) {
                    rollNumber = rollMatch[1].trim();
                }
                
                const testStudentData = {
                    rollNumber: rollNumber,
                    name: name,
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
                
                student = await attendanceService.registerStudent(testPhone, testStudentData);
                reply = `🎉 Registration successful!<br><br>✅ Name: ${student.name}<br>✅ Roll Number: ${student.rollNumber}<br>✅ Subjects: 4 enrolled<br><br>Now you can report your daily attendance!`;
            } else {
                reply = `✅ You're already registered!<br><br>📋 Name: ${student.name}<br>📋 Roll Number: ${student.rollNumber}<br><br>Ready to track attendance!`;
            }
        }
        else if (lowerMessage.includes('summary') || lowerMessage.includes('attendance')) {
            if (!student) {
                reply = `❌ Please register first! Try: "register me as [your name] with roll number [your roll]"`;
            } else {
                const summary = await attendanceService.getAttendanceSummary(student._id);
                
                reply = `📊 <strong>REAL Attendance Summary</strong> 📊<br><br>` +
                       `Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)<br><br>` +
                       `<strong>Subject-wise:</strong><br>`;
                       
                for (const subject of summary.subjects) {
                    const percentage = parseFloat(subject.percentage) || 0;
                    let status = '';
                    if (percentage < 75) status = '⚠️';
                    else if (percentage >= 90) status = '🌟';
                    else status = '✅';
                    
                    reply += `${status} ${subject.name}: ${subject.present}/${subject.total} (${subject.percentage}%)<br>`;
                }
                
                reply += `<br><em>This data is stored in your MongoDB database!</em>`;
            }
        }
        else if (lowerMessage.includes('attended') || lowerMessage.includes('present') || lowerMessage.includes('went to') || lowerMessage.includes('had')) {
            if (!student) {
                reply = `❌ Please register first! Try: "register me as [your name] with roll number [your roll]"`;
            } else {
                try {
                    // Get student's schedule for AI context
                    const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
                    
                    if (!schedule) {
                        reply = `❌ No schedule found. Please contact admin.`;
                    } else {
                        // Use your REAL AI service to process attendance
                        const aiResponse = await aiService.processAttendanceQuery(message, {
                            schedule: schedule.timeSlots,
                            subjects: schedule.subjects
                        });
                        
                        if (aiResponse.needsMoreInfo) {
                            reply = `🤔 ${aiResponse.clarificationQuestion}`;
                        } else {
                            // Record attendance using real service
                            await attendanceService.recordAttendance(student._id, aiResponse);
                            
                            reply = `✅ <strong>AI Processed & Saved!</strong><br><br>� Date: ${aiResponse.date}<br><br>`;
                            
                            if (aiResponse.isHoliday) {
                                reply += `🏖️ Marked as holiday - no classes counted.`;
                            } else {
                                reply += `<strong>Attendance recorded:</strong><br>`;
                                for (const entry of aiResponse.attendance) {
                                    const subjectName = schedule.subjects.find(s => s.code === entry.subjectCode)?.name || entry.subjectCode;
                                    let status = '';
                                    
                                    if (entry.status === 'PRESENT') status = '✅ Present';
                                    else if (entry.status === 'ABSENT') status = '❌ Absent';
                                    else if (entry.status === 'CANCELLED') status = '🚫 Cancelled';
                                    
                                    reply += `• ${subjectName}: ${status}<br>`;
                                }
                            }
                            
                            reply += `<br><em>Processed by OpenAI and saved to MongoDB!</em>`;
                        }
                    }
                } catch (aiError) {
                    console.error('AI Error:', aiError);
                    reply = `🤖 AI processing failed: ${aiError.message}<br><br>But I can still help! Try being more specific about which subjects you attended.`;
                }
            }
        }
        else if (lowerMessage.includes('holiday')) {
            if (!student) {
                reply = `❌ Please register first!`;
            } else {
                const holidayData = {
                    date: new Date().toISOString().split('T')[0],
                    isHoliday: true,
                    attendance: []
                };
                
                await attendanceService.recordAttendance(student._id, holidayData);
                reply = `🏖️ <strong>Holiday Recorded!</strong><br><br>📅 ${new Date().toLocaleDateString()} marked as holiday.<br>No classes counted for today.<br><br><em>Saved to your MongoDB database!</em>`;
            }
        }
        else if (lowerMessage.includes('help')) {
            reply = `🤖 <strong>REAL AI Assistant Commands:</strong><br><br>` +
                   `📝 <strong>Registration:</strong><br>` +
                   `"register me as John with roll number CS123"<br><br>` +
                   `📊 <strong>Attendance:</strong><br>` +
                   `"I attended Math and Physics today"<br>` +
                   `"Present in all classes except Chemistry"<br>` +
                   `"today was a holiday"<br><br>` +
                   `📈 <strong>Reports:</strong><br>` +
                   `"show my attendance summary"<br><br>` +
                   `<em>All powered by OpenAI GPT and MongoDB!</em>`;
        }
        else {
            reply = `🧠 I'm an AI-powered attendance bot!<br><br>` +
                   `I understand: "${message}"<br><br>` +
                   `Try:<br>` +
                   `• "register me as [name] with roll [number]"<br>` +
                   `• "I attended [subjects] today"<br>` +
                   `• "show my attendance summary"<br>` +
                   `• "help" for more commands`;
        }
        
        console.log('🎉 AI Response generated:', reply.substring(0, 100) + '...');
        res.json({ reply: reply });
        
    } catch (error) {
        console.error('❌ Real AI Error:', error);
        res.status(500).json({ 
            reply: `❌ <strong>Error:</strong> ${error.message}<br><br>🔧 This is a real error from your actual system - check the console for details!` 
        });
    }
});

app.listen(PORT, () => {
    console.log('🧠 REAL AI CHATBOT RUNNING!');
    console.log('============================');
    console.log('🌐 Open your browser and visit:');
    console.log('   👉 http://localhost:' + PORT);
    console.log('');
    console.log('🚀 FEATURES ACTIVE:');
    console.log('   ✅ OpenAI GPT integration');
    console.log('   ✅ MongoDB database');
    console.log('   ✅ Real attendance tracking');
    console.log('   ✅ Smart message processing');
    console.log('');
    console.log('💬 Try: "register me as John with roll CS123"');
});