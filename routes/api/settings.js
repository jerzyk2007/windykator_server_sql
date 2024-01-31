const express = require('express');
const router = express.Router();
const settings = require('../../controllers/settingsController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.route('/change-columns')
    .patch(verifyRoles(ROLES_LIST.Admin), settings.changeColumns);

router.route('/get-settings')
    .get(verifyRoles(ROLES_LIST.Admin), settings.getSettings);

router.route('/get-columns')
    .get(verifyRoles(ROLES_LIST.Admin), settings.getColumns);

module.exports = router;