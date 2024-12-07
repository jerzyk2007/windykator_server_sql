const mongoose = require('mongoose');
const { Schema } = mongoose;

const tableSettingsSchema = new Schema({
    tableSettings: {
        type: Map,
        of: Schema.Types.Mixed
    }
});

module.exports = mongoose.model("TableSettings", tableSettingsSchema);