const express = require("express");

const SQLController = require("../../controllers/sqlController");

// router object
const router = express.Router();

// copy users from mongo t omysql
router.get("/copyUsers", SQLController.copyUsersToMySQL);

router.get("/copySettings", SQLController.copySettingsToMySQL);
router.get("/copyDocuments", SQLController.copyDocumentsToMySQL);
router.get(
  "/copyDocuments_Actions",
  SQLController.copyDocuments_ActionsToMySQL
);
router.get("/repair-departments", SQLController.repairDepartments);
router.get("/copy-items-departments", SQLController.copyItemsDepartments);
router.get("/copy-prepared-items", SQLController.copyPreparedItems);

module.exports = router;
