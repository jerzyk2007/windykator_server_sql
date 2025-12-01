const express = require("express");
const router = express.Router();
const documents = require("../../controllers/documentsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// pobiera wszytskie faktury wg uprawnień oraz actula/archive/all
// router
//   .route("/get-all/:id_user/:info")
//   .get(
//     verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
//     documents.getAllDocuments
//   );

// zmienia dane pojedyńczego dokumenty - edit row table
router
  .route("/change-single-document")
  .patch(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    documents.changeSingleDocument
  );

// pobiera możliwe działy dla danej firmy (tylko dla BL)
router
  .route("/get-available-deps/:company")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    documents.getAvailableDeps
  );

// pobiera wszytskie faktury wg uprawnień oraz actual/archive/all
router
  .route("/get-data-table/:id_user/:info/:profile")
  .get(
    verifyRoles(
      ROLES_LIST.User,
      ROLES_LIST.Editor,
      ROLES_LIST.LawPartner,
      ROLES_LIST.SuperAdmin
    ),
    documents.getDataTable
  );

// pobiera wszytskie  ustawienia tabeli
// router
//   .route("/get-settings-colums-table/:id_user/")
//   .get(
//     verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
//     documents.getSettingsColumnsTable
//   );

//pobiera pojedyńczy dokument
router
  .route("/get-single-document/:id_document")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    documents.getSingleDocument
  );

// pobiera wszytskie nazwy kolumn z dowolnego wiersza dla ustawien systemu
router
  .route("/get-columns-name")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    documents.getColumnsName
  );

// zapisuje zmiany w chat kontroli dokuemntacji
router
  .route("/change-control-chat")
  .patch(
    verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    documents.changeControlChat
  );

// pobieram dane z chata kontroli dokumentacji
router
  .route("/get-control-document/:doc_nr")
  .get(
    verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    documents.getDataDocumentsControl
  );

// zapisuje zmiany w  kontroli dokuemntu
router
  .route("/change-document-control")
  .patch(
    verifyRoles(ROLES_LIST.Controller, ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    documents.changeDocumentControl
  );

module.exports = router;
