const { connect_SQL } = require("../config/dbConn");
const bcryptjs = require("bcryptjs");
const ROLES_LIST = require("../config/roles_list");
const { logEvents } = require("../middleware/logEvents");

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
const changeLogin = async (req, res) => {
  const { id_user } = req.params;
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
      "UPDATE users SET userlogin = ? WHERE id_user = ?",
      [newUserlogin, id_user]
    );
    if (result.affectedRows > 0) {
      // Jeśli aktualizacja zakończyła się sukcesem
      res.status(201).json({ message: newUserlogin });
    } else {
      // Jeśli aktualizacja nie powiodła się
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(`usersController, changeLogin: ${error}`, "reqServerErrors.txt");
    // console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana imienia i nazwiska użytkownika SQL
const changeName = async (req, res) => {
  const { id_user } = req.params;
  const { name, surname } = req.body;

  if (!name || !surname) {
    return res
      .status(400)
      .json({ message: "Userlogin, name and surname are required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET username = ?, usersurname = ? WHERE id_user = ?",
      [name, surname, id_user]
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
    logEvents(`usersController, changeName: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana hasła użytkownika SQL
const changePassword = async (req, res) => {
  const { id_user } = req.params;
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
      "UPDATE users SET password = ? WHERE id_user = ? AND refreshToken = ? ",
      [hashedPwd, id_user, refreshToken]
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
  const { id_user } = req.params;
  const { password } = req.body;
  if (!password) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  try {
    const hashedPwd = await bcryptjs.hash(password, 10);
    const [result] = await connect_SQL.query(
      "UPDATE users SET password = ? WHERE id_user = ?",
      [hashedPwd, id_user]
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
  const { id_user } = req.params;
  const { permissions } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET permissions = ?WHERE id_user = ?",
      [JSON.stringify(permissions), id_user]
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
  const { id_user } = req.params;
  const { departments } = req.body;

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET departments = ? WHERE id_user = ?",
      [JSON.stringify(departments), id_user]
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
  const { id_user } = req.params;
  if (!id_user) {
    return res.status(400).json({ message: "Id is required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "DELETE FROM users WHERE id_user = ?",
      [id_user]
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
  const { id_user } = req.params;
  const { tableSettings } = req.body;
  if (!id_user) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET tableSettings = ? WHERE id_user = ?",
      [JSON.stringify(tableSettings), id_user]
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

// wyszukanie uzytkownika żeby zmienić jego ustawienia SQL
const getUsersData = async (req, res) => {
  const { search } = req.query;
  try {
    const [result] = await connect_SQL.query(
      "SELECT id_user, username, usersurname, userlogin, roles, tableSettings, raportSettings, permissions, departments, columns FROM users WHERE userlogin LIKE ? OR  username LIKE ? OR  usersurname LIKE ?",
      [`%${search}%`, `%${search}%`, `%${search}%`]
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
  const { id_user } = req.params;
  const { roles } = req.body;

  const newRoles = { ...ROLES_LIST };
  const filteredRoles = Object.fromEntries(
    Object.entries(newRoles).filter(([key]) => roles.includes(key))
  );

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET roles = ? WHERE id_user = ?",
      [JSON.stringify(filteredRoles), id_user]
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
  const { id_user } = req.params;
  const { columns } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET columns = ? WHERE id_user = ?",
      [[JSON.stringify(columns)], id_user]
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
  const { id_user } = req.params;
  const { raportDepartments } = req.body;
  if (!id_user) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET raportSettings = JSON_SET(raportSettings, '$.raportDepartments', ?) WHERE id_user = ?",
      [JSON.stringify(raportDepartments), id_user]
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
  const { id_user } = req.params;
  if (!id_user) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    //pobiera od razu klucz z obiektu json
    const [result] = await connect_SQL.query(
      "SELECT raportSettings->'$.raportDepartments' AS raportDepartments FROM users WHERE id_user = ?",
      [id_user]
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

// zapisanie ustawień raportu-doradców-tabeli dla użytkownika SQL
const saveRaporAdviserSettings = async (req, res) => {
  const { id_user } = req.params;
  const { raportAdvisers } = req.body;
  if (!id_user) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    const [result] = await connect_SQL.query(
      "UPDATE users SET raportSettings = JSON_SET(raportSettings, '$.raportAdvisers', ?) WHERE id_user = ?",
      [JSON.stringify(raportAdvisers), id_user]
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
      `usersController, saveRaporAdviserSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// pobieranie ustawień raportu tabeli-działów SQL
const getRaportAdviserSettings = async (req, res) => {
  const { id_user } = req.params;
  if (!id_user) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    //pobiera od razu klucz z obiektu json
    const [result] = await connect_SQL.query(
      "SELECT raportSettings->'$.raportAdvisers' AS raportAdvisers FROM users WHERE id_user = ?",
      [id_user]
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
  changeLogin,
  changeName,
  changePassword,
  changePasswordAnotherUser,
  changeUserPermissions,
  changeUserDepartments,
  deleteUser,
  saveTableSettings,
  getUsersData,
  changeRoles,
  changeColumns,
  saveRaporDepartmentSettings,
  getRaportDepartmentSettings,
  saveRaporAdviserSettings,
  getRaportAdviserSettings,
};
