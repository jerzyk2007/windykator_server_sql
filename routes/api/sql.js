const express = require("express");

const { copyUsersToMySQL } = require("../../controllers/sqlController");

// router object
const router = express.Router();

// copy users from mongo t omysql
router.get("/copyUsers", copyUsersToMySQL);

module.exports = router;
