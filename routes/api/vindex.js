const express = require("express");
const router = express.Router();
const vindex = require("../../controllers/vindexController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-data-table/:id_user/:info/:profile")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    vindex.getDataTable
  );

router
  .route("/get-single-document/:docID")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    vindex.getSingleDocument
  );

router
  .route("/change-single-document")
  .patch(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    vindex.changeSingleDocument
  );

// pobiera plik pdf wygenerowany w node
router
  .route("/get-letter")
  .get(verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin), vindex.getLetter);

module.exports = router;
