const express = require("express");
const router = express.Router();
const table = require("../../controllers/tableController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/change-table-columns")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    table.changeTableColumns
  );
router
  .route("/delete-table-columns/:id/:permission")
  .delete(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    table.deleteTableColumn
  );

router
  .route("/get-table-columns")
  .get(
    verifyRoles(
      ROLES_LIST.User,
      ROLES_LIST.Editor,
      ROLES_LIST.DNiKN,
      ROLES_LIST.SuperAdmin
    ),
    table.getTableColumns
  );

router
  .route("/get-settings-colums-table/:id_user/:profile")
  .get(
    verifyRoles(
      ROLES_LIST.User,
      ROLES_LIST.Editor,
      ROLES_LIST.LawPartner,
      ROLES_LIST.Insurance,
      ROLES_LIST.DNiKN,
      ROLES_LIST.SuperAdmin
    ),
    table.getSettingsColumnsTable
  );

module.exports = router;
