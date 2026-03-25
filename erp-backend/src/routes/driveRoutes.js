const express = require('express');
const router = express.Router();
const userCheck = require('../middlewares/auth');
const googleAuth = require('../middlewares/googleAuth');
const upload = require('../middlewares/upload');
const driveCtrl = require('../controllers/driveController');

// All Drive endpoints require ERP login + Google account connection
router.use(userCheck.verifyToken);
router.use(googleAuth.attachGoogleClient);

// Upload a file to Google Drive (any authenticated user)
router.post('/upload', upload.single('file'), driveCtrl.uploadToDrive);

// Get file info / download link
router.get('/file/:fileId', driveCtrl.getFileInfo);

module.exports = router;
