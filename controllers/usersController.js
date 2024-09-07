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
    const [rows, fields] = await connect_SQL.query(
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
    //check duplicate
    const [rows, fields] = await connect_SQL.query(
      "SELECT userlogin FROM users WHERE userlogin = ?",
      [newUserlogin]
    );
    if (rows[0]?.userlogin)
      return res.status(409).json({ message: newUserlogin }); // conflict - duplicate

    const findUser = await connect_SQL.query(
      "SELECT userlogin, roles FROM users WHERE _id = ?",
      [_id]
    );
    if (findUser[0][0]?.roles && findUser[0][0]?.roles.Root) {
      return res.status(404).json({ message: "User not found." });
    } else {
      await connect_SQL.query("UPDATE users SET userlogin = ? WHERE _id = ?", [
        newUserlogin,
        _id,
      ]);

      res.status(201).json({ message: newUserlogin });
    }
  } catch (error) {
    logEvents(
      `usersController, handleChangeLogin: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana imienia i nazwiska użytkownika
const handleChangeName = async (req, res) => {
  const { _id } = req.params;
  const { name, surname } = req.body;
  if (!name || !surname) {
    return res
      .status(400)
      .json({ message: "Userlogin, name and surname are required." });
  }
  try {
    const findUser = await connect_SQL.query(
      "SELECT  roles FROM users WHERE _id = ?",
      [_id]
    );

    if (findUser[0][0]?.roles && findUser[0][0].roles.Root) {
      return res.status(404).json({ message: "User not found." });
    } else {
      await connect_SQL.query(
        "UPDATE users SET username = ?, usersurname = ? WHERE _id = ?",
        [name, surname, _id]
      );

      res
        .status(201)
        .json({ message: "The name and surname have been changed." });
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

// zmiana hasła użytkownika
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
    const findUser = await User.find({ refreshToken, _id }).exec();
    const hashedPwd = await bcryptjs.hash(password, 10);
    if (findUser) {
      const result = await User.updateOne(
        { _id },
        { $set: { password: hashedPwd } }
      );
    } else {
      return res.status(404).json({ message: "User not found." });
    }

    res.status(201).json({ message: "Password is changed" });
  } catch (error) {
    logEvents(
      `usersController, changePassword: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zmiana hasła innemu użytkownikowi
const changePasswordAnotherUser = async (req, res) => {
  const { _id } = req.params;
  const { password } = req.body;
  if (!password) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  try {
    const findUser = await User.findOne({ _id }).exec();
    const hashedPwd = await bcryptjs.hash(password, 10);
    if (findUser) {
      if (findUser?.roles && findUser.roles.Root) {
        return res.status(404).json({ message: "User not found." });
      } else {
        await User.updateOne(
          { _id },
          { $set: { password: hashedPwd } },
          { upsert: true }
        );
        res.status(201).json({ message: "Password is changed" });
      }
    } else {
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

// zmiana uprawnień użytkownika Doradca/Asystentka
const changeUserPermissions = async (req, res) => {
  const { _id } = req.params;
  const { permissions } = req.body;
  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      if (findUser?.roles && findUser.roles.Root) {
        return res.status(404).json({ message: "User not found." });
      } else {
        await User.updateOne(
          { _id },
          { $set: { permissions } },
          { upsert: true }
        );
        res.status(201).json({ message: "Permissions are changed" });
      }
    } else {
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

// zmiana dostępu do działów
const changeUserDepartments = async (req, res) => {
  const { _id } = req.params;
  const { departments } = req.body;

  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      if (findUser?.roles && findUser.roles.Root) {
        return res.status(404).json({ message: "User not found." });
      } else {
        await User.updateOne(
          { _id },
          { $set: { departments } },
          { upsert: true }
        );
        res.status(201).json({ message: "Departments are changed" });
      }
    } else {
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
    // const findUser = await User.findOne({ _id }).exec();
    const findUser = await connect_SQL.query(
      "SELECT userlogin, roles FROM users WHERE _id = ?",
      [_id]
    );
    if (findUser) {
      if (findUser[0][0]?.roles && findUser[0][0].roles.Root) {
        return res.status(404).json({ message: "User not found." });
      } else {
        await connect_SQL.query("DELETE FROM users WHERE _id = ?", [_id]);

        res.status(201).json({ message: "User is deleted." });
      }
    } else {
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(`usersController, deleteUser: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ message: error.message });
  }
};

// zapisanie ustawień tabeli dla użytkownika
const saveTableSettings = async (req, res) => {
  const { _id } = req.params;
  const { tableSettings } = req.body;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }

  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      await User.updateOne({ _id }, { $set: { tableSettings } });

      res.status(201).json({ message: "Table settings are changed" });
    } else {
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

// pobieranie ustawień tabeli
const getTableSettings = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      res.json(findUser.tableSettings);
    } else {
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, getTableSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobieranie column które może widziec użytkownik
const getUserColumns = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      res.json(findUser.columns);
    } else {
      return res.status(404).json({ message: "User not found." });
    }
  } catch (error) {
    logEvents(
      `usersController, getUserColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// wyszukanie uzytkownika żeby zmienić jego ustawienia
const getUsersData = async (req, res) => {
  const { search } = req.query;
  try {
    const [rows, fields] = await connect_SQL.query(
      "SELECT _id, username, usersurname, userlogin, roles, tableSettings, raportSettings, permissions, departments, columns FROM users WHERE userlogin LIKE ?",
      [`%${search}%`]
    );

    if (rows[0]?.userlogin.length > 0) {
      // sprawdzenie ilu użytkowników pasuje do search, jesli użytkownik ma uprawnienia Root to nie jest dodany
      // const filteredUsers = rows
      //   .map((user) => {
      //     const filteredUser = { ...user._doc };
      //     keysToRemove.forEach((key) => delete filteredUser[key]);
      //     if (filteredUser.roles) {
      //       filteredUser.roles = Object.keys(filteredUser.roles).map(
      //         (role) => role
      //       );
      //     }
      //     return filteredUser;
      //   })
      //   .filter((user) => !user.roles.includes("Root"));

      const filteredUsers = rows
        .map((user) => {
          if (user.roles) {
            user.roles = Object.keys(user.roles).map((role) => role);
          }
          return user;
        })
        .filter((user) => !user.roles.includes("Root"));
      res.json(filteredUsers);
    } else {
      res.json([]);
    }
    // const findUsers = await User.find({
    //   userlogin: { $regex: search, $options: "i" },
    // }).exec();
    // if (findUsers.length > 0) {
    //   const keysToRemove = ["password", "refreshToken"];

    //   // sprawdzenie ilu użytkowników pasuje do search, jesli użytkownik ma uprawnienia Root to nie jest dodany
    //   const filteredUsers = findUsers
    //     .map((user) => {
    //       const filteredUser = { ...user._doc };
    //       keysToRemove.forEach((key) => delete filteredUser[key]);
    //       if (filteredUser.roles) {
    //         filteredUser.roles = Object.keys(filteredUser.roles).map(
    //           (role) => role
    //         );
    //       }
    //       return filteredUser;
    //     })
    //     .filter((user) => !user.roles.includes("Root"));

    //   res.json(filteredUsers);
    // } else {
    //   res.json([]);
    // }
  } catch (error) {
    logEvents(`usersController, getUsersData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
const getUsersData2 = async (req, res) => {
  const { search } = req.query;
  try {
    const findUsers = await User.find({
      userlogin: { $regex: search, $options: "i" },
    }).exec();
    if (findUsers.length > 0) {
      const keysToRemove = ["password", "refreshToken"];

      // sprawdzenie ilu użytkowników pasuje do search, jesli użytkownik ma uprawnienia Root to nie jest dodany
      const filteredUsers = findUsers
        .map((user) => {
          const filteredUser = { ...user._doc };
          console.log(filteredUser);
          keysToRemove.forEach((key) => delete filteredUser[key]);
          console.log(filteredUser.roles);

          if (filteredUser.roles) {
            filteredUser.roles = Object.keys(filteredUser.roles).map(
              (role) => role
            );
          }
          return filteredUser;
        })
        .filter((user) => !user.roles.includes("Root"));

      res.json(filteredUsers);
    } else {
      res.json([]);
    }
  } catch (error) {
    logEvents(`usersController, getUsersData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zmiana roli użytkownika User, Editor, Admin
const changeRoles = async (req, res) => {
  const { _id } = req.params;
  const { roles } = req.body;

  const newRoles = { ...ROLES_LIST };
  const filteredRoles = Object.fromEntries(
    Object.entries(newRoles).filter(([key]) => roles.includes(key))
  );

  try {
    const findUser = await User.findOne({ _id }).exec();

    if (findUser) {
      await User.updateOne({ _id }, { $set: { roles: filteredRoles } });

      res.status(201).json({ message: "Roles are saved." });
    } else {
      res.status(400).json({ message: "Roles are not saved." });
    }
  } catch (error) {
    logEvents(`usersController, changeRoles: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const changeColumns = async (req, res) => {
  const { _id } = req.params;
  const { columns } = req.body;
  try {
    const result = await User.updateOne(
      { _id },
      { $set: { columns } },
      { upsert: true }
    );

    res.status(201).json({ message: "Columns are saved." });
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
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      const result = await User.updateOne(
        { _id },
        { $set: { "raportSettings.raportDepartments": raportDepartments } },
        { upsert: true }
      );
      res.status(201).json({ message: "Table settings are changed" });
    } else {
      res.status(400).json({ message: "Table settings are not changed" });
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
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      res.json(findUser.raportSettings.raportDepartments);
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
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      const result = await User.updateOne(
        { _id },
        { $set: { "raportSettings.raportAdvisers": raportAdvisers } },
        { upsert: true }
      );
      res.status(201).json({ message: "Table settings are changed" });
    } else {
      res.status(400).json({ message: "Table settings are not changed" });
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

// pobieranie ustawień raportu tabeli-działów
const getRaportAdviserSettings = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Userlogin is required." });
  }
  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      res.json(findUser.raportSettings.raportAdvisers);
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
  getTableSettings,
  getUserColumns,
  getUsersData,
  changeRoles,
  changeColumns,
  saveRaporDepartmentSettings,
  getRaportDepartmentSettings,
  saveRaporAdviserSettings,
  getRaportAdviserSettings,
};
