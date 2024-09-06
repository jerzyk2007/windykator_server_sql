const express = require('express');

const {copyUsersToMySQL} = require('../../controllers/sqlController')

// router object
const router = express.Router();

// GET ALL Users LIST || GET
router.get('/getData', copyUsersToMySQL);



module.exports = router;