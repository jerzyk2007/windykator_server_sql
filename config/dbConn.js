// const mongoose = require('mongoose');


// const connectDB = async () => {
//     try {
//         await mongoose.connect(process.env.DATABASE_URI_ONLINE);
//     }
//     catch (err) {
//         console.error(err);
//     }
// };

// module.exports = connectDB;

const mongoose = require('mongoose');

const connectDB = async () => {
    try {
        await mongoose.connect(`${process.env.DATABASE_URI_LOCAL}`, {
            dbName: 'Windykator',
            // useNewUrlParser: true,
            // useUnifiedTopology: true
        });
        console.log('Connected to MongoDB');
    } catch (err) {
        console.error(err);
    }
};

module.exports = connectDB;



