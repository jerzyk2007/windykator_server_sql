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
  //   Gdy opcja dateStrings: true jest ustawiona, wartości kolumn typu DATE, DATETIME i TIMESTAMP są zwracane jako ciągi znaków w formacie 'yyyy-mm-dd' lub 'yyyy-mm-dd hh:mm:ss' (dla DATETIME i TIMESTAMP), zamiast jako obiekty Date w JavaScript.
  dateStrings: true,
  //wymuszenie zwracania danych z mysql jako liczby jeśli sa zadeklorawane jako liczby
  decimalNumbers: true,
});

module.exports = { connectMongoDB, connect_SQL };
