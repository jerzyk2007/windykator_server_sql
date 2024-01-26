const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        unique: true,
        maxlength: 30
    },
    roles: {
        User: {
            type: Number,
            default: 100
        },
        Editor: Number,
        Admin: Number
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: String,
    tableSettings: {
        type: Map,
        of: Schema.Types.Mixed,
        default: {}
    }
});

module.exports = mongoose.model("Users", userSchema);