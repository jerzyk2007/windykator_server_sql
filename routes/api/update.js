const express = require('express');
const router = express.Router();
const update = require('../../controllers/updateController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");



router.route('/get-time')
    // .get(verifyRoles(ROLES_LIST.User), update.getTime);
    .get(update.getTime);

module.exports = router;