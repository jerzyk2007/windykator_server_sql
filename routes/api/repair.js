const express = require('express');
const router = express.Router();
const Repair = require('../../controllers/repairDataController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
    .route('/advisers-name')
    .get(verifyRoles(ROLES_LIST.Admin), Repair.repairAdvisersName);
router
    .route('/get-accounts-data')
    .get(verifyRoles(ROLES_LIST.Admin), Repair.createAccounts);


module.exports = router;