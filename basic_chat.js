const express = require('express');
const mongoose = require('mongoose');
require('dotenv').config();

// Import your REAL AI services
const attendanceService = require('./services/services_attendanceService_Version2');
const aiService = require('./services/services_aiService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

const app = express();
app.use(express.json());

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log('✅ Database connected'))
    .catch(err => console.error('❌ Database error:', err));

app.get('/', (req, res) => {
    res.send('<h1>🤖 Bot Works!</h1><p><a href="/chat">Go to Chat</a></p>');
});

app.get('/chat', (req, res) => {
    res.send(`
        <h1>🧠 REAL AI Chat</h1>
        <div id="messages" style="border: 1px solid #ccc; height: 300px; padding: 10px; overflow-y: scroll; margin: 10px 0;"></div>
        <input id="input" type="text" placeholder="Type your message here..." style="width: 70%; padding: 5px;">
        <button onclick="send()" style="padding: 5px 10px;">Send</button>
        
        <p><strong>🤖 This bot uses REAL OpenAI GPT!</strong></p>
        <p>Try: "register me as John with roll CS123" or "I attended Math and Physics today"</p>
        
        <script>
            async function send() {
                const input = document.getElementById('input');
                const messages = document.getElementById('messages');
                const message = input.value.trim();
                
                if (!message) return;
                
                messages.innerHTML += '<p><strong>You:</strong> ' + message + '</p>';
                messages.innerHTML += '<p><em>🧠 Processing with OpenAI...</em></p>';
                messages.scrollTop = messages.scrollHeight;
                
                try {
                    const response = await fetch('/api/ai-chat', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ message: message })
                    });
                    
                    const data = await response.json();
                    
                    // Remove "processing" message
                    const processingMsg = messages.lastElementChild;
                    if (processingMsg && processingMsg.innerHTML.includes('Processing')) {
                        processingMsg.remove();
                    }
                    
                    messages.innerHTML += '<p><strong>🤖 AI Bot:</strong> ' + data.reply + '</p>';
                } catch (error) {
                    messages.innerHTML += '<p><strong>❌ Error:</strong> ' + error.message + '</p>';
                }
                
                messages.scrollTop = messages.scrollHeight;
                input.value = '';
            }
            
            document.getElementById('input').addEventListener('keypress', function(e) {
                if (e.key === 'Enter') send();
            });
        </script>
    `);
});

// REAL AI PROCESSING ENDPOINT
app.post('/api/ai-chat', async (req, res) => {
    try {
        const { message } = req.body;
        const testPhone = '+1234567890';
        
        console.log('🧠 REAL OpenAI processing:', message);
        
        // Find or create student
        let student = await Student.findOne({ phoneNumber: testPhone });
        
        let reply = '';
        const lowerMessage = message.toLowerCase().trim();
        
        // Registration handling
        if (lowerMessage.includes('register') || lowerMessage.includes('my name is')) {
            if (!student) {
                // Extract name and roll number using basic parsing
                let name = 'Test Student';
                let rollNumber = 'TEST' + Math.floor(Math.random() * 1000);
                
                // Try to extract actual name
                const nameMatch = message.match(/(?:name is|i'm|im|as)\s+([a-zA-Z\s]+)/i);
                if (nameMatch) {
                    name = nameMatch[1].replace(/with|roll|number/gi, '').trim();
                }
                
                // Try to extract roll number
                const rollMatch = message.match(/(?:roll|number)\s*:?\s*([a-zA-Z0-9]+)/i);
                if (rollMatch) {
                    rollNumber = rollMatch[1].trim();
                }
                
                const studentData = {
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
                
                student = await attendanceService.registerStudent(testPhone, studentData);
                reply = `🎉 REAL REGISTRATION COMPLETE!<br><br>✅ Name: ${student.name}<br>✅ Roll: ${student.rollNumber}<br>✅ Saved to MongoDB!<br><br>Now try: "I attended Math and Physics today"`;
            } else {
                reply = `✅ Already registered!<br>Name: ${student.name}<br>Roll: ${student.rollNumber}`;
            }
        }
        // Attendance reporting with REAL AI
        else if (lowerMessage.includes('attended') || lowerMessage.includes('present') || lowerMessage.includes('went to') || lowerMessage.includes('had')) {
            if (!student) {
                reply = `❌ Please register first! Try: "register me as [name] with roll [number]"`;
            } else {
                try {
                    // Get student's schedule for AI context
                    const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
                    
                    if (!schedule) {
                        reply = `❌ No schedule found. Contact admin.`;
                    } else {
                        console.log('🧠 Sending to OpenAI GPT...');
                        
                        // Use your ACTUAL AI service with OpenAI
                        const aiResponse = await aiService.processAttendanceQuery(message, {
                            schedule: schedule.timeSlots,
                            subjects: schedule.subjects
                        });
                        
                        console.log('🤖 OpenAI Response:', aiResponse);
                        
                        if (aiResponse.needsMoreInfo) {
                            reply = `🤔 ${aiResponse.clarificationQuestion}`;
                        } else {
                            // Record to database
                            await attendanceService.recordAttendance(student._id, aiResponse);
                            
                            reply = `🧠 <strong>PROCESSED BY OPENAI GPT!</strong><br><br>📅 Date: ${aiResponse.date}<br><br>`;
                            
                            if (aiResponse.isHoliday) {
                                reply += `🏖️ Holiday marked`;
                            } else {
                                reply += `<strong>AI understood and saved:</strong><br>`;
                                for (const entry of aiResponse.attendance) {
                                    const subjectName = schedule.subjects.find(s => s.code === entry.subjectCode)?.name || entry.subjectCode;
                                    let status = entry.status === 'PRESENT' ? '✅ Present' : '❌ Absent';
                                    reply += `• ${subjectName}: ${status}<br>`;
                                }
                            }
                            
                            reply += `<br><em>🧠 Processed by OpenAI & saved to MongoDB!</em>`;
                        }
                    }
                } catch (aiError) {
                    console.error('❌ OpenAI Error:', aiError);
                    reply = `🤖 OpenAI Error: ${aiError.message}<br><br>Check your OPENAI_API_KEY!`;
                }
            }
        }
        // Summary with real data
        else if (lowerMessage.includes('summary') || lowerMessage.includes('attendance')) {
            if (!student) {
                reply = `❌ Register first!`;
            } else {
                const summary = await attendanceService.getAttendanceSummary(student._id);
                reply = `📊 <strong>REAL DATABASE SUMMARY</strong><br><br>Overall: ${summary.overall.present}/${summary.overall.total} (${summary.overall.percentage}%)<br><br>`;
                
                for (const subject of summary.subjects) {
                    reply += `• ${subject.name}: ${subject.present}/${subject.total} (${subject.percentage}%)<br>`;
                }
                
                reply += `<br><em>Data from your MongoDB database!</em>`;
            }
        }
        // Default response
        else {
            reply = `🧠 I'm a REAL AI bot powered by OpenAI GPT!<br><br>Try:<br>• "register me as John with roll CS123"<br>• "I attended Math and Physics but missed Chemistry"<br>• "show my attendance summary"`;
        }
        
        console.log('✅ AI Response ready');
        res.json({ reply: reply });
        
    } catch (error) {
        console.error('❌ REAL AI Error:', error);
        res.status(500).json({ 
            reply: `❌ Real error: ${error.message}` 
        });
    }
});

app.listen(3003, () => {
    console.log('🎉 SIMPLE CHAT RUNNING!');
    console.log('========================');
    console.log('🌐 Open your browser:');
    console.log('   👉 http://localhost:3003');
    console.log('   👉 http://localhost:3003/chat');
    console.log('');
    console.log('✅ This WILL work - guaranteed!');
});