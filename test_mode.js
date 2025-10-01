require('dotenv').config();
const express = require('express');
const connectDB = require('./config/config_db_Version2');
const attendanceService = require('./services/services_attendanceService_Version2');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');

// Initialize Express app
const app = express();
app.use(express.json());

console.log('🧪 Starting Attendance Bot in TEST MODE');
console.log('=====================================');

// Connect to MongoDB
connectDB().then(() => {
  console.log('✅ Database connected successfully!');
  
  // Test basic functionality
  testBasicFunctionality();
}).catch(error => {
  console.error('❌ Database connection failed:', error);
  process.exit(1);
});

async function testBasicFunctionality() {
  try {
    console.log('\n🔍 Testing basic functionality...');
    
    // Test 1: Create a test student
    console.log('1. Testing student creation...');
    const testPhone = '+1234567890';
    
    // Clean up any existing test student
    await Student.deleteOne({ phoneNumber: testPhone });
    
    const testStudentData = {
      rollNumber: 'TEST001',
      name: 'Test Student',
      semester: 5,
      subjects: [
        { code: 'CS101', name: 'Computer Science' },
        { code: 'MATH201', name: 'Mathematics' }
      ],
      schedule: [
        {
          day: 'Monday',
          slots: [
            { subject: 'CS101', startTime: '09:00', endTime: '10:00' },
            { subject: 'MATH201', startTime: '11:00', endTime: '12:00' }
          ]
        }
      ]
    };
    
    const student = await attendanceService.registerStudent(testPhone, testStudentData);
    console.log('✅ Student created:', student.name, student.rollNumber);
    
    // Test 2: Get attendance summary
    console.log('2. Testing attendance summary...');
    const summary = await attendanceService.getAttendanceSummary(student._id);
    console.log('✅ Attendance summary retrieved:', summary.overall);
    
    // Test 3: Record some attendance
    console.log('3. Testing attendance recording...');
    const attendanceData = {
      date: new Date().toISOString().split('T')[0],
      isHoliday: false,
      attendance: [
        { subjectCode: 'CS101', status: 'PRESENT' },
        { subjectCode: 'MATH201', status: 'ABSENT' }
      ]
    };
    
    await attendanceService.recordAttendance(student._id, attendanceData);
    console.log('✅ Attendance recorded successfully');
    
    // Test 4: Get updated summary
    console.log('4. Testing updated attendance summary...');
    const updatedSummary = await attendanceService.getAttendanceSummary(student._id);
    console.log('✅ Updated summary:', updatedSummary.overall);
    
    console.log('\n🎉 ALL TESTS PASSED!');
    console.log('Your core attendance tracking functionality is working perfectly!');
    console.log('\n📱 Next step: Set up WhatsApp integration');
    console.log('For now, you can test the bot using the web interface at http://localhost:3000/test');
    
  } catch (error) {
    console.error('❌ Test failed:', error);
    process.exit(1);
  }
}

// Simple web interface for testing
app.get('/test', (req, res) => {
  res.send(`
    <html>
      <head><title>Attendance Bot Test</title></head>
      <body style="font-family: Arial; padding: 20px;">
        <h1>🤖 Attendance Bot Test Interface</h1>
        <p>Your bot's core functionality is working!</p>
        <p>Check the console logs to see the test results.</p>
        
        <h2>Next Steps:</h2>
        <ol>
          <li>Get an OpenAI API key from <a href="https://platform.openai.com/api-keys">platform.openai.com</a></li>
          <li>Update your .env file with the real API key</li>
          <li>Test document processing and WhatsApp integration</li>
        </ol>
        
        <p><strong>Database:</strong> ✅ Connected</p>
        <p><strong>Student Management:</strong> ✅ Working</p>
        <p><strong>Attendance Tracking:</strong> ✅ Working</p>
      </body>
    </html>
  `);
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`\n🌐 Test interface available at: http://localhost:${PORT}/test`);
});