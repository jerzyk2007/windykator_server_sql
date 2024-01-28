const mongoose = require('mongoose');
const { Schema } = mongoose;

const settingsSchema = new Schema({
    roles: {
        type: Map,
        of: Schema.Types.Mixed,
        default: {}
    },
    departments: {
        type: [String], // Zmiana typu na tablicę stringów
        default: []
    }
});

module.exports = mongoose.model("Settings", settingsSchema); 