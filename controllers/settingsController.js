const Setting = require("../model/Setting");
const User = require("../model/User");
const Document = require("../model/Document");
const { logEvents } = require("../middleware/logEvents");

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny
const changeColumns = async (req, res) => {
  const { columns } = req.body;

  try {
    await Setting.findOneAndUpdate(
      {},
      { $set: { columns } },
      { new: true, upsert: true }
    );
    const allUsers = await User.find({});

    for (const user of allUsers) {
      // Przechowuje klucze accessorKey obiektów z columns
      const columnKeys = columns.map((column) => column.accessorKey);

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

      // Teraz możemy zaktualizować użytkownika w bazie danych
      await user.updateOne(
        { $set: { columns: user.columns } },
        { upsert: true }
      );
    }

    // for (const user of allUsers) {
    //   for (const columnToUpdate of columns) {
    //     const existingColumnIndex = user.columns.findIndex(
    //       (existingColumn) =>
    //         existingColumn.accessorKey === columnToUpdate.accessorKey
    //     );

    //     if (existingColumnIndex !== -1) {
    //       user.columns[existingColumnIndex] = columnToUpdate;
    //     }
    //   }
    //   await user.updateOne(
    //     { $set: { columns: user.columns } },
    //     { upsert: true }
    //   );
    // }
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

// const changeColumns = async (req, res) => {
//     const { columns } = req.body;
//     try {
//         // console.log(columns);
//         const getUserColumns = User.find({});
//         console.log(getUserColumns);
//         // const result = await Setting.findOneAndUpdate({}, { $set: { columns } }, { new: true, upsert: true });
//         res.end();
//     }
//     catch (error) {
//         console.error(error);
//         res.status(500).json({ error: 'Server error' });
//     }
// };

//pobieranie unikalnych nazw Działów z documentów, dzięki temu jesli jakiś przybędzie/ubędzie to na Front będzie to widac w ustawieniach użytkonika
const getFilteredDepartments = async () => {
  try {
    const result = await Document.find().exec();
    return result;
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
    const result = await Setting.find().exec();
    const rolesJSON = JSON.stringify(result[0].roles);
    const rolesObjectNoSort = JSON.parse(rolesJSON);

    // sortowanie roles wg wartości liczbowej
    const sortedEntries = Object.entries(rolesObjectNoSort).sort(
      (a, b) => a[1] - b[1]
    );
    const rolesObject = Object.fromEntries(sortedEntries);

    const roles = Object.entries(rolesObject).map(([role]) => role);
    const indexToRemove = roles.indexOf("Root");
    if (indexToRemove !== -1) {
      roles.splice(indexToRemove, 1);
    }

    const columns = [...result[0].columns];
    const permissions = [...result[0].permissions];

    const mappedDepartments = await getFilteredDepartments();
    const uniqueDepartmentsValues = Array.from(
      new Set(mappedDepartments.map((filtr) => filtr["DZIAL"]))
    ).filter(Boolean);

    res.json([
      { roles },
      { departments: uniqueDepartmentsValues },
      { columns },
      { permissions },
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
    const mappedDepartments = await getFilteredDepartments();
    const uniqueDepartmentsValues = Array.from(
      new Set(mappedDepartments.map((filtr) => filtr["DZIAL"]))
    ).filter(Boolean);

    //pobieram zapisane cele
    const getTarget = await Setting.find({}, "target").exec();

    res.json({
      departments: uniqueDepartmentsValues,
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

// zapis nowych procentów kwartalnych
const saveTargetPercent = async (req, res) => {
  const { target } = req.body;
  try {
    await Setting.findOneAndUpdate(
      {},
      { $set: { target } },
      { new: true, upsert: true }
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

const getColumns = async (req, res) => {
  try {
    const result = await Setting.find({}).exec();
    const { columns } = result[0];
    res.json(columns);
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
