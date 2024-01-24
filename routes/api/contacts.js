const express = require('express');
const router = express.Router();
const multer = require('multer');
const Contacts = require('../../controllers/contactsController');
const ContactsFile = require('../../controllers/ContactsFileController');
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

const upload = multer();

router.route('/getAllContacts')
    .get(verifyRoles(ROLES_LIST.Editor), Contacts.getAllContacts);

router.route('/getSearch/:search')
    .get(verifyRoles(ROLES_LIST.Editor), Contacts.getSearchContacts);

router.route('/addMany')
    .post(verifyRoles(ROLES_LIST.Admin), upload.single('excelFile'), ContactsFile.addManyContactsFromExcel);




module.exports = router;