const express = require('express');
const router = express.Router();
const resetPasswordController = require('../controllers/resetPasswordController');

router.post('/', resetPasswordController.newConfirmPass);
router.post('/verify-pass', resetPasswordController.verifyPass);
router.patch('/change-pass', resetPasswordController.changePass);

module.exports = router;