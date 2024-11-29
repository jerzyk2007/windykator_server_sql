const express = require("express");
const router = express.Router();
const multer = require("multer");
const AddData = require("../../controllers/addDataFromExcelFileController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

router
    .route("/send-documents/:type")
    .post(
        verifyRoles(ROLES_LIST.EditorPlus, ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
        upload.single("excelFile"),
        AddData.documentsFromFile
    );

module.exports = router;