const express = require('express');
const router = express.Router();
const formCtrl = require('../controllers/formController');
const check = require('../middlewares/auth');

router.get('/', check.verifyToken, formCtrl.getForms);
router.post('/create', check.verifyToken, formCtrl.createForm);
router.get('/:formId/responses', check.verifyToken, formCtrl.getResponses);
router.delete('/disconnect', check.verifyToken, formCtrl.disconnectGoogle);

module.exports = router;
