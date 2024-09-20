const express = require("express");
const router = express.Router();
const raports = require("../../controllers/raportsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-data/:id_user")
  .get(verifyRoles(ROLES_LIST.User), raports.getDataRaport);

module.exports = router;
