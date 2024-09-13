const { connect_SQL } = require("../config/dbConn");
const User = require("../model/User");
const Setting = require("../model/Setting");

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
const copySettingsToMySQL = async (req, res) => {
  try {
    const settingsData = await Setting.find().exec();

    const roles = Object.fromEntries(settingsData[0].roles);
    const departments = settingsData[0].departments;
    const columns = settingsData[0].columns;
    const permissions = settingsData[0].permissions;
    const target = settingsData[0].target;

    const [result] = await connect_SQL.query(
      "INSERT INTO settings (roles, departments, columns, permissions, target) VALUES (?, ?, ?, ?, ?)",
      [
        JSON.stringify(roles),
        JSON.stringify(departments),
        JSON.stringify(columns),
        JSON.stringify(permissions),
        JSON.stringify(target),
      ]
    );
    console.log(result);
    // // Budujemy część zapytania SQL z nazwami kolumn
    // const sql = `INSERT INTO users (${columns.join(", ")}) VALUES (${columns
    //   .map(() => "?")
    //   .join(", ")})`;

    // for (const item of cleanedData) {
    //   // Wyciągamy wartości dla każdej kolumny z obiektu
    //   const values = columns.map((column) => item[column]);

    //   // Wykonujemy zapytanie
    //   await connect_SQL.execute(sql, values);
    // }

    // console.log("Dane zostały pomyślnie wgrane do bazy danych MySQL.");

    // res.json({
    //   success: true,
    //   message: "All Users Records",
    //   // totalUsers: data[0].length,
    //   data: cleanedData,
    // });
    res.end();
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
  copySettingsToMySQL,
};
