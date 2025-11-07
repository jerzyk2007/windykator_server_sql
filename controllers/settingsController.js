const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
// const { verifyUserTableConfig } = require("./usersController");

// funkcja sprawdzająca poprzednie ustawienia tabeli użytkownika i dopasowująca nowe po zmianie dostępu do działu
const verifyUserTableConfig = async (id_user, permission, newDeps) => {
  try {
    // zakładamy że `departments` to tablica obiektów jak { department: 'D001', company: 'KRT' }
    if (!newDeps.length) return;

    const [columnsFromSettings] = await connect_SQL.query(
      "SELECT * FROM company_table_columns WHERE EMPLOYEE = ?",
      [permission]
    );

    const whereClauses = newDeps
      .map(() => `(ji.DEPARTMENT = ? AND ji.COMPANY = ?)`)
      .join(" OR ");
    const values = newDeps.flatMap((dep) => [dep.department, dep.company]);
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
      "SELECT permissions, columns, departments, tableSettings FROM company_users WHERE id_user = ?",
      [id_user]
    );
    const { permissions, columns, tableSettings } = checkDepartments[0];

    const areaDep = columnsFromSettings.reduce((acc, column) => {
      column.AREAS.forEach((area) => {
        if (area.available) {
          const existingEntry = acc.find((entry) =>
            entry.hasOwnProperty(area.name)
          );
          if (existingEntry) {
            existingEntry[area.name].push({
              accessorKey: column.ACCESSOR_KEY,
              header: column.HEADER,
              filterVariant: column.FILTER_VARIANT,
              type: column.TYPE,
            });
          } else {
            acc.push({
              [area.name]: [
                {
                  accessorKey: column.ACCESSOR_KEY,
                  header: column.HEADER,
                  filterVariant: column.FILTER_VARIANT,
                  type: column.TYPE,
                },
              ],
            });
          }
        }
      });
      return acc;
    }, []);

    //  obszary(area) do jakich ma dostęp uzytkownik
    const areaUsers = getUserAreas.map((item) => item.AREA);

    // 1. Przefiltruj areaDep, aby zostawić tylko obiekty o nazwach w areaUsers.
    const filteredAreas = areaDep.filter((area) =>
      Object.keys(area).some((key) => areaUsers.includes(key))
    );

    // 2. Wyciągnij wszystkie obiekty z pasujących kluczy.
    const combinedObjects = filteredAreas.flatMap((area) =>
      Object.entries(area)
        .filter(([key]) => areaUsers.includes(key))
        .flatMap(([, values]) => values)
    );

    // 3. Usuń duplikaty na podstawie accessorKey.
    const uniqueObjects = combinedObjects.reduce((acc, obj) => {
      if (!acc.some((item) => item.accessorKey === obj.accessorKey)) {
        acc.push(obj);
      }
      return acc;
    }, []);

    // wyciągam unikalne nazwy accessorKey z przypisanych nowych kolumn
    const assignedUserNewColumns = uniqueObjects.map(
      (column) => column.accessorKey
    );

    const newFilteredSize = () => {
      const newSize = assignedUserNewColumns.reduce((acc, key) => {
        if (tableSettings[permissions]?.size.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = tableSettings[permissions]?.size[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = 100;
        }
        return acc;
      }, {});
      return newSize;
    };

    const newFilteredeOrder = () => {
      const checkOrder = tableSettings[permissions]?.order
        ? tableSettings[permissions].order
        : [];

      if (checkOrder.length) {
        const filteredOrder = checkOrder.filter(
          (item) =>
            assignedUserNewColumns.includes(item) || item === "mrt-row-spacer"
        );

        // Sprawdzamy, które elementy z `assignedUserNewColumns` są nowe (nie ma ich w `checkDepartments[0].tableSettings.order`)
        const newColumns = assignedUserNewColumns.filter(
          (item) => !tableSettings[permissions].order.includes(item)
        );

        // Znajdujemy indeks przedostatniego elementu (przed 'mrt-row-spacer')
        const indexBeforeSpacer = filteredOrder.indexOf("mrt-row-spacer");

        // Tworzymy nową tablicę, dodając nowe elementy przed ostatnim elementem ('mrt-row-spacer')
        const finalOrder = [
          ...filteredOrder.slice(0, indexBeforeSpacer), // Wszystkie elementy przed 'mrt-row-spacer'
          ...newColumns, // Dodajemy nowe elementy
          "mrt-row-spacer", // Zachowujemy 'mrt-row-spacer' na końcu
        ];
        return finalOrder;
      } else {
        const finalOrder = [...assignedUserNewColumns, "mrt-row-spacer"];
        return finalOrder;
      }
    };

    const newFilteredeVisible = () => {
      const newVisible = assignedUserNewColumns.reduce((acc, key) => {
        if (tableSettings[permissions]?.visible.hasOwnProperty(key)) {
          // Dodaj istniejące klucze z checkDepartments
          acc[key] = tableSettings[permissions]?.visible[key];
        } else {
          // Stwórz klucz, jeśli go nie ma, i ustaw wartość 100
          acc[key] = false;
        }
        return acc;
      }, {});
      return newVisible;
    };

    const newTableSettings = {
      size:
        tableSettings[permissions]?.size &&
        Object.keys(tableSettings[permissions]?.size).length > 0
          ? newFilteredSize()
          : {},
      order: tableSettings[permissions]?.order?.length
        ? newFilteredeOrder()
        : [],
      visible:
        tableSettings[permissions]?.visible &&
        Object.keys(tableSettings[permissions]?.visible).length > 0
          ? newFilteredeVisible()
          : {},
      pagination: tableSettings[permissions]?.pagination
        ? tableSettings[permissions].pagination
        : { pageIndex: 0, pageSize: 10 },
      pinning: tableSettings[permissions]?.pinning
        ? tableSettings[permissions].pinning
        : { left: [], right: [] },
    };

    columns[permissions] = uniqueObjects;
    tableSettings[permissions] = newTableSettings;
    await connect_SQL.query(
      "Update company_users SET columns = ?, tableSettings = ?  WHERE id_user = ?",
      [JSON.stringify(columns), JSON.stringify(tableSettings), id_user]
    );
  } catch (error) {
    logEvents(
      `settingsController, verifyUserTableConfig: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// funkcja sprawdzająca poprzednie ustawienia tabeli użytkownika-zewnętrznego i dopasowująca nowe po zmianie dostępu do kancelarii
const verifyUserLawPartnerConfig = async (id_user, permission, lawPartner) => {
  try {
    if (!lawPartner.length) return;
    const [userData] = await connect_SQL.query(
      "SELECT departments, tableSettings, columns  FROM company_users WHERE id_user = ?",
      [id_user]
    );
    if (!userData.length) return;
    const { departments, tableSettings, columns } = userData[0];

    const [columnsFromSettings] = await connect_SQL.query(
      "SELECT * FROM company_table_columns WHERE EMPLOYEE = ?",
      [permission]
    );

    //  1️⃣ //  sprawdzam jakie kolumny powinny byc przypisane do usera
    const trueDepartments = departments[permission]
      .filter((obj) => Object.values(obj)[0] === true)
      .map((obj) => Object.keys(obj)[0]);

    const newUserColumns = columnsFromSettings.filter((col) =>
      col.AREAS.some(
        (area) => trueDepartments.includes(area.name) && area.available
      )
    );

    // sprawdzam czy nie ma duplikatów po id_table_columns:
    const uniqueUserColumns = [
      ...new Map(
        newUserColumns.map((col) => [col.id_table_columns, col])
      ).values(),
    ];

    const cleanedUserColumns = uniqueUserColumns.map((col) => ({
      accessorKey: col.ACCESSOR_KEY,
      header: col.HEADER,
      type: col.TYPE,
      filterVariant: col.FILTER_VARIANT,
    }));
    columns[permission] = [...cleanedUserColumns];

    // -- 2️⃣ dopsaowuje tableSetting po zmianie kolumn

    const allowedKeys = cleanedUserColumns.map((col) => col.accessorKey);
    // 📦 Pobierz ustawienia użytkownika
    const userSettings = tableSettings[permission] || {};

    // 🔧 Głęboka kopia (aby nie mutować oryginału)
    const cleanedSettings = JSON.parse(JSON.stringify(userSettings));

    // --- SIZE ---
    if (cleanedSettings.size) {
      if (allowedKeys.length === 0) {
        cleanedSettings.size = {};
      } else {
        cleanedSettings.size = Object.fromEntries(
          Object.entries(cleanedSettings.size).filter(([key]) =>
            allowedKeys.includes(key)
          )
        );
      }
    }

    // --- ORDER ---
    if (cleanedSettings.order) {
      if (allowedKeys.length === 0) {
        cleanedSettings.order = ["mrt-row-spacer"];
      } else {
        cleanedSettings.order = cleanedSettings.order.filter(
          (key) => key === "mrt-row-spacer" || allowedKeys.includes(key)
        );

        cleanedSettings.order = [
          ...cleanedSettings.order.filter((k) => k !== "mrt-row-spacer"),
          "mrt-row-spacer",
        ];
      }
    }

    // --- PINNING ---
    // 🔒 tu nic nie dodajemy, tylko usuwamy z oryginalnych ustawień
    if (cleanedSettings.pinning) {
      const { left = [], right = [] } = cleanedSettings.pinning;

      cleanedSettings.pinning = {
        left: left.filter((key) => allowedKeys.includes(key)),
        right: right.filter((key) => allowedKeys.includes(key)),
      };
    }

    // --- VISIBLE ---
    if (cleanedSettings.visible) {
      if (allowedKeys.length === 0) {
        cleanedSettings.visible = {};
      } else {
        cleanedSettings.visible = Object.fromEntries(
          Object.entries(cleanedSettings.visible).filter(([key]) =>
            allowedKeys.includes(key)
          )
        );
      }
    }

    // --- PAGINATION ---
    // nie zmieniamy

    tableSettings[permission] = cleanedSettings;

    await connect_SQL.query(
      "UPDATE company_users SET columns = ?, tableSettings = ? WHERE id_user = ?",
      [JSON.stringify(columns), JSON.stringify(tableSettings), id_user]
    );
  } catch (error) {
    logEvents(
      `settingsController, verifyUserLawPartnerConfig: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny SQL
const changeTableColumns = async (req, res) => {
  const { type, permission, data } = req.body;
  try {
    if (type === "edit") {
      await connect_SQL.query(
        "UPDATE company_table_columns SET HEADER = ?, ACCESSOR_KEY = ?, FILTER_VARIANT = ?, TYPE = ?, EMPLOYEE = ?, AREAS = ? WHERE id_table_columns = ?",
        [
          data.header,
          data.accessorKey,
          data.filterVariant,
          data.type,
          data.employee,
          JSON.stringify(data.areas),
          data.id_table_columns,
        ]
      );
    } else if (type === "new") {
      await connect_SQL.query(
        "INSERT INTO company_table_columns  (HEADER, ACCESSOR_KEY, FILTER_VARIANT, TYPE, EMPLOYEE, AREAS) VALUES (?, ?, ?, ?, ?, ?)",
        [
          data.header,
          data.accessorKey,
          data.filterVariant,
          data.type,
          data.employee,
          JSON.stringify(data.areas),
        ]
      );
    }

    const [userTableColumns] = await connect_SQL.query(
      `SELECT id_user, columns, departments, tableSettings, permissions FROM company_users`
    );
    console.log(permission);
    for (const user of userTableColumns) {
      if (user.permissions === "Pracownik") {
        await verifyUserTableConfig(
          user.id_user,
          permission,
          user.departments[permission]
        );
        await verifyUserLawPartnerConfig(
          user.id_user,
          permission,
          user.departments["Kancelaria"]
        );
      } else if (user.permissions === "Kancelaria") {
        await verifyUserLawPartnerConfig(
          user.id_user,
          permission,
          user.departments["Kancelaria"]
        );
      }
      // if (permission === "Pracownik") {
      //   for (const user of userTableColumns) {
      //     await verifyUserTableConfig(
      //       user.id_user,
      //       permission,
      //       user.departments[permission]
      //     );
      //   }
      // } else if (permission === "Kancelaria") {
      //   for (const user of userTableColumns) {
      //     await verifyUserLawPartnerConfig(
      //       user.id_user,
      //       permission,
      //       user.departments[permission]
      //     );
      //   }
    }

    res.end();
  } catch (error) {
    logEvents(
      `settingsController, changeTableColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const deleteTableColumn = async (req, res) => {
  const { id } = req.params;
  try {
    await connect_SQL.query(
      "DELETE FROM company_table_columns WHERE id_table_columns = ?",
      [id]
    );
    res.end();
  } catch (error) {
    logEvents(
      `settingsController, deleteTableColumn: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

//pobieranie unikalnych nazw Działów z documentów, dzięki temu jesli jakiś przybędzie/ubędzie to na Front będzie to widac w ustawieniach użytkonika
const getFilteredDepartments = async (res) => {
  try {
    const [mappedDepartments] = await connect_SQL.query(
      "SELECT DZIAL FROM company_documents"
    );
    const uniqueDepartmentsValues = Array.from(
      new Set(mappedDepartments.map((filtr) => filtr["DZIAL"]))
    )
      .filter(Boolean)
      .sort();
    return uniqueDepartmentsValues;
  } catch (error) {
    logEvents(
      `settingsController, getFilteredDepartments: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// pobieranie głównych ustawień
const getSettings = async (req, res) => {
  try {
    const [mainSettings] = await connect_SQL.query(
      "SELECT ROLES, COLUMNS, EXT_COMPANY FROM company_settings WHERE id_setting = 1"
    );
    //zamieniam obiekt json na tablice ze stringami, kazdy klucz to wartość string w tablicy
    const roles = Object.entries(mainSettings[0].ROLES).map(([role]) => role);

    const rolesToRemove = ["Start"];

    rolesToRemove.forEach((roleToRemove) => {
      const indexToRemove = roles.indexOf(roleToRemove);
      if (indexToRemove !== -1) {
        roles.splice(indexToRemove, 1);
      }
    });

    const uniqueDepartments = await getFilteredDepartments(res);

    const [departmentsFromJI] = await connect_SQL.query(
      "SELECT DISTINCT DEPARTMENT FROM company_join_items"
    );

    const departmentStrings = departmentsFromJI.map((item) => item.DEPARTMENT);

    const [depsFromCJI] = await connect_SQL.query(
      "SELECT DISTINCT DEPARTMENT, COMPANY FROM company_join_items"
    );
    const [depsFromCompDocs] = await connect_SQL.query(
      "SELECT DISTINCT DZIAL, FIRMA FROM company_documents"
    );

    const [company] = await connect_SQL.query(
      "SELECT COMPANY from company_settings WHERE id_setting = 1"
    );

    res.json([
      { roles },
      { departments: uniqueDepartments },
      { departmentsJI: departmentStrings },
      { columns: mainSettings[0].COLUMNS },
      { departmentsFromCJI: depsFromCJI },
      { departmentsFromCompDocs: depsFromCompDocs },
      { company: company[0]?.COMPANY ? company[0].COMPANY : [] },
      {
        ext_company: mainSettings[0]?.EXT_COMPANY
          ? mainSettings[0].EXT_COMPANY
          : [],
      },
    ]);
  } catch (error) {
    logEvents(
      `settingsController, getSettings: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// pobieranie unikalnych nazw działów
const getDepartments = async (req, res) => {
  try {
    const uniqueDepartments = await getFilteredDepartments(res);

    //pobieram zapisane cele
    const [getTarget] = await connect_SQL.query(
      "SELECT TARGET from company_settings WHERE id_setting = 1"
    );
    res.json({
      departments: uniqueDepartments,
      target: getTarget[0].TARGET,
    });
  } catch (error) {
    logEvents(
      `settingsController, getDepartments: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// zapis nowych procentów kwartalnych SQL
const saveTargetPercent = async (req, res) => {
  const { target } = req.body;
  try {
    await connect_SQL.query(
      "UPDATE company_settings SET TARGET = ? WHERE id_setting = 1",
      [JSON.stringify(target)]
    );

    res.end();
  } catch (error) {
    logEvents(
      `settingsController, saveTargetPercent: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera kolumny tabeli dla Ustawienia kolumn tabeli sql
const getTableColumns = async (req, res) => {
  try {
    const [columns] = await connect_SQL.query(
      "SELECT * FROM company_table_columns"
    );
    const [permissions] = await connect_SQL.query(
      "SELECT PERMISSIONS, EXT_COMPANY FROM company_settings WHERE id_setting = 1"
    );

    const grouped = permissions[0].PERMISSIONS.reduce((acc, role) => {
      acc[role] = {
        columns: columns
          .filter((col) => col.EMPLOYEE === role)
          .map((col) => ({
            id_table_columns: col.id_table_columns,
            header: col.HEADER,
            accessorKey: col.ACCESSOR_KEY,
            filterVariant: col.FILTER_VARIANT,
            type: col.TYPE,
            areas: col.AREAS,
            employee: col.EMPLOYEE,
          })),
      };
      return acc;
    }, {});

    const [areas] = await connect_SQL.query(
      "SELECT AREA FROM company_area_items"
    );
    const filteredAreas = areas.map((item) => item.AREA);

    grouped.Pracownik.areas = filteredAreas;
    grouped.Kancelaria.areas = permissions[0].EXT_COMPANY || [];
    res.json({
      permissions: permissions[0].PERMISSIONS || [],
      employees: grouped,
    });
  } catch (error) {
    logEvents(
      `settingsController, getTableColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// do pobierania defaultowych uprawnień
const getPermissions = async (req, res) => {
  try {
    const [permissions] = await connect_SQL.query(
      "SELECT PERMISSIONS FROM company_settings"
    );
    res.json({
      permissions: permissions.length ? permissions[0].PERMISSIONS : [],
    });
  } catch (error) {
    logEvents(
      `settingsController, getPermissions: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getSettings,
  getDepartments,
  saveTargetPercent,
  changeTableColumns,
  deleteTableColumn,
  getTableColumns,
  getPermissions,
  verifyUserTableConfig,
  verifyUserLawPartnerConfig,
};
