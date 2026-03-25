const express = require('express');
const router = express.Router();
const authCtrl = require('../controllers/authController');
const check = require('../middlewares/auth');

// Issue JWT for ERP users (no auth required - called from ERP server actions)
router.post('/issue-token', authCtrl.issueToken);

// OAuth initiation – requires ERP JWT to identify the user
router.get('/auth', check.verifyToken, authCtrl.googleAuth);

// OAuth callback – no token needed (state param carries user ID)
router.get('/callback', authCtrl.googleCallback);

// Check if Google account is linked – requires ERP JWT
router.get('/status', check.verifyToken, authCtrl.googleStatus);

module.exports = router;
