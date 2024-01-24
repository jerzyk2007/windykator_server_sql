const express = require('express');
const router = express.Router();
const Documents = require('../../controllers/documentsController');


router.route('/:info')
    .get(Documents.getAllDocuments);


module.exports = router;