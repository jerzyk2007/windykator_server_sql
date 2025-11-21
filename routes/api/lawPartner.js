const express = require("express");
const router = express.Router();
const lawPartner = require("../../controllers/lawPartnerController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-contractor-data/:docID")
  .get(verifyRoles(ROLES_LIST.LawPartner), lawPartner.getContractor);

router
  .route("/get-single-document/:docID")
  .get(verifyRoles(ROLES_LIST.LawPartner), lawPartner.getSingleDocument);

module.exports = router;
