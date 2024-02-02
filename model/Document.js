const mongoose = require('mongoose');
const { Schema } = mongoose;

const documentsSchema = new Schema({

    "50VAT": {
        type: Number,
    },
    "100VAT": {
        type: Number,
    },

    ASYSTENTKA: {
        type: String,
    },
    BRUTTO: {
        type: Number,
        // unique: true,
    },
    DATAFV: {
        type: String
    },
    DATAKOMENTARZABECARED: {
        type: String
    },
    DOROZLICZ: {
        type: Number
    },
    DZIAL: {
        type: String
    },
    DZIALANIA: {
        type: String
    },
    ILEDNIPOTERMINIE: {
        type: Number
    },
    JAKAKANCELARIA: {
        type: String
    },
    KOMENTARZKANCELARIA: {
        type: String
    },
    KONTRAHENT: {
        type: String
    },
    KWOTAWINDYKOWANA: {
        type: Number,
        default: 0
    },
    NETTO: {
        type: Number
    },
    NRREJESTRACYJNY: {
        type: String
    },
    NRSZKODY: {
        type: String
    },
    NUMER: {
        type: String
    },
    NUMERSPRAWY: {
        type: String
    },
    PRZETERMINOWANENIEPRZETERMINOWANE: {
        type: String
    },
    STATUSSPRAWYKANCELARIA: {
        type: String
    },
    STATUSSPRAWYWINDYKACJA: {
        type: String
    },
    TERMIN: {
        type: String
    },
    DZIAL: {
        type: String
    },
    UWAGI: {
        type: String
    },
    ZATWIERDZIL: {
        type: String
    }
});

module.exports = mongoose.model("Documents", documentsSchema);