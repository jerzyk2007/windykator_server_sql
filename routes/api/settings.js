const express = require('express');
const router = express.Router();
const Settings = require('../../controllers/settingsController');

router.route('/saveSettings')
    .post(Settings.saveSettings);

router.route('/getSettings')
    .get(Settings.getSettings);

router.route('/table')
    .post(Settings.saveTableSettings);

module.exports = router;