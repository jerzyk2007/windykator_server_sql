const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny SQL
const changeColumns = async (req, res) => {
  const { columns } = req.body;
  try {
    await connect_SQL.query("TRUNCATE TABLE table_columns");

    // Teraz przygotuj dane do wstawienia
    const values = columns.map(item => [
      item.accessorKey,
      item.header,
      item.filterVariant,
      item.type,
      JSON.stringify(item.areas)
    ]);

    // console.log(values);
    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO table_columns
            (accessorKey, header, filterVariant, type, areas) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?, ?)").join(", ")}
        `;

    // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());


    // await connect_SQL.query(
    //   "Update settings SET columns = ? WHERE id_setting = 1",
    //   [JSON.stringify(columns)]
    // );

    const [userColumns] = await connect_SQL.query(
      // "SELECT id_user, columns FROM users"
      "SELECT id_user, columns, departments FROM users"
    );

    // console.log(userColumns[0]);
    console.log(columns[0]);

    for (const user of userColumns) {

      const repairColumn = user.columns.map(item => {
        return {
          accessorKey: item.accessorKey,
          header: item.header,
          type: item.type,
          filterVariant: item.filterVariant
        };
      });



      // console.log(user.id_user);
      // Przechodzimy przez kolumny użytkownika wstecz, aby móc bezpiecznie usuwać elementy
      // for (let i = user.columns.length - 1; i >= 0; i--) {
      //   const userColumn = user.columns[i];
      //   // Sprawdzamy, czy klucz accessorKey z userColumn znajduje się w kolumnach
      //   const correspondingColumn = columns.find(
      //     (column) => column.accessorKey === userColumn.accessorKey
      //   );
      //   if (correspondingColumn) {
      //     // Jeśli istnieje odpowiedni obiekt w columns, podmieniamy go w user.columns
      //     user.columns[i] = correspondingColumn;
      //   } else {
      //     // Jeśli nie ma odpowiadającego klucza, usuwamy ten obiekt z user.columns
      //     user.columns.splice(i, 1);
      //   }
      // }

      // await connect_SQL.query(
      //   "Update users SET columns = ? WHERE id_user = ?",
      //   [JSON.stringify(repairColumn), user.id_user]
      // );
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
      "SELECT roles, permissions, columns FROM settings WHERE id_setting = 1"
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
      "SELECT target from settings WHERE id_setting = 1"
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
      "UPDATE settings SET target = ? WHERE id_setting = 1",
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
    // const [columns] = await connect_SQL.query(
    //   "Select columns FROM settings WHERE id_setting = 1"
    // );
    // res.json(columns[0].columns);
    const [columns] = await connect_SQL.query(
      "SELECT * FROM table_columns"
    );

    // console.log(columns);
    const [areas] = await connect_SQL.query(
      "SELECT area FROM area_items"
    );

    const filteredAreas = areas.map(item => item.area);

    res.json({ columns, areas: filteredAreas.sort() });
    // res.json({ columns: columns[0].columns, areas: filteredAreas.sort() });
    // res.json({ columns, areas: filteredAreas.sort() });

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
