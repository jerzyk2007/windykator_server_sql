const express = require('express');
const router = express.Router();
const multer = require('multer');
const Documents = require('../../controllers/documentsController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

router.route('/get-all/:info')
    .get(verifyRoles(ROLES_LIST.User), Documents.getAllDocuments);

router.route('/send-documents')
    .post(verifyRoles(ROLES_LIST.Admin), upload.single('excelFile'), Documents.documentsFromFile);
module.exports = router;