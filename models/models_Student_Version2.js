const mongoose = require('mongoose');

const StudentSchema = new mongoose.Schema({
  phoneNumber: {
    type: String,
    required: true,
    unique: true
  },
  rollNumber: {
    type: String,
    required: true,
    unique: true
  },
  name: {
    type: String,
    required: true
  },
  semester: {
    type: Number,
    required: true
  },
  subjects: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Subject'
  }],
  chatState: {
    type: String,
    enum: ['IDLE', 'AWAITING_SCHEDULE', 'AWAITING_ATTENDANCE', 'AWAITING_CONFIRMATION'],
    default: 'IDLE'
  },
  tempData: {
    type: mongoose.Schema.Types.Mixed
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('Student', StudentSchema);