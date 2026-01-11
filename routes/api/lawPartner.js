const express = require("express");
const router = express.Router();
const lawPartner = require("../../controllers/lawPartnerController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-contractor-data/:docID")
  .get(
    verifyRoles(ROLES_LIST.LawPartner, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    lawPartner.getContractor
  );

router
  .route("/get-single-document/:docID")
  .get(
    verifyRoles(ROLES_LIST.LawPartner, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    lawPartner.getSingleDocument
  );

router
  .route("/change-single-document")
  .patch(
    verifyRoles(ROLES_LIST.LawPartner, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    lawPartner.changeSingleDocument
  );

router
  .route("/accept-document")
  .patch(
    verifyRoles(ROLES_LIST.LawPartner, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    lawPartner.acceptDocument
  );

router
  .route("/get-data-table/:id_user/:info/:profile")
  .get(
    verifyRoles(ROLES_LIST.LawPartner, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    lawPartner.getDataTable
  );

module.exports = router;
