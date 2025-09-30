const mongoose = require('mongoose');

const SubjectSchema = new mongoose.Schema({
  code: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  totalClasses: {
    type: Number,
    default: 0
  }
});

const TimeSlotSchema = new mongoose.Schema({
  day: {
    type: String,
    enum: ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'],
    required: true
  },
  startTime: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject',
    required: true
  }
});

const ScheduleSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Student',
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  subjects: [SubjectSchema],
  timeSlots: [TimeSlotSchema],
  createdAt: {
    type: Date,
    default: Date.now
  }
});

const Subject = mongoose.model('Subject', SubjectSchema);
const Schedule = mongoose.model('Schedule', ScheduleSchema);

module.exports = { Subject, Schedule };