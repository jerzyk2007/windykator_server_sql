const Setting = require("../model/Setting");
const User = require("../model/User");
const Document = require("../model/Document");
const { logEvents } = require("../middleware/logEvents");

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny
const changeColumns = async (req, res) => {
  const { columns } = req.body;

  try {
    const result = await Setting.findOneAndUpdate(
      {},
      { $set: { columns } },
      { new: true, upsert: true }
    );
    const allUsers = await User.find({});

    for (const user of allUsers) {
      for (const columnToUpdate of columns) {
        const existingColumnIndex = user.columns.findIndex(
          (existingColumn) =>
            existingColumn.accessorKey === columnToUpdate.accessorKey
        );

        if (existingColumnIndex !== -1) {
          user.columns[existingColumnIndex] = columnToUpdate;
        }
      }
      const result = await user.updateOne(
        { $set: { columns: user.columns } },
        { upsert: true }
      );
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
  changeColumns,
  getColumns,
};
