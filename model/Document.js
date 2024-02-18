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
        type: String,
    },
    ADVISERMISTAKE: {
        type: Boolean,
    },
    DOCUMENTSERROR: {
        type: Boolean,
    },
    GETTAX: {
        type: String,
    },
    ILEDNIPOTERMINIE: {
        type: Number,
        default: 0
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
    CZYPRZETERM: {
        type: String,
        default: ''
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
    UWAGI: [{
        type: String,
        default: []
    }],

    ZATWIERDZIL: {
        type: String
    }
});

module.exports = mongoose.model("Documents", documentsSchema);