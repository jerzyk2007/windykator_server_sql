const mongoose = require('mongoose');
const { Schema } = mongoose;

const documentsSchema = new Schema({

    NUMER_FV: {
        type: String
        // stara nazwa NUMER .
    },

    DATA_FV: {
        type: String
        // stara nazwa DATAFV
    },

    TERMIN: {
        type: String
    },

    DZIAL: {
        type: String
    },

    CZY_PRZETERMINOWANE: {
        type: String,
        // stara nazwa CZYPRZETERM
    },

    ILE_DNI_PO_TERMINIE: {
        type: Number,
        default: 0
        // stara nazwa ILEDNIPOTERMINIE
    },

    BRUTTO: {
        type: Number,
    },

    NETTO: {
        type: Number
    },

    DO_ROZLICZENIA: {
        type: Number
        // stara nazwa DOROZLICZ
    },

    "100_VAT": {
        type: Number,
        // stara nazwa 100VAT
    },

    "50_VAT": {
        type: Number,
        // stara nazwa 50VAT
    },

    KONTRAHENT: {
        type: String
    },

    ASYSTENTKA: {
        type: String,
    },

    DORADCA: {
        type: String
        // stara nazwa ZATWIERDZIL
    },

    NR_REJESTRACYJNY: {
        type: String
        // stara nazwa NRREJESTRACYJNY
    },

    NR_SZKODY: {
        type: String
        // stara nazwa NRSZKODY
    },

    UWAGI_Z_FAKTURY: [{
        type: String,
        default: []
    }],

    UWAGI_ASYSTENT: [{
        type: String,
        default: []
        // stara nazwa UWAGIASYSTENT
    }],

    STATUS_SPRAWY_WINDYKACJA: {
        type: String
        // stara nazwa STATUSSPRAWYWINDYKACJA
    },

    DZIALANIA: {
        type: String,
    },

    JAKA_KANCELARIA: {
        type: String
        // stara nazwa JAKAKANCELARIA
    },

    BLAD_DORADCY: {
        type: String,
    },

    BLAD_W_DOKUMENTACJI: {
        type: String,
        // stara nazwa BLADWDOKUMENTACJ
    },

    POBRANO_VAT: {
        type: String,
        // stara nazwa POBRANOVAT
    },

    STATUS_SPRAWY_KANCELARIA: {
        type: String
        // stara nazwa STATUSSPRAWYKANCELARIA
    },

    KOMENTARZ_KANCELARIA_BECARED: {
        type: String
        // stara nazwa KOMENTARZKANCELARIA
    },

    DATA_KOMENTARZA_BECARED: {
        type: String
        // stara nazwa DATAKOMENTARZABECARED
    },

    NUMER_SPRAWY_BECARED: {
        type: String
        // stara nazwa NUMERSPRAWY
    },

    KWOTA_WINDYKOWANA_BECARED: {
        type: Number,
        default: 0
        // stara nazwa KWOTAWINDYKOWANA
    },
    ZAZNACZ_KONTRAHENTA: {
        type: String,
        default: "NIE"
    }























});

module.exports = mongoose.model("Documents", documentsSchema);