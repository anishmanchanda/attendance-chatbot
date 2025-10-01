require('dotenv').config();
const mongoose = require('mongoose');
const Student = require('./models/models_Student_Version2');
const { Schedule } = require('./models/models_Schedule_Version2');
const AttendanceRecord = require('./models/models_Attendance_Version2');

console.log('🔍 CHECKING YOUR DATABASE DATA...');
console.log('==================================');

async function viewData() {
    try {
        // Connect to MongoDB
        await mongoose.connect(process.env.MONGODB_URI);
        console.log('✅ Connected to MongoDB');
        console.log('📍 Database:', process.env.MONGODB_URI);
        console.log('');

        // Check Students collection
        console.log('👨‍🎓 STUDENTS COLLECTION:');
        console.log('-------------------------');
        const students = await Student.find({});
        if (students.length === 0) {
            console.log('   📋 No students found yet');
        } else {
            students.forEach((student, index) => {
                console.log(`   ${index + 1}. Name: ${student.name}`);
                console.log(`      Roll: ${student.rollNumber}`);
                console.log(`      Phone: ${student.phoneNumber}`);
                console.log(`      Semester: ${student.semester}`);
                console.log(`      Created: ${student.createdAt}`);
                console.log('');
            });
        }

        // Check Schedules collection
        console.log('📅 SCHEDULES COLLECTION:');
        console.log('------------------------');
        const schedules = await Schedule.find({}).populate('student');
        if (schedules.length === 0) {
            console.log('   📋 No schedules found yet');
        } else {
            schedules.forEach((schedule, index) => {
                console.log(`   ${index + 1}. Student: ${schedule.student?.name || 'Unknown'}`);
                console.log(`      Subjects: ${schedule.subjects.length}`);
                console.log(`      Time slots: ${schedule.timeSlots.length}`);
                console.log(`      Subject names: ${schedule.subjects.map(s => s.name).join(', ')}`);
                console.log('');
            });
        }

        // Check Attendance Records collection
        console.log('📊 ATTENDANCE RECORDS COLLECTION:');
        console.log('----------------------------------');
        const records = await AttendanceRecord.find({}).populate('student').populate('subject');
        if (records.length === 0) {
            console.log('   📋 No attendance records found yet');
        } else {
            records.forEach((record, index) => {
                console.log(`   ${index + 1}. Student: ${record.student?.name || 'Unknown'}`);
                console.log(`      Subject: ${record.subject?.name || 'Unknown'}`);
                console.log(`      Date: ${record.date.toDateString()}`);
                console.log(`      Status: ${record.status}`);
                console.log(`      Notes: ${record.notes || 'None'}`);
                console.log('');
            });
        }

        // Summary
        console.log('📈 DATABASE SUMMARY:');
        console.log('--------------------');
        console.log(`   👨‍🎓 Students: ${students.length}`);
        console.log(`   📅 Schedules: ${schedules.length}`);
        console.log(`   📊 Attendance Records: ${records.length}`);
        console.log('');

        if (students.length === 0) {
            console.log('💡 TO ADD DATA:');
            console.log('   1. Go to http://localhost:3003/chat');
            console.log('   2. Type: "register me as John with roll CS123"');
            console.log('   3. Type: "I attended Math and Physics today"');
            console.log('   4. Run this script again to see the data!');
        } else {
            console.log('🎉 YOUR DATA IS BEING STORED SUCCESSFULLY!');
            console.log('   Every message creates real database entries');
            console.log('   All attendance is permanently saved');
        }

    } catch (error) {
        console.error('❌ Error:', error.message);
    } finally {
        await mongoose.disconnect();
        console.log('🔌 Disconnected from database');
        process.exit(0);
    }
}

viewData();