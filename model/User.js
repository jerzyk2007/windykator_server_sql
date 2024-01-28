const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    username: {
        type: String,
        required: true,
        // maxlength: 30
    },
    usersurname: {
        type: String,
        required: true,
        // maxlength: 30
    },
    userlogin: {
        type: String,
        required: true,
        unique: true,
    },
    roles: {
        User: {
            type: Number,
            default: 100
        },
        Editor: Number,
        Admin: Number,
        Root: Number
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
    },
    permissions:
    {
        Basic: {
            type: Boolean,
            default: true
        },
        Standard: {
            type: Boolean,
            default: false
        }
    }
});

module.exports = mongoose.model("Users", userSchema);