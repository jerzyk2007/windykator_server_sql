const allowedOrigins = require('../config/allowedOrigins');
const { logEvents } = require('../middleware/logEvents');

const corsOptions = {
    origin: (origin, callback) => {
        if (allowedOrigins.indexOf(origin) !== -1) {
            callback(null, true);
        } else {

            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200

};
module.exports = corsOptions;

