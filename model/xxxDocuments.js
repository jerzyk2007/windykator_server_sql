const mongoose = require('mongoose');
const { Schema } = mongoose;

const documentsSchema = new Schema({

    W_BRUTTO: {
        type: Number,
    },
    NUMER: {
        type: String,
    },

    W_BRUTTO: {
        type: Number,
    },
    KONTRAHENT: {
        type: String,
        // unique: true,
    },
    NRNADWOZIA: {
        type: String
    },
    NRREJESTRACYJNY: {
        type: String
    },
    DOROZLICZ_: {
        type: Number
    }
});

module.exports = mongoose.model("Documents", documentsSchema);