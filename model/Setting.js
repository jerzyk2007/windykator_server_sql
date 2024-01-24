const mongoose = require('mongoose');
const { Schema } = mongoose;

const settingsSchema = new Schema({
    columnSettings: {
        size: {
            NUMER: { type: Number, default: 100 },
            KONTRAHENT: { type: Number, default: 100 },
            DZIAL: { type: Number, default: 100 },
            NRNADWOZIA: { type: Number, default: 100 },
            W_BRUTTO: { type: Number, default: 100 },
            DOROZLICZ_: { type: Number, default: 100 },
            PRZYGOTOWAL: { type: Number, default: 100 },
            PLATNOSC: { type: Number, default: 100 },
            NRREJESTRACYJNY: { type: Number, default: 100 },
            UWAGI: { type: Number, default: 100 }
        },
        visible: {
            NUMER: { type: Boolean, default: true },
            KONTRAHENT: { type: Boolean, default: true },
            DZIAL: { type: Boolean, default: true },
            NRNADWOZIA: { type: Boolean, default: true },
            W_BRUTTO: { type: Boolean, default: true },
            DOROZLICZ_: { type: Boolean, default: true },
            PRZYGOTOWAL: { type: Boolean, default: true },
            PLATNOSC: { type: Boolean, default: true },
            NRREJESTRACYJNY: { type: Boolean, default: true },
            UWAGI: { type: Boolean, default: true }
        },
        density: { type: String, default: 'comfortable' },
        order: [{ type: String }]

    }

});

module.exports = mongoose.model("Settings", settingsSchema);