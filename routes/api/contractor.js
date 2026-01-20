const express = require("express");
const router = express.Router();
const contractor = require("../../controllers/contarctorController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-contarctors-list")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    contractor.getContarctorList
  );

router
  .route("/change-data-contractor/:id")
  .patch(
    verifyRoles(
      ROLES_LIST.User,
      ROLES_LIST.Editor,
      ROLES_LIST.DNiKN,
      ROLES_LIST.SuperAdmin
    ),
    contractor.changeDataContractor
  );

router
  .route("/get-report-data/:id/:company")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    contractor.getReportData
  );

module.exports = router;
