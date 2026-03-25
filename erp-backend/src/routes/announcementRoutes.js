const express = require('express');
const router = express.Router({ mergeParams: true }); // Merge params to access courseId from parent router if needed, though here we define it directly
const userCheck = require('../middlewares/auth');
const googleAuth = require('../middlewares/googleAuth');
const announceCtrl = require('../controllers/announcementController');

router.use(userCheck.verifyToken);
router.use(googleAuth.attachGoogleClient);

// Anyone in the course can view announcements
router.get('/:courseId/announce', userCheck.requireRole(['teacher', 'student']), announceCtrl.listAnnouncements);

// Only teachers can post announcements (Google Classroom API requires course owner/teacher role)
router.post('/:courseId/announce', userCheck.requireRole(['teacher']), announceCtrl.createAnnouncement);

module.exports = router;
