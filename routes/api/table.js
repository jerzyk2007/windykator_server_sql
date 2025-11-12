const express = require("express");
const router = express.Router();
const table = require("../../controllers/tableController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/change-table-columns")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    table.changeTableColumns
  );
router
  .route("/delete-table-columns/:id")
  .delete(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.SuperAdmin),
    table.deleteTableColumn
  );

router
  .route("/get-table-columns")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.SuperAdmin),
    table.getTableColumns
  );

module.exports = router;
