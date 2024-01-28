const express = require('express');
const router = express.Router();
const settings = require('../../controllers/settingsController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.route('/change-roles/:_id')
    .patch(verifyRoles(ROLES_LIST.Admin), settings.changeRoles);

router.route('/get-settings')
    .get(verifyRoles(ROLES_LIST.Admin), settings.getSettings);

module.exports = router;