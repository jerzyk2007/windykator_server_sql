const User = require("../model/User");
const bcryptjs = require("bcryptjs");
const ROLES_LIST = require("../config/roles_list");
const { logEvents } = require("../middleware/logEvents");

// rejestracja nowego użytkownika
const createNewUser = async (req, res) => {
  const { userlogin, password, username, usersurname } = req.body;

  if (!userlogin || !password || !username || !usersurname) {
    return res
      .status(400)
      .json({ message: "Userlogin and password are required." });
  }
  // check for duplicate userlogin in db
  const duplicate = await User.findOne({ userlogin }).exec();
  if (duplicate)
    return res
      .status(409)
      .json({ message: `User ${userlogin} is existing in databse` }); // conflict - Unauthorized
  try {
    // encrypt the password
    const hashedPwd = await bcryptjs.hash(password, 10);
    const result = await User.create({
      username,
      usersurname,
      userlogin,
      password: hashedPwd,
    });

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

// zmiana loginu użytkownika
const handleChangeLogin = async (req, res) => {
  const { _id } = req.params;
  const { newUserlogin } = req.body;
  if (!newUserlogin) {
    return res
      .status(400)
      .json({ message: "Userlogin and new userlogin are required." });
  }
  const duplicate = await User.findOne({ userlogin: newUserlogin }).exec();
  if (duplicate) return res.status(409).json({ message: newUserlogin }); // conflict - Unauthorized

  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser?.roles && findUser.roles.Root) {
      return res.status(404).json({ message: "User not found." });
    } else {
      const result = await User.updateOne(
        { _id },
        { $set: { userlogin: newUserlogin } },
        { upsert: true }
      );
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
    const findUser = await User.findOne({ _id }).exec();
    if (findUser?.roles && findUser.roles.Root) {
      return res.status(404).json({ message: "User not found." });
    } else {
      const result = await User.updateOne(
        { _id },
        { $set: { username: name, usersurname: surname } },
        { upsert: true }
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
        const result = await User.updateOne(
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
        const result = await User.updateOne(
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
        const result = await User.updateOne(
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

// usunięcie uzytkownika
const deleteUser = async (req, res) => {
  const { _id } = req.params;
  if (!_id) {
    return res.status(400).json({ message: "Id is required." });
  }
  try {
    const findUser = await User.findOne({ _id }).exec();
    if (findUser) {
      if (findUser?.roles && findUser.roles.Root) {
        return res.status(404).json({ message: "User not found." });
      } else {
        const result = await User.deleteOne({ _id });
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
      const result = await User.updateOne({ _id }, { $set: { tableSettings } });

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
    const findUsers = await User.find({
      userlogin: { $regex: search, $options: "i" },
    }).exec();
    if (findUsers.length > 0) {
      const keysToRemove = ["password", "refreshToken"];

      // sprawdzenie ilu użytkowników pasuje do search, jesli użytkownik ma uprawnienia Root to nie jest dodany
      const filteredUsers = findUsers
        .map((user) => {
          const filteredUser = { ...user._doc };
          keysToRemove.forEach((key) => delete filteredUser[key]);
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
