const express = require("express");
const router = express.Router();
const settings = require("../../controllers/settingsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/change-columns")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.changeColumns
  );

router
  .route("/get-settings")
  .get(verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin), settings.getSettings);

router
  .route("/save-target-percent")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.saveTargetPercent
  );

router
  .route("/get-departments")
  .get(verifyRoles(ROLES_LIST.User), settings.getDepartments);

router
  .route("/get-columns")
  .get(verifyRoles(ROLES_LIST.User), settings.getColumns);

module.exports = router;
