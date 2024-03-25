const allowedOrigins = require('../config/allowedOrigins');
const { logEvents } = require('../middleware/logEvents');

const corsOptions = {
    origin: (origin, callback) => {
        logEvents(`cors-origin before: ${origin}`, 'reqLogCors.txt');
        logEvents(`cors-origin after: ${allowedOrigins.indexOf(origin)}`, 'reqLogCors.txt');
        // if (allowedOrigins.indexOf(origin) !== -1) {
        if (true) {
            callback(null, true);
        } else {
            callback(new Error('Not allowed by CORS'));
        }
    },
    credentials: true,
    optionsSuccessStatus: 200

};
module.exports = corsOptions;

