const express = require('express');
const router = express.Router();
const getCollectionsName = require('../../controllers/collectionsController');

router.route('/')
    .get(getCollectionsName);

module.exports = router;