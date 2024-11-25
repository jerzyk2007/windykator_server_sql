const express = require('express');
const router = express.Router();
const Repair = require('../../controllers/rapairDataController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
    .route('/laws-name')
    .get(verifyRoles(ROLES_LIST.SuperAdmin), Repair.repairKanc);


module.exports = router;