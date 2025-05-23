const express = require("express");
const router = express.Router();
const multer = require("multer");
const Documents = require("../../controllers/documentsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// const storage = multer.memoryStorage(); // Przechowuje plik w buforze pamięci
// const upload = multer({ storage: storage });

// pobiera wszytskie faktury wg uprawnień oraz actula/archive/all
router
  .route("/get-all/:id_user/:info")
  .get(verifyRoles(ROLES_LIST.User), Documents.getAllDocuments);

// zmienia dane pojedyńczego dokumenty - edit row table
router
  .route("/change-single-document")
  .patch(verifyRoles(ROLES_LIST.User), Documents.changeSingleDocument);

// pobiera wszytskie faktury wg uprawnień oraz actula/archive/all 
router
  .route("/get-data-table/:id_user/:info")
  .get(verifyRoles(ROLES_LIST.User), Documents.getDataTable);

// pobiera wszytskie  ustawienia tabeli
router
  .route("/get-settings-colums-table/:id_user/")
  .get(verifyRoles(ROLES_LIST.User), Documents.getSettingsColumnsTable);

//pobiera pojedyńczy dokument
router
  .route("/get-single-document/:id_document")
  .get(verifyRoles(ROLES_LIST.User), Documents.getSingleDocument);

// pobiera wszytskie nazwy kolumn z dowolnego wiersza dla ustawien systemu
router
  .route("/get-columns-name")
  .get(verifyRoles(ROLES_LIST.User), Documents.getColumnsName);

// pobiera dane dla danych Kredytu Kupieckiego
// router
//   .route("/get-data-credit-trade")
//   .get(verifyRoles(ROLES_LIST.User), Documents.getTradeCreditData);

// zapisuje zmiany w chat kontroli dokuemntacji
router
  .route("/change-control-chat")
  .patch(verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin), Documents.changeControlChat);

// pobieram dane z chata kontroli dokumentacji
router
  .route("/get-control-document/:doc_nr")
  .get(verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin), Documents.getDataDocumentsControl);

// zapisuje zmiany w  kontroli dokuemntu
router
  .route("/change-document-control")
  .patch(verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin), Documents.changeDocumentControl);

module.exports = router;
