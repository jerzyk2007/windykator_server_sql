const express = require("express");
const router = express.Router();
const multer = require("multer");
const FKRaport = require("../../controllers/fkRaportController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

router
  .route("/send-documents")
  .post(
    verifyRoles(ROLES_LIST.FK),
    upload.single("excelFile"),
    FKRaport.documentsFromFile
  );

router.route("/get-data").get(verifyRoles(ROLES_LIST.FK), FKRaport.getData);

module.exports = router;
