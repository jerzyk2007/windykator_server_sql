const { connect_SQL } = require("../config/dbConn");
const User = require("../model/User");

const copyUsersToMySQL = async (req, res) => {
  try {
    const usersData = await User.find().exec();

    // const cleanedData = usersData.map(({ __v, _id, ...rest }) => rest);

    const cleanedData = usersData.map((item) => {
      return {
        username: item.username,
        usersurname: item.usersurname,
        userlogin: item.userlogin,
        roles: item.roles ? item.roles : {},
        password: item.password,
        tableSettings: item.tableSettings ? item.tableSettings : {},
        raportSettings: item.raportSettings ? item.raportSettings : {},
        permissions: item.permissions ? item.permissions : {},
        departments: item.departments ? item.departments : {},
        columns: item.columns ? item.columns : [],
        refreshToken: item.refreshToken ? item.refreshToken : "",
      };
    });

    // const data = await connect_SQL.query(' SELECT * FROM users');
    // const [rows, fields] = await connect_SQL.execute(" SELECT * FROM users");
    // console.log(rows);
    // if (!data) {
    //     return res.status(404);
    // }

    if (cleanedData.length === 0) {
      console.log("Brak danych do wgrania.");
      return;
    }

    // Pobieramy nazwy kolumn z pierwszego obiektu
    const columns = Object.keys(cleanedData[0]);

    // Budujemy część zapytania SQL z nazwami kolumn
    const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${columns
      .map(() => "?")
      .join(", ")})`;

    for (const item of cleanedData) {
      // Wyciągamy wartości dla każdej kolumny z obiektu
      const values = columns.map((column) => item[column]);

      // Wykonujemy zapytanie
      await connect_SQL.execute(sql, values);
    }

    console.log("Dane zostały pomyślnie wgrane do bazy danych MySQL.");

    res.json({
      success: true,
      message: "All Users Records",
      // totalUsers: data[0].length,
      data: cleanedData,
    });
  } catch (err) {
    console.error(err);
    res.status(500).send({
      succes: false,
      message: "Error in Get All User API",
      error: err,
    });
  }
};

module.exports = {
  copyUsersToMySQL,
};
