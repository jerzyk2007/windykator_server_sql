const { connect_SQL } = require("../config/dbConn");
const bcryptjs = require("bcryptjs");
const ROLES_LIST = require("../config/roles_list");
const { logEvents } = require("../middleware/logEvents");
const { newUserTableSettings, raportSettings } = require('./manageDocumentAddition');
const { generatePassword } = require('./manageDocumentAddition');
const { sendEmail } = require('./mailController');

// funkcja sprawdzająca poprzednie ustawienia tabeli użytkownika i dopasowująca nowe po zmianie dostępu do działu
const verifyUserTableConfig = async (id_user, departments, columnsFromSettings) => {
  try {

    // zakładamy że `departments` to tablica obiektów jak { department: 'D001', company: 'KRT' }
    if (!departments.length) return;

    const whereClauses = departments.map(() => `(ji.DEPARTMENT = ? AND ji.COMPANY = ?)`).join(' OR ');
    const values = departments.flatMap(dep => [dep.department, dep.company]);

    const query = `
  SELECT DISTINCT ji.AREA
  FROM company_users AS u
  LEFT JOIN company_join_items AS ji
    ON (${whereClauses})
  WHERE u.id_user = ?
`;
    // Dodaj id_user na końcu wartości
    values.push(id_user);
    const [getUserAreas] = await connect_SQL.query(query, values);

    // pobieram ustawienia kolumn, przypisanych działów i ustawień tabeli danego użytkownika
    const [checkDepartments] = await connect_SQL.query(
      "SELECT columns, departments, tableSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );

    const areaDep = columnsFromSettings.reduce((acc, column) => {
      column.areas.forEach(area => {
        if (area.available) {
          const existingEntry = acc.find(entry => entry.hasOwnProperty(area.name));
          if (existingEntry) {
            existingEntry[area.name].push({
              accessorKey: column.accessorKey,
              header: column.header,
              filterVariant: column.filterVariant,
              type: column.type,
              // hide: area.hide
            });
          } else {
            acc.push({
              [area.name]: [{
                accessorKey: column.accessorKey,
                header: column.header,
                filterVariant: column.filterVariant,
                type: column.type,
                // hide: area.hide
              }]
            });
          }
        }
      });
      return acc;
    }, []);

    //  obszary(area) do jakich ma dostęp uzytkownik
    const areaUsers = getUserAreas.map(item => item.AREA);

    // 1. Przefiltruj areaDep, aby zostawić tylko obiekty o nazwach w areaUsers.
    const filteredAreas = areaDep
      .filter(area =>
        Object.keys(area).some(key => areaUsers.includes(key))
      );

    // 2. Wyciągnij wszystkie obiekty z pasujących kluczy.
    const combinedObjects = filteredAreas.flatMap(area =>
      Object.entries(area)
        .filter(([key]) => areaUsers.includes(key))
        .flatMap(([, values]) => values)
    );

    // 3. Usuń duplikaty na podstawie accessorKey.
    const uniqueObjects = combinedObjects.reduce((acc, obj) => {
      if (!acc.some(item => item.accessorKey === obj.accessorKey)) {
        acc.push(obj);
      }
      return acc;
    }, []);

    // wyciągam unikalne nazwy accessorKey z przypisanych nowych kolumn
    const assignedUserNewColumns = uniqueObjects.map(column => column.accessorKey);

    const newFilteredSize = () => {
      const newSize = assignedUserNewColumns.reduce((acc, key) => {
        if (checkDepartments[0]?.tableSettings?.size.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = checkDepartments[0]?.tableSettings?.size[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = 100;
        }
        return acc;
      }, {});
      return newSize;
    };


    const newFilteredeOrder = () => {

      const checkOrder = checkDepartments[0]?.tableSettings?.order ? checkDepartments[0].tableSettings.order : [];

      if (checkOrder.length) {
        const filteredOrder = checkOrder.filter(item =>
          assignedUserNewColumns.includes(item) || item === 'mrt-row-spacer'
        );

        // Sprawdzamy, które elementy z `assignedUserNewColumns` są nowe (nie ma ich w `checkDepartments[0].tableSettings.order`)
        const newColumns = assignedUserNewColumns.filter(item => !checkDepartments[0].tableSettings.order.includes(item));

        // Znajdujemy indeks przedostatniego elementu (przed 'mrt-row-spacer')
        const indexBeforeSpacer = filteredOrder.indexOf('mrt-row-spacer');

        // Tworzymy nową tablicę, dodając nowe elementy przed ostatnim elementem ('mrt-row-spacer')
        const finalOrder = [
          ...filteredOrder.slice(0, indexBeforeSpacer), // Wszystkie elementy przed 'mrt-row-spacer'
          ...newColumns, // Dodajemy nowe elementy
          'mrt-row-spacer' // Zachowujemy 'mrt-row-spacer' na końcu
        ];
        return finalOrder;
      }
      else {
        const finalOrder = [...assignedUserNewColumns, 'mrt-row-spacer'];
        return finalOrder;
      }
    };

    const newFilteredeVisible = () => {
      const newVisible = assignedUserNewColumns.reduce((acc, key) => {
        if (checkDepartments[0]?.tableSettings?.visible.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = checkDepartments[0]?.tableSettings?.visible[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = false;
        }
        return acc;
      }, {});
      return newVisible;
    };

    const newTableSettings = {
      size: checkDepartments[0]?.tableSettings?.size && Object.keys(checkDepartments[0]?.tableSettings?.size).length > 0 ? newFilteredSize() : {},
      order: checkDepartments[0]?.tableSettings?.order?.length ? newFilteredeOrder() : [],
      visible: checkDepartments[0]?.tableSettings?.visible && Object.keys(checkDepartments[0]?.tableSettings?.visible).length > 0 ? newFilteredeVisible() : {},
      pagination: checkDepartments[0]?.tableSettings?.pagination ? checkDepartments[0].tableSettings.pagination : { pageIndex: 0, pageSize: 10 },
      pinning: checkDepartments[0]?.tableSettings?.pinning ? checkDepartments[0].tableSettings.pinning : { "left": [], "right": [] },
    };

    await connect_SQL.query(
      "UPDATE company_users SET tableSettings = ? WHERE id_user = ?",
      [JSON.stringify(newTableSettings), id_user]
    );
    await connect_SQL.query(
      "Update company_users SET columns = ? WHERE id_user = ?",
      [JSON.stringify(uniqueObjects), id_user]
    );

  }
  catch (error) {
    logEvents(
      `usersController, verifyUserTableConfig: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
  }
};


// rejestracja nowego użytkownika SQL
const createNewUser = async (req, res) => {
  const { userlogin, username, usersurname } = req.body;

  if (!userlogin || !username || !usersurname) {
    return res
      .status(400)
      .json({ message: "Userlogin and password are required." });
  }

  try {
    const [checkUser] = await connect_SQL.query(
      "SELECT userlogin FROM company_users WHERE userlogin = ?",
      [userlogin]
    );
    // check for duplicate userlogin in db
    if (checkUser[0]?.userlogin)
      return res
        .status(409)
        .json({ message: `User ${userlogin} is existing in databse` });

    // encrypt the password
    const roles = { Start: 1 };
    const password = await generatePassword();

    await connect_SQL.query(
      "INSERT INTO company_users (username, usersurname, userlogin, password, roles, tableSettings, raportSettings) VALUES (?, ?, ?, ?, ?, ?, ?)",
      [username, usersurname, userlogin, password.hashedPwd, JSON.stringify(roles), JSON.stringify(newUserTableSettings), JSON.stringify(raportSettings)]
    );

    const mailOptions = {
      from: "powiadomienia-raportbl@krotoski.com",
      to: `${userlogin}`,
      subject: "Zostało założone konto dla Ciebie",
      html: `
      <b>Dzień dobry</b><br>
      <br>
      Zostało założone konto dla Ciebie, aplikacja dostępna pod adresem <br>
      <a href="https://raportbl.krotoski.com/" target="_blank">https://raportbl.krotoski.com</a><br>
      <br>
      Login: ${userlogin}<br>
      Hasło: ${password.password}<br>
    
       <br>
      Z poważaniem.<br>
      Dział Nadzoru i Kontroli Należności <br>
  `,
    };
    await sendEmail(mailOptions);

    res.status(201).json(`Nowy użytkownik ${userlogin} dodany.`);
  } catch (error) {
    logEvents(
      `usersController, createNewUser: ${error}`,
      "reqServerErrors.txt"
    );
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
      "SELECT userlogin FROM company_users WHERE userlogin = ?",
      [newUserlogin]
    );
    if (existingUser.length > 0) {
      return res.status(409).json({ message: newUserlogin }); // conflict - duplicate
    }

    const [result] = await connect_SQL.query(
      "UPDATE company_users SET userlogin = ? WHERE id_user = ?",
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
      "UPDATE company_users SET username = ?, usersurname = ? WHERE id_user = ?",
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
      "UPDATE company_users SET password = ? WHERE id_user = ? AND refreshToken = ? ",
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
      "UPDATE company_users SET password = ? WHERE id_user = ?",
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
    res.status(500).json({ message: error.message });
  }
};

// zmiana uprawnień użytkownika Doradca/Asystentka SQL
const changeUserPermissions = async (req, res) => {
  const { id_user } = req.params;
  const { permissions } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE company_users SET permissions = ? WHERE id_user = ?",
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
    res.status(500).json({ message: error.message });
  }
};

// zmiana dostępu do działów SQL
const changeUserDepartments = async (req, res) => {
  const { id_user } = req.params;
  const { departments } = req.body;
  try {

    // pobieram wszytskie kolumny dla tabel które sa opisane w programie
    const [getColumns] = await connect_SQL.query('SELECT * FROM company_table_columns');

    if (departments?.length > 0) {
      await verifyUserTableConfig(id_user, departments, getColumns);
    }

    const [result] = await connect_SQL.query(
      "UPDATE company_users SET departments = ? WHERE id_user = ?",
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
      `usersController, changeUserDepartments: ${error}`,
      "reqServerErrors.txt"
    );
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
      "DELETE FROM company_users WHERE id_user = ?",
      [id_user]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ message: "User not found." });
    } else {
      res.status(201).json({ message: "User is deleted." });
    }
  } catch (error) {
    logEvents(`usersController, deleteUser: ${error}`, "reqServerErrors.txt");
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
      "UPDATE company_users SET tableSettings = ? WHERE id_user = ?",
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
    res.status(500).json({ message: error.message });
  }
};

// wyszukanie uzytkownika żeby zmienić jego ustawienia SQL
const getUsersData = async (req, res) => {
  const { search } = req.query;
  try {
    const [result] = await connect_SQL.query(
      "SELECT id_user, username, usersurname, userlogin, roles, tableSettings, raportSettings, permissions, departments, columns FROM company_users WHERE userlogin LIKE ? OR  username LIKE ? OR  usersurname LIKE ?",
      [`%${search}%`, `%${search}%`, `%${search}%`]
    );

    if (result[0]?.userlogin.length > 0) {
      const filteredUsers = result
        .map((user) => {
          if (user.roles) {
            user.roles = Object.keys(user.roles).map((role) => role);
          } if (user.departments) {
            // user.newDepartments = [...user.departments];
            user.oldDepartments = user.departments.map(dep => dep.department);
            // console.log(test);
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
      "UPDATE company_users SET roles = ? WHERE id_user = ?",
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
    res.status(500).json({ error: "Server error" });
  }
};

// zmiana dostępu do kolumn tabeli dla użytkownika (jakie kolumny ma widzieć) SQL
const changeColumns = async (req, res) => {
  const { id_user } = req.params;
  const { columns } = req.body;
  try {
    const [result] = await connect_SQL.query(
      "UPDATE company_users SET columns = ? WHERE id_user = ?",
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
    const [exist] = await connect_SQL.query(
      "SELECT raportSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );
    if (!exist[0]?.raportSettings) {
      const raportSettings = {
        raportDepartments: raportDepartments,
        raportAdvisers: {},
      };

      await connect_SQL.query(
        "UPDATE company_users SET raportSettings = ? WHERE id_user = ?",
        [JSON.stringify(raportSettings), id_user]
      );
    } else {
      const [result] = await connect_SQL.query(
        "UPDATE company_users SET raportSettings = JSON_SET(raportSettings,'$.raportDepartments', ?) WHERE id_user = ?",
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
    }
    return res.status(201).json({ message: "Table settings are changed" });
  } catch (error) {
    logEvents(
      `usersController, saveRaporDepartmentSettings: ${error}`,
      "reqServerErrors.txt"
    );
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
    const [result] = await connect_SQL.query(
      "SELECT raportSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );
    if (
      result[0]?.raportSettings?.raportDepartments &&
      Object.keys(result[0].raportSettings.raportDepartments).length > 0
    ) {
      // res.json(JSON.parse(result[0].raportSettings.raportDepartments));

      // console.log(JSON.parse(result[0].raportSettings.raportDepartments));
      return res.json(JSON.parse(result[0].raportSettings.raportDepartments));
      // return res.json(result[0].raportSettings.raportDepartments);
      // res.json({});

    } else {
      return res.json({});
    }
  } catch (error) {
    logEvents(
      `usersController, getRaportDepartmentSettings: ${error}`,
      "reqServerErrors.txt"
    );
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
    const [exist] = await connect_SQL.query(
      "SELECT raportSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );
    if (!exist[0]?.raportSettings) {
      const raportSettings = {
        raportDepartments: {},
        raportAdvisers,
      };

      await connect_SQL.query(
        "UPDATE company_users SET raportSettings = ? WHERE id_user = ?",
        [JSON.stringify(raportSettings), id_user]
      );
    } else {
      const [result] = await connect_SQL.query(
        "UPDATE company_users SET raportSettings = JSON_SET(raportSettings, '$.raportAdvisers', ?) WHERE id_user = ?",
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
    }
    return res.status(201).json({ message: "Table settings are changed" });
  } catch (error) {
    logEvents(
      `usersController, saveRaporAdviserSettings: ${error}`,
      "reqServerErrors.txt"
    );
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
    const [result] = await connect_SQL.query(
      "SELECT raportSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );

    if (
      result[0]?.raportSettings?.raportAdvisers &&
      Object.keys(result[0].raportSettings.raportAdvisers).length > 0
    ) {
      return res.json(JSON.parse(result[0].raportSettings.raportAdvisers));
      // return res.json(result[0].raportSettings.raportAdvisers);

    } else {
      return res.json({});
    }

  } catch (error) {
    logEvents(
      `usersController, getRaportAdviserSettings: ${error}`,
      "reqServerErrors.txt"
    );
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
  verifyUserTableConfig
};
