const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

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
    // const [mainSettings] = await connect_SQL.query(
    //   "SELECT ROLES, COLUMNS, EXT_COMPANY FROM company_settings WHERE id_setting = 1"
    // );
    const [mainSettings] = await connect_SQL.query(
      "SELECT ROLES, EXT_COMPANY FROM company_settings WHERE id_setting = 1"
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
      // { columns: mainSettings[0].COLUMNS },
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
  getPermissions,
};
