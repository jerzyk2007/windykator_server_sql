const User = require("../model/User");
const bcryptjs = require("bcryptjs");
const ROLES_LIST = require("../config/roles_list");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

// rejestracja nowego użytkownika SQL
const createNewUser = async (req, res) => {
  const { userlogin, password, username, usersurname } = req.body;

  if (!userlogin || !password || !username || !usersurname) {
    return res
      .status(400)
      .json({ message: "Userlogin and password are required." });
  }

  try {
    const [rows] = await connect_SQL.query(
      "SELECT userlogin FROM users WHERE userlogin = ?",
      [userlogin]
    );

    // check for duplicate userlogin in db
    if (rows[0]?.userlogin)
      return res
        .status(409)
        .json({ message: `User ${userlogin} is existing in databse` });

    // encrypt the password
    const hashedPwd = await bcryptjs.hash(password, 10);
    const roles = { Start: 1 };

    await connect_SQL.query(
      "INSERT INTO users (username, usersurname, userlogin, password, roles) VALUES (?, ?, ?, ?, ?)",
      [username, usersurname, userlogin, hashedPwd, JSON.stringify(roles)]
    );
    res.status(201).json(`Nowy użytkownik ${userlogin} dodany.`);
  } catch (error) {
    logEvents(
      `usersController, createNewUser: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana loginu użytkownika SQL
const handleChangeLogin = async (req, res) => {
  const { _id } = req.params;
  const { newUserlogin } = req.body;
  if (!newUserlogin) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  try {
    const [existingUser] = await connect_SQL.query(
      "SELECT userlogin FROM users WHERE userlogin = ?",
      [newUserlogin]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ message: newUserlogin }); // conflict - duplicate
    }

    const [result] = await connect_SQL.query(
      "UPDATE users SET userlogin = ? WHERE _id = ?",
      [newUserlogin, _id]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      res.status(201).json({ message: newUserlogin });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, handleChangeLogin: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana imienia i nazwiska użytkownika SQL
const handleChangeName = async (req, res) => {
  const { _id } = req.params;
  const { name, surname } = req.body;
  if (!name || !surname) {
    return res
      .status(400)
      .json({ message: "Userlogin, name and surname are required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET username = ?, usersurname = ? WHERE _id = ?",
      [name, surname, _id]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      res
        .status(201)
        .json({ message: "The name and surname have been changed." });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, handleChangeName: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana hasła użytkownika SQL
const changePassword = async (req, res) => {
  const { _id } = req.params;
  const { password } = req.body;
  const refreshToken = req.cookies.jwt;

  if (!password) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  try {
    const hashedPwd = await bcryptjs.hash(password, 10);

    const [result] = await connect_SQL.query(
      "UPDATE users SET password = ? WHERE _id = ? AND refreshToken = ? ",
      [hashedPwd, _id, refreshToken]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Password is changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, changePassword: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana hasła innemu użytkownikowi SQL
const changePasswordAnotherUser = async (req, res) => {
  const { _id } = req.params;
  const { password } = req.body;
  if (!password) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  try {
    const hashedPwd = await bcryptjs.hash(password, 10);
    const [result] = await connect_SQL.query(
      "UPDATE users SET password = ? WHERE _id = ?",
      [hashedPwd, _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Password is changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, changePasswordAnotherUser: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana uprawnień użytkownika Doradca/Asystentka SQL
const changeUserPermissions = async (req, res) => {
  const { _id } = req.params;
  const { permissions } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET permissions = ?WHERE _id = ?",
      [JSON.stringify(permissions), _id]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Permissions are changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, changeUserPermissions: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana dostępu do działów SQL
const changeUserDepartments = async (req, res) => {
  const { _id } = req.params;
  const { departments } = req.body;

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET departments = ?WHERE _id = ?",
      [JSON.stringify(departments), _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Departments are changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, changePasswordAnotherUser: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// usunięcie uzytkownika SQL
const deleteUser = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Id is required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "DELETE FROM users WHERE _id = ?",
      [_id]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    } else {
      res.status(201).json({ message: "User is deleted." });
    }
  } catch (error) {
    logEvents(`usersController, deleteUser: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zapisanie ustawień tabeli dla użytkownika SQL
const saveTableSettings = async (req, res) => {
  const { _id } = req.params;
  const { tableSettings } = req.body;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET tableSettings = ? WHERE _id = ?",
      [JSON.stringify(tableSettings), _id]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Table settings are changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      res.status(400).json({ message: "Table settings are not changed" });
    }
  } catch (error) {
    logEvents(
      `usersController, saveTableSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// pobieranie ustawień tabeli/ obecnie jest pobierane równocześnie z danymi tabeli
// const getTableSettings = async (req, res) => {
//   const { _id } = req.params;
//   if (!_id) {
//     return res.status(400).json({ message: "Userlogin is required." });
//   }
//   try {
//     const findUser = await User.findOne({ _id }).exec();
//     if (findUser) {
//       console.log("findUser.tableSettings");
//       res.json(findUser.tableSettings);
//       // res.json({});
//     } else {
//       return res.status(404).json({ message: "User not found." });
//     }
//   } catch (error) {
//     logEvents(
//       `usersController, getTableSettings: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// pobieranie column które może widziec użytkownik
// const getUserColumns = async (req, res) => {
//   const { _id } = req.params;
//   if (!_id) {
//     return res.status(400).json({ message: "Userlogin is required." });
//   }
//   try {
//     const findUser = await User.findOne({ _id }).exec();
//     if (findUser) {
//       console.log(findUser.columns);
//       res.json(findUser.columns);
//     } else {
//       return res.status(404).json({ message: "User not found." });
//     }
//   } catch (error) {
//     logEvents(
//       `usersController, getUserColumns: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// wyszukanie uzytkownika żeby zmienić jego ustawienia SQL

const getUsersData = async (req, res) => {
  const { search } = req.query;
  try {
    const [result] = await connect_SQL.query(
      "SELECT _id, username, usersurname, userlogin, roles, tableSettings, raportSettings, permissions, departments, columns FROM users WHERE userlogin LIKE ?",
      [`%${search}%`]
    );

    if (result[0]?.userlogin.length > 0) {
      const filteredUsers = result
        .map((user) => {
          if (user.roles) {
            user.roles = Object.keys(user.roles).map((role) => role);
          }
          return user;
        })
        .filter((user) => !user.roles.includes("Root"));
      return res.json(filteredUsers);
    } else {
      return res.json([]);
    }
  } catch (error) {
    logEvents(`usersController, getUsersData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zmiana roli użytkownika User, Editor, Admin SQL
const changeRoles = async (req, res) => {
  const { _id } = req.params;
  const { roles } = req.body;

  const newRoles = { ...ROLES_LIST };
  const filteredRoles = Object.fromEntries(
    Object.entries(newRoles).filter(([key]) => roles.includes(key))
  );

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET roles = ? WHERE _id = ?",
      [JSON.stringify(filteredRoles), _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Roles are saved." });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(400).json({ message: "Roles are not saved." });
    }
  } catch (error) {
    logEvents(`usersController, changeRoles: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zmiana dostępu do kolumn tabeli dla użytkownika (jakie kolumny ma widzieć) SQL
const changeColumns = async (req, res) => {
  const { _id } = req.params;
  const { columns } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET columns = ? WHERE _id = ?",
      [[JSON.stringify(columns)], _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Columns are saved." });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(400).json({ message: "Columns are not saved." });
    }
  } catch (error) {
    logEvents(
      `usersController, changeColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zapisanie ustawień raportu-działów-tabeli dla użytkownika
const saveRaporDepartmentSettings = async (req, res) => {
  const { _id } = req.params;
  const { raportDepartments } = req.body;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET raportSettings = JSON_SET(raportSettings, '$.raportDepartments', ?) WHERE _id = ?",
      [JSON.stringify(raportDepartments), _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Table settings are changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res
        .status(400)
        .json({ message: "Table settings are not changed" });
    }
  } catch (error) {
    logEvents(
      `usersController, saveRaporDepartmentSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// pobieranie ustawień raportu tabeli-działów
const getRaportDepartmentSettings = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    //pobiera od razu klucz z obiektu json
    const [result] = await connect_SQL.query(
      "SELECT raportSettings->'$.raportDepartments' AS raportDepartments FROM users WHERE _id = ?",
      [_id]
    );
    if (result[0]?.raportDepartments) {
      res.json(JSON.parse(result[0].raportDepartments));
    } else {
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, getRaportDepartmentSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zapisanie ustawień raportu-doradców-tabeli dla użytkownika
const saveRaporAdviserSettings = async (req, res) => {
  const { _id } = req.params;
  const { raportAdvisers } = req.body;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET raportSettings = JSON_SET(raportSettings, '$.raportAdvisers', ?) WHERE _id = ?",
      [JSON.stringify(raportAdvisers), _id]
    );

    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      return res.status(201).json({ message: "Table settings are changed" });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res
        .status(400)
        .json({ message: "Table settings are not changed" });
    }
    // const findUser = await User.findOne({ _id }).exec();
    // if (findUser) {
    //   const result = await User.updateOne(
    //     { _id },
    //     { $set: { "raportSettings.raportAdvisers": raportAdvisers } },
    //     { upsert: true }
    //   );
    //   res.status(201).json({ message: "Table settings are changed" });
    // } else {
    //   res.status(400).json({ message: "Table settings are not changed" });
    // }
  } catch (error) {
    logEvents(
      `usersController, saveRaporAdviserSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// pobieranie ustawień raportu tabeli-działów
const getRaportAdviserSettings = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    //pobiera od razu klucz z obiektu json
    const [result] = await connect_SQL.query(
      "SELECT raportSettings->'$.raportAdvisers' AS raportAdvisers FROM users WHERE _id = ?",
      [_id]
    );
    if (result[0]?.raportAdvisers) {
      res.json(JSON.parse(result[0].raportAdvisers));
    } else {
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, getRaportAdviserSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  createNewUser,
  handleChangeLogin,
  handleChangeName,
  changePassword,
  changePasswordAnotherUser,
  changeUserPermissions,
  changeUserDepartments,
  deleteUser,
  saveTableSettings,
  // getTableSettings,
  // getUserColumns,
  getUsersData,
  changeRoles,
  changeColumns,
  saveRaporDepartmentSettings,
  getRaportDepartmentSettings,
  saveRaporAdviserSettings,
  getRaportAdviserSettings,
};
