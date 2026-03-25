const { google } = require('googleapis');
const Classroom = require('../models/Classroom');
const Enrollment = require('../models/Enrollment');

// Course Creation (Teacher Only)
exports.createClassroom = async (req, res, next) => {
    try {
        const { name, section, descriptionHeading, erpClassId } = req.body;

        if (!name || !erpClassId) {
            return res.status(400).json({ error: 'Missing course name or erpClassId' });
        }

        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        // 1. Create Google Classroom in PROVISIONED state (works for all account types)
        const response = await classroomAPI.courses.create({
            requestBody: {
                name,
                section,
                descriptionHeading,
                ownerId: 'me',
                courseState: 'PROVISIONED'
            }
        });

        const googleCourse = response.data;

        // 2. Try to activate the course (only succeeds for Workspace for Education accounts)
        try {
            const activated = await classroomAPI.courses.patch({
                id: googleCourse.id,
                updateMask: 'courseState',
                requestBody: { courseState: 'ACTIVE' }
            });
            Object.assign(googleCourse, activated.data);
        } catch {
            // Non-Workspace accounts stay PROVISIONED — still fully usable
        }

        // 3. Save Mapping in ERP DB
        const classroom = await Classroom.create({
            erpClassId: erpClassId,
            googleCourseId: googleCourse.id,
            enrollmentCode: googleCourse.enrollmentCode,
            teacherId: req.user.id
        });

        res.status(201).json({ success: true, classroom });
    } catch (error) {
        next(error);
    }
};

// Course Join (Student Only)
exports.joinClassroom = async (req, res, next) => {
    try {
        const { enrollmentCode } = req.body;

        if (!enrollmentCode) {
            return res.status(400).json({ error: 'Missing enrollment code' });
        }

        // Find course ID using the code from our DB
        const classroom = await Classroom.findOne({ enrollmentCode });
        if (!classroom) return res.status(404).json({ error: 'Course not found in ERP records' });

        // Prevent joining multiple times silently or erroring
        const existingEnrollment = await Enrollment.findOne({ erpUserId: req.user.id, googleCourseId: classroom.googleCourseId });
        if (existingEnrollment) {
            return res.status(400).json({ error: 'You are already enrolled in this classroom' });
        }

        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        // Students join by creating a student resource in the course
        await classroomAPI.courses.students.create({
            courseId: classroom.googleCourseId,
            enrollmentCode: enrollmentCode,
            requestBody: { userId: 'me' }
        });

        // Track enrollment
        await Enrollment.create({ erpUserId: req.user.id, googleCourseId: classroom.googleCourseId });

        res.status(200).json({ success: true, message: 'Joined classroom successfully', googleCourseId: classroom.googleCourseId });
    } catch (error) {
        next(error);
    }
};

// List Courses (Both Student and Teacher)
exports.listClassrooms = async (req, res, next) => {
    try {
        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        // Fetch from Google
        const response = await classroomAPI.courses.list({
            studentId: req.user.role === 'student' ? 'me' : undefined,
            teacherId: req.user.role === 'teacher' ? 'me' : undefined,
            courseStates: ['ACTIVE', 'PROVISIONED']
        });

        res.status(200).json({ courses: response.data.courses || [] });
    } catch (error) {
        next(error);
    }
};

// Get specific Course details
exports.getClassroom = async (req, res, next) => {
    try {
        const { id: courseId } = req.params;
        const classroomAPI = google.classroom({ version: 'v1', auth: req.googleClient });

        const response = await classroomAPI.courses.get({ id: courseId });
        res.status(200).json({ course: response.data });
    } catch (error) {
        next(error);
    }
};
