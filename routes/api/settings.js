const express = require("express");
const router = express.Router();
const settings = require("../../controllers/settingsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/change-table-columns")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.changeTableColumns
  );
router
  .route("/delete-table-columns/:id")
  .delete(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.deleteTableColumn
  );

router
  .route("/get-settings")
  .get(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.getSettings
  );

router
  .route("/save-target-percent")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.saveTargetPercent
  );

router
  .route("/get-departments")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    settings.getDepartments
  );

router
  .route("/get-table-columns")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    settings.getTableColumns
  );

router
  .route("/get-permissions")
  .get(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    settings.getPermissions
  );

module.exports = router;
