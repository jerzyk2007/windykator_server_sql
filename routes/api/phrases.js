const express = require('express');
const router = express.Router();
const phrasesController = require('../../controllers/phrasesController');

router.route('/learn/:type/:collection')
    .get(phrasesController.getLearnPhrases);
router.route('/test/:type/:collection')
    .get(phrasesController.getTestPhrases);
router.route('/phrases')
    .get(phrasesController.getSearchPhrases);
router.route('/change')
    .patch(phrasesController.changePhrase);
router.route('/:id')
    .delete(phrasesController.deletePhrase);
router.route('/single')
    .post(phrasesController.addDataSingle);
router.route('/manyPhrases')
    .get(phrasesController.addDataMany);
router.route('/manyCollectionsManyPhrases')
    .get(phrasesController.addManyCollectionsManyPhrases);
router.route('/checkDuplicates')
    .get(phrasesController.checkDuplicates);

module.exports = router;