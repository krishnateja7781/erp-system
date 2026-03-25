const express = require('express');
const router = express.Router();
const userCheck = require('../middlewares/auth');
const googleAuth = require('../middlewares/googleAuth');
const assignmentCtrl = require('../controllers/assignmentController');

router.use(userCheck.verifyToken);
router.use(googleAuth.attachGoogleClient);

// View assignments
router.get('/:courseId/assignments', userCheck.requireRole(['teacher', 'student']), assignmentCtrl.listAssignments);

// Create assignment (Teacher Only)
router.post('/:courseId/assignment', userCheck.requireRole(['teacher']), assignmentCtrl.createAssignment);

module.exports = router;
