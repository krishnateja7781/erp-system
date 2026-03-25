const express = require('express');
const router = express.Router();
const userCheck = require('../middlewares/auth');
const googleAuth = require('../middlewares/googleAuth');
const submissionCtrl = require('../controllers/submissionController');

router.use(userCheck.verifyToken);
router.use(googleAuth.attachGoogleClient);

// Submit assignment (Student Only)
router.post('/:courseId/assignment/:assignmentId/submit', userCheck.requireRole(['student']), submissionCtrl.submitAssignment);

// View submissions (Teacher Only)
router.get('/:courseId/assignment/:assignmentId/submissions', userCheck.requireRole(['teacher']), submissionCtrl.listSubmissions);

module.exports = router;
