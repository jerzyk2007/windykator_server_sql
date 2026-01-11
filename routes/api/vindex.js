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

module.exports = router;
