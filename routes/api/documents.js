const express = require("express");
const router = express.Router();
const multer = require("multer");
const Documents = require("../../controllers/documentsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
const upload = multer({ storage: storage });

// pobiera wszytskie faktury wg uprawnień oraz actula/archive/all
router
  .route("/get-all/:_id/:info")
  .get(verifyRoles(ROLES_LIST.User), Documents.getAllDocuments);

router
  .route("/change-single-document/:_id")
  .patch(verifyRoles(ROLES_LIST.User), Documents.changeSingleDocument);

// router
//   .route("/get-columns")
//   .get(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.AdminBL), Documents.getColumns);

router
  .route("/send-documents/:type")
  .post(
    verifyRoles(ROLES_LIST.EditorPlus, ROLES_LIST.Admin, ROLES_LIST.AdminBL),
    upload.single("excelFile"),
    Documents.documentsFromFile
  );

// pobiera wszytskie faktury wg uprawnień oraz actula/archive/all oraz ustawienia tabeli
router
  .route("/get-data-table/:_id/:info")
  .get(verifyRoles(ROLES_LIST.User), Documents.getDataTable);

//pobiera pojedyńczy dokument
router
  .route("/get-single-document/:_id")
  .get(verifyRoles(ROLES_LIST.User), Documents.getSingleDocument);

module.exports = router;
