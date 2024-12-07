const mongoose = require('mongoose');
const { Schema } = mongoose;

const userSchema = new Schema({
    name: {
        type: String,
        required: true,
    },
    emails: [
        {
            email: {
                type: String,
            },
            verify: {
                type: Boolean,
                default: false,
            },
        }
    ],
    phones: [
        {
            phone: {
                type: Number,
            },
            verify: {
                type: Boolean,
                default: false,
            },
        }
    ],
    NIP: {
        type: Number,
        // unique: true,
    },
    comment: {
        type: String
    },
    mailing: {
        time: { type: Number },
        sending: { type: Boolean }
    }
});

module.exports = mongoose.model("Contacts", userSchema);