const express = require('express');
const router = express.Router();
const userCheck = require('../middlewares/auth');
const googleAuth = require('../middlewares/googleAuth');
const classroomCtrl = require('../controllers/classroomController');

// All endpoints require ERP login + Google account connection
router.use(userCheck.verifyToken);
router.use(googleAuth.attachGoogleClient);

router.post('/create', userCheck.requireRole(['teacher', 'admin']), classroomCtrl.createClassroom);
router.post('/join', userCheck.requireRole(['student']), classroomCtrl.joinClassroom);
router.get('/list', userCheck.requireRole(['teacher', 'student']), classroomCtrl.listClassrooms);
router.get('/:id', userCheck.requireRole(['teacher', 'student']), classroomCtrl.getClassroom);

module.exports = router;
