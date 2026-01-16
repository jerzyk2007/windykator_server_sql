const express = require("express");
const router = express.Router();
const settings = require("../../controllers/settingsController");
const table = require("../../controllers/tableController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-settings")
  .get(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.getSettings
  );

router
  .route("/save-target-percent")
  .patch(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.saveTargetPercent
  );

router
  .route("/get-departments")
  .get(
    verifyRoles(ROLES_LIST.User, ROLES_LIST.Editor, ROLES_LIST.SuperAdmin),
    settings.getDepartments
  );

router
  .route("/get-permissions")
  .get(
    verifyRoles(ROLES_LIST.Admin, ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.getPermissions
  );

router
  .route("/get-rates-data")
  .get(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.getRatesData
  );

router
  .route("/change-percent")
  .patch(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.changePercentYear
  );

router
  .route("/change-holidays")
  .patch(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.changeHolidays
  );

router
  .route("/calculate-interest")
  .post(
    verifyRoles(ROLES_LIST.DNiKN, ROLES_LIST.SuperAdmin),
    settings.calculateInterest
  );

module.exports = router;
