const express = require("express");

const {
  copyUsersToMySQL,
  copySettingsToMySQL,
  copyDocumentsToMySQL,
  copyDocuments_ActionsToMySQL,
  repairDepartments,
  copyItemsDepartments,
  copyPreparedItems,
} = require("../../controllers/sqlController");

// router object
const router = express.Router();

// copy users from mongo t omysql
router.get("/copyUsers", copyUsersToMySQL);

router.get("/copySettings", copySettingsToMySQL);
router.get("/copyDocuments", copyDocumentsToMySQL);
router.get("/copyDocuments_Actions", copyDocuments_ActionsToMySQL);
router.get("/repair-departments", repairDepartments);
router.get("/copy-items-departments", copyItemsDepartments);
router.get("/copy-prepared-items", copyPreparedItems);

module.exports = router;
