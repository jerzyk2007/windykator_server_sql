const express = require('express');
const router = express.Router();
const Repair = require('../../controllers/repairDataController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
    .route('/laws-name')
    .get(verifyRoles(ROLES_LIST.SuperAdmin), Repair.repairKanc);
router
    .route('/advisers-name')
    .get(verifyRoles(ROLES_LIST.SuperAdmin), Repair.repairAdvisersName);


module.exports = router;