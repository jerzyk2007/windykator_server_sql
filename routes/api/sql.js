const express = require("express");

const {
  copyUsersToMySQL,
  copySettingsToMySQL,
} = require("../../controllers/sqlController");

// router object
const router = express.Router();

// copy users from mongo t omysql
router.get("/copyUsers", copyUsersToMySQL);

router.get("/copySettings", copySettingsToMySQL);

module.exports = router;
