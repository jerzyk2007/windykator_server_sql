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

const mongoose = require("mongoose");
const mysql = require("mysql2/promise");

const connectMongoDB = async () => {
  try {
    await mongoose.connect(`${process.env.DATABASE_URI_LOCAL}`, {
      dbName: "Windykator",
      // useNewUrlParser: true,
      // useUnifiedTopology: true
    });
    console.log("Connected to MongoDB");
  } catch (err) {
    console.error(err);
  }
};

const connect_SQL = mysql.createPool({
  host: process.env.HOST,
  user: process.env.USER,
  password: process.env.PASSWORD,
  database: process.env.DATABASE,
  dateStrings: true,
});

module.exports = { connectMongoDB, connect_SQL };
