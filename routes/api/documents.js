const express = require('express');
const router = express.Router();
const Documents = require('../../controllers/documentsController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router.route('/:info')
    .get(verifyRoles(ROLES_LIST.User), Documents.getAllDocuments);


module.exports = router;