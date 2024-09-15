const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny SQL
const changeColumns = async (req, res) => {
  const { columns } = req.body;
  try {
    await connect_SQL.query(
      "Update settings SET columns = ? WHERE idsettings = 1",
      [JSON.stringify(columns)]
    );

    const [userColumns] = await connect_SQL.query(
      "SELECT _id, columns FROM users"
    );

    for (const user of userColumns) {
      // Przechodzimy przez kolumny użytkownika wstecz, aby móc bezpiecznie usuwać elementy
      for (let i = user.columns.length - 1; i >= 0; i--) {
        const userColumn = user.columns[i];
        // Sprawdzamy, czy klucz accessorKey z userColumn znajduje się w kolumnach
        const correspondingColumn = columns.find(
          (column) => column.accessorKey === userColumn.accessorKey
        );
        if (correspondingColumn) {
          // Jeśli istnieje odpowiedni obiekt w columns, podmieniamy go w user.columns
          user.columns[i] = correspondingColumn;
        } else {
          // Jeśli nie ma odpowiadającego klucza, usuwamy ten obiekt z user.columns
          user.columns.splice(i, 1);
        }
      }
      await connect_SQL.query("Update users SET columns = ? WHERE _id = ?", [
        JSON.stringify(user.columns),
        user._id,
      ]);
    }
    res.end();
  } catch (error) {
    logEvents(
      `settingsController, changeColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//pobieranie unikalnych nazw Działów z documentów, dzięki temu jesli jakiś przybędzie/ubędzie to na Front będzie to widac w ustawieniach użytkonika
const getFilteredDepartments = async () => {
  try {
    const [mappedDepartments] = await connect_SQL.query(
      "SELECT DZIAL FROM documents"
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
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobieranie głównych ustawień
const getSettings = async (req, res) => {
  try {
    const [userSettings] = await connect_SQL.query(
      "SELECT roles, permissions, columns FROM settings WHERE idsettings = 1"
    );

    const roles = Object.entries(userSettings[0].roles).map(([role]) => role);

    const rolesToRemove = ["Root", "Start"];

    rolesToRemove.forEach((roleToRemove) => {
      const indexToRemove = roles.indexOf(roleToRemove);
      if (indexToRemove !== -1) {
        roles.splice(indexToRemove, 1);
      }
    });

    const rolesOrder = [
      "User",
      "Editor",
      "EditorPlus",
      "AdminBL",
      "FK",
      "FKAdmin",
      "Nora",
      "Admin",
    ];

    roles.sort((a, b) => {
      // Uzyskujemy indeksy ról a i b w tablicy rolesOrder
      const indexA = rolesOrder.indexOf(a);
      const indexB = rolesOrder.indexOf(b);

      // Porównujemy indeksy. Jeśli rola nie jest w rolesOrder, przypisujemy jej duży indeks, aby była na końcu.
      return (
        (indexA === -1 ? rolesOrder.length : indexA) -
        (indexB === -1 ? rolesOrder.length : indexB)
      );
    });

    const uniqueDepartments = await getFilteredDepartments();

    res.json([
      { roles },
      { departments: uniqueDepartments },
      { columns: userSettings[0].columns },
      { permissions: userSettings[0].permissions },
    ]);
  } catch (error) {
    logEvents(
      `settingsController, getSettings: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobieranie unikalnych nazw działów
const getDepartments = async (req, res) => {
  try {
    const uniqueDepartments = await getFilteredDepartments();

    //pobieram zapisane cele
    const [getTarget] = await connect_SQL.query(
      "SELECT target from settings WHERE idsettings = 1"
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
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zapis nowych procentów kwartalnych SQL
const saveTargetPercent = async (req, res) => {
  const { target } = req.body;
  try {
    await connect_SQL.query(
      "UPDATE settings SET target = ? WHERE idsettings = 1",
      [JSON.stringify(target)]
    );

    res.end();
  } catch (error) {
    logEvents(
      `settingsController, saveTargetPercent: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera kolumny tabeli dla Ustawienia kolumn tabeli sql
const getColumns = async (req, res) => {
  try {
    const [columns] = await connect_SQL.query(
      "Select columns FROM settings WHERE idsettings = 1"
    );
    res.json(columns[0].columns);
  } catch (error) {
    logEvents(
      `settingsController, getColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getSettings,
  getDepartments,
  saveTargetPercent,
  changeColumns,
  getColumns,
};
