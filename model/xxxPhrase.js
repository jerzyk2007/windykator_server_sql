const mongoose = require('mongoose');
const { Schema } = mongoose;

const phraseSchema = new Schema({
    question: {
        type: String,
        required: true,
        maxlength: 150
    },
    answer: {
        type: String,
        required: true,
        maxlength: 150
    },
});


phraseSchema.pre('save', async function (next) {
    const docCount = await this.constructor.countDocuments();
    if (docCount >= 50) {
        // Możesz rzucić błędem, zatrzymać zapis, etc.
        return next(new Error('The collection has exceeded the limit of 50 elements.'));
    }
    next();
});

const getModel = (collectionName) => {
    const model = mongoose.models[collectionName] || mongoose.model(collectionName, phraseSchema, collectionName);
    return model;
};

module.exports = getModel;