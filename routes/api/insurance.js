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

module.exports = router;
