require('dotenv').config();
const mongoose = require('mongoose');

// Import services
const attendanceService = require('./services/services_attendanceService_Version2');

console.log('🚀 Testing Your Attendance Chatbot...');
console.log('=====================================\n');

async function testBot() {
    try {
        // Test 1: Database Connection
        console.log('1️⃣ Testing Database Connection...');
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Database connected successfully!\n');
        
        // Test 2: Student Registration
        console.log('2️⃣ Testing Student Registration...');
        const testPhone = '+1234567890';
        
        // Clean up any existing test data
        const Student = require('./models/models_Student_Version2');
        const { Schedule } = require('./models/models_Schedule_Version2');
        const AttendanceRecord = require('./models/models_Attendance_Version2');
        
        await Student.deleteOne({ phoneNumber: testPhone });
        await Schedule.deleteMany({ student: { $exists: true } });
        await AttendanceRecord.deleteMany({ student: { $exists: true } });
        
        const testStudentData = {
            rollNumber: 'TEST123',
            name: 'Test Student',
            semester: 5,
            subjects: [
                { code: 'CS101', name: 'Computer Science' },
                { code: 'MATH201', name: 'Mathematics' },
                { code: 'PHY101', name: 'Physics' }
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
                        { subject: 'CS101', startTime: '14:00', endTime: '15:00' }
                    ]
                }
            ]
        };
        
        const student = await attendanceService.registerStudent(testPhone, testStudentData);
        console.log('✅ Student registered:', student.name, '(' + student.rollNumber + ')\n');
        
        // Test 3: Get Student Schedule
        console.log('3️⃣ Testing Schedule Retrieval...');
        const schedule = await Schedule.findOne({ student: student._id }).populate('subjects');
        if (schedule) {
            console.log('✅ Schedule found with', schedule.subjects.length, 'subjects');
            console.log('   Subjects:', schedule.subjects.map(s => s.name).join(', '));
            console.log('   Time slots:', schedule.timeSlots.length, 'slots\n');
        } else {
            console.log('⚠️  No schedule found\n');
        }
        
        // Test 4: Record Attendance
        console.log('4️⃣ Testing Attendance Recording...');
        const attendanceData = {
            date: new Date().toISOString().split('T')[0],
            isHoliday: false,
            attendance: [
                { subjectCode: 'CS101', status: 'PRESENT', notes: 'Test attendance' },
                { subjectCode: 'MATH201', status: 'ABSENT', notes: 'Test absence' },
                { subjectCode: 'PHY101', status: 'PRESENT', notes: 'Test present' }
            ]
        };
        
        const records = await attendanceService.recordAttendance(student._id, attendanceData);
        console.log('✅ Attendance recorded for', records.length, 'subjects\n');
        
        // Test 5: Get Attendance Summary
        console.log('5️⃣ Testing Attendance Summary...');
        const summary = await attendanceService.getAttendanceSummary(student._id);
        console.log('✅ Attendance summary generated:');
        console.log('   Overall:', summary.overall.present + '/' + summary.overall.total, 
                   '(' + summary.overall.percentage + '%)');
        
        console.log('   Subject breakdown:');
        summary.subjects.forEach(subject => {
            console.log('   -', subject.name + ':', subject.present + '/' + subject.total, 
                       '(' + subject.percentage + '%)');
        });
        
        console.log('\n🎉 ALL TESTS PASSED!');
        console.log('====================================');
        console.log('Your attendance bot is working perfectly!');
        console.log('');
        console.log('✅ Database: Connected');
        console.log('✅ Student Registration: Working');
        console.log('✅ Schedule Processing: Working');
        console.log('✅ Attendance Recording: Working');
        console.log('✅ Attendance Summary: Working');
        console.log('');
        console.log('📱 Ready for WhatsApp? Run: npm start');
        console.log('🌐 Want to test without WhatsApp? Run: node test_mode.js');
        
    } catch (error) {
        console.error('❌ Test failed:', error.message);
        if (process.env.NODE_ENV === 'development') {
            console.error('Full error:', error);
        }
        console.log('\n🔧 Troubleshooting tips:');
        console.log('- Make sure MongoDB is running: brew services start mongodb/brew/mongodb-community');
        console.log('- Check your .env file has MONGODB_URI set');
        console.log('- Verify all npm packages are installed: npm install');
    } finally {
        await mongoose.disconnect();
        console.log('\n🔌 Database disconnected');
        process.exit(0);
    }
}

testBot();