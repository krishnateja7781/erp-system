const mongoose = require('mongoose');

const enrollmentSchema = new mongoose.Schema({
    erpUserId: { type: String, required: true }, // Maps to User id with role="student"
    googleCourseId: { type: String, required: true }
}, { timestamps: true });

// Ensure a student is only enrolled once per course
enrollmentSchema.index({ erpUserId: 1, googleCourseId: 1 }, { unique: true });

module.exports = mongoose.model('Enrollment', enrollmentSchema);
