const mongoose = require('mongoose');

const classroomSchema = new mongoose.Schema({
    erpClassId: { type: String, required: true },
    googleCourseId: { type: String, required: true, unique: true },
    enrollmentCode: { type: String },
    teacherId: { type: String, required: true } // Maps to User id with role="teacher"
}, { timestamps: true });

module.exports = mongoose.model('Classroom', classroomSchema);
