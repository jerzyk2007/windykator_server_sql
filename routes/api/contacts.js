const express = require('express');
const router = express.Router();
const multer = require('multer');
const Contacts = require('../../controllers/contactsController');
const ContactsFile = require('../../controllers/ContactsFileController');

const upload = multer();

router.route('/getAllContacts')
    .get(Contacts.getAllContacts);
router.route('/getSearch/:search')
    .get(Contacts.getSearchContacts);

router.route('/addMany')
    .post(upload.single('excelFile'), ContactsFile.addManyContactsFromExcel);




module.exports = router;