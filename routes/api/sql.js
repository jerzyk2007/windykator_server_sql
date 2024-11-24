const express = require("express");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const SQLController = require("../../controllers/sqlController");

// router object
const router = express.Router();

// copy users from mongo t omysql
router
  .route("/copyUsers")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.copyUsersToMySQL);

router
  .route("/copySettings")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.copySettingsToMySQL);


router
  .route("/copyDocuments")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.copyDocumentsToMySQL);


router
  .route("/copyDocuments_Actions")
  .get(
    verifyRoles(ROLES_LIST.SuperAdmin),
    SQLController.copyDocuments_ActionsToMySQL
  );

router
  .route("/repair-departments")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.repairDepartments);

router
  .route("/copy-items-departments")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.copyItemsDepartments);

router
  .route("/copy-prepared-items")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.copyPreparedItems);

router
  .route("/change-fullBrutto-fullNetto")
  .get(verifyRoles(ROLES_LIST.SuperAdmin), SQLController.fullBruttoFullNetto);

module.exports = router;
