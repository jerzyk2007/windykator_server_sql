const express = require("express");
const router = express.Router();
const insurance = require("../../controllers/insuranceController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-data-table/:id_user/:info/:profile")
  .get(
    verifyRoles(ROLES_LIST.Insurance, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.getDataTable
  );

router
  .route("/get-single-document/:docID")
  .get(
    verifyRoles(ROLES_LIST.Insurance, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.getSingleDocument
  );

router
  .route("/change-single-document")
  .patch(
    verifyRoles(ROLES_LIST.Insurance, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.changeSingleDocument
  );

router
  .route("/insert-new-document")
  .post(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.insertNewDocuments
  );

router
  .route("/get-available-dep-comp")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.getDepsComp
  );

router
  .route("/get-insurance-nr")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    insurance.getInsuranceNr
  );

router
  .route("/edit-document")
  .post(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    insurance.editSingleDocument
  );

module.exports = router;
