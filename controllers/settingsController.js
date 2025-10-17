const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny SQL
const changeColumns = async (req, res) => {
  const { columns } = req.body;
  try {
    await connect_SQL.query("TRUNCATE TABLE company_table_columns");
    columns.sort((a, b) => a.accessorKey.localeCompare(b.accessorKey));
    // Teraz przygotuj dane do wstawienia
    const values = columns.map((item) => [
      item.accessorKey,
      item.header,
      item.filterVariant,
      item.type,
      JSON.stringify(item.areas),
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO company_table_columns
            (accessorKey, header, filterVariant, type, areas) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?, ?)").join(", ")}
        `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    const [userColumns] = await connect_SQL.query(
      `SELECT id_user, columns, departments, tableSettings FROM company_users`
    );

    for (const user of userColumns) {
      await verifyUserTableConfig(user.id_user, user.departments, columns);
    }
    res.end();
  } catch (error) {
    logEvents(
      `settingsController, changeColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
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
    const [userSettings] = await connect_SQL.query(
      "SELECT roles, permissions, columns FROM company_settings WHERE id_setting = 1"
    );

    //zamieniam obiekt json na tablice ze stringami, kazdy klucz to wartość string w tablicy
    const roles = Object.entries(userSettings[0].roles[0]).map(
      ([role]) => role
    );
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
      "SELECT company from company_settings WHERE id_setting = 1"
    );

    res.json([
      { roles },
      { departments: uniqueDepartments },
      { departmentsJI: departmentStrings },
      { columns: userSettings[0].columns },
      { permissions: userSettings[0].permissions },
      { departmentsFromCJI: depsFromCJI },
      { departmentsFromCompDocs: depsFromCompDocs },
      { company: company[0]?.company ? company[0].company : [] },
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
      "SELECT target from company_settings WHERE id_setting = 1"
    );
    res.json({
      departments: uniqueDepartments,
      target: getTarget[0].target,
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
      "UPDATE company_settings SET target = ? WHERE id_setting = 1",
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
const getColumns = async (req, res) => {
  try {
    const [columns] = await connect_SQL.query(
      "SELECT * FROM company_table_columns"
    );
    const [areas] = await connect_SQL.query(
      "SELECT AREA FROM company_area_items"
    );
    const filteredAreas = areas.map((item) => item.AREA);
    res.json({ columns, areas: filteredAreas.sort() });
  } catch (error) {
    logEvents(
      `settingsController, getColumns: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// do pobierania defaultowych uprawnień
const getPermissions = async (req, res) => {
  try {
    const [permissions] = await connect_SQL.query(
      "SELECT permissions FROM company_settings"
    );
    res.json(permissions.length ? permissions[0] : []);
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
  changeColumns,
  getColumns,
  getPermissions,
};
