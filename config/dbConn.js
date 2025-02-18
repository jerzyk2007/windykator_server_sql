const mysql = require("mysql2/promise");
const sql = require("msnodesqlv8");

// połączenie z mysql
// const connect_SQL = mysql.createPool({
//   host: process.env.HOST_MYSQL,
//   port: process.env.PORT_MYSQL,
//   user: process.env.USER_MYSQL,
//   password: process.env.PASSWORD_MYSQL,
//   database: process.env.DATABASE_MYSQL,
//   dateStrings: true,
//   decimalNumbers: true,
//   waitForConnections: true,
//   connectionLimit: 80,
//   connectTimeout: 30000,
//   acquireTimeout: 10000,  // Limit na uzyskanie połączenia (10 sek.)
//   idleTimeout: 30000,     // Limit czasu bezczynności (30 sek.)
// });

const connect_SQL = mysql.createPool({
  host: process.env.HOST_MYSQL,
  port: process.env.PORT_MYSQL,
  user: process.env.USER_MYSQL,
  password: process.env.PASSWORD_MYSQL,
  database: process.env.DATABASE_MYSQL,
  //   Gdy opcja dateStrings: true jest ustawiona, wartości kolumn typu DATE, DATETIME i TIMESTAMP są zwracane jako ciągi znaków w formacie 'yyyy-mm-dd' lub 'yyyy-mm-dd hh:mm:ss' (dla DATETIME i TIMESTAMP), zamiast jako obiekty Date w JavaScript.
  dateStrings: true,
  //wymuszenie zwracania danych z mysql jako liczby jeśli sa zadeklorawane jako liczby
  decimalNumbers: true, // Liczby będą zwracane jako liczby
  waitForConnections: true, // Czekanie na wolne połączenie
  connectionLimit: 80,// Maksymalna liczba połączeń
  connectTimeout: 30000, // Maksymalny czas oczekiwania na połączenie (ms)
});

// połączenie z mssql
const msSqlQuery = (query) => {
  const config = `Driver={ODBC Driver 17 for SQL Server};Server=${process.env.MSSQL_DB_SERVER};Database=${process.env.MSSQL_DB_DATABASE};UID=${process.env.MSSQL_DB_USER};PWD=${process.env.MSSQL_DB_PASSWORD};`;
  return new Promise((resolve, reject) => {
    sql.query(config, query, (err, rows) => {
      if (err) {
        return reject(err); // Zwróć błąd, jeśli wystąpił
      }
      resolve(rows); // Zwróć wyniki zapytania
    });
  });
};

module.exports = { connect_SQL, msSqlQuery };
