const { connect_SQL } = require("../config/dbConn");
const { FKRaport } = require("../model/FKRaport");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów
const getDataItems = async (req, res) => {
  try {
    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });

    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });

    const [aging] = await connect_SQL.query(
      "SELECT firstValue, secondValue, title, type from aging_items"
    );

    res.json({
      data: {
        departments,
        localizations,
        areas,
        owners,
        guardians,
        aging,
      },
    });
  } catch (error) {
    logEvents(`fkItemsData, getDataItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
const getFKSettingsItems = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0,
          data: "$items",
        },
      },
    ]);
    // console.log(result);

    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });

    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });

    res.json({
      departments,
      areas,
      localizations,
      owners,
      guardians,
    });
    // res.json({
    //   departments: result[0].data.departments,
    //   areas: result[0].data.areas,
    //   localizations: result[0].data.localizations,
    //   owners: result[0].data.owners,
    //   guardians: result[0].data.guardians,
    // });
  } catch (error) {
    logEvents(
      `fkItemsData, getFKSettingsItems: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funckja zapisujaca działy, ownerów, lokalizacje
const saveItemsData = async (req, res) => {
  const { info } = req.params;
  const { departments, localizations, areas, owners, guardians, aging } =
    req.body;

  // Mapowanie nazw na odpowiadające im klucze
  const dataMap = {
    departments,
    localizations,
    areas,
    owners,
    guardians,
    aging,
  };
  const type = info.slice(0, -1);
  try {
    if (info !== "aging") {
      await connect_SQL.query(`TRUNCATE TABLE ${type}_items`);
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT ${type} FROM ${type}_items WHERE ${type} = ?`,
          [item]
        );
        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            `INSERT INTO ${type}_items (${type}) VALUES (?)`,
            [item]
          );
        }
      }
    } else {
      await connect_SQL.query("TRUNCATE TABLE aging_items");
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT title FROM aging_items WHERE title = ?`,
          [item.title]
        );

        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            "INSERT INTO aging_items (firstValue, secondValue, title, type ) VALUES (?, ?, ?, ?)",
            [item.firstValue, item.secondValue, item.title, item.type]
          );
        }
      }
      // await FKRaport.updateOne(
      //   {},
      //   { $set: { "items.aging": aging } },
      //   { new: true, upsert: true }
      // );
    }

    res.end();
  } catch (error) {
    logEvents(`fkItemsData, saveItemsData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera unikalne nazwy działów z pliku księgowego
const getDepfromAccountancy = async (req, res) => {
  try {
    const [getDepartments] = await connect_SQL.query(
      "SELECT distinct DZIAL from documents ORDER BY DZIAL"
    );

    const departments = getDepartments.map((dep) => {
      return dep.DZIAL;
    });
    res.json(departments);
    // const result = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0,
    //       depData: "$preparedRaportData",
    //     },
    //   },
    // ]);

    // if (result[0].depData.length > 1) {
    //   let uniqueDepartments = [];
    //   result[0].depData.forEach((item) => {
    //     if (item.DZIAL && typeof item.DZIAL === "string") {
    //       if (!uniqueDepartments.includes(item.DZIAL)) {
    //         uniqueDepartments.push(item.DZIAL);
    //       }
    //     }
    //   });
    //   console.log(uniqueDepartments.sort());
    //   res.json({
    //     departments: uniqueDepartments.sort(),
    //   });
    // } else {
    //   res.json({
    //     departments: [],
    //   });
    // }
  } catch (error) {
    logEvents(
      `fkItemsData, getDepfromAccountancy: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
const savePreparedItems = async (req, res) => {
  const { department, localization, area, owner, guardian } = req.body;
  try {
    const [duplicate] = await connect_SQL.query(
      "SELECT department FROM join_items WHERE department = ?",
      [department]
    );
    if (duplicate[0]?.department) {
      await connect_SQL.query(
        "UPDATE join_items SET localization = ?, area = ?, owner = ?, guardian = ? WHERE department = ?",
        [
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
          department,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO join_items (department, localization, area, owner, guardian) VALUES (?, ?, ?, ?, ?)",
        [
          department,
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
        ]
      );
    }
    // await FKRaport.updateOne(
    //   {},
    //   { $set: { preparedItemsData: dataItems } },
    //   { new: true, upsert: true }
    // );
    res.end();
  } catch (error) {
    logEvents(`fkItemsData, savePrepareItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobierająca kpl owner, dział, lokalizacja dla "Dopasuj dane"
const getPreparedItems = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItemsData: 1, // Włączamy tylko pole preparedItemsData
        },
      },
    ]);

    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );

    // console.log(preparedItems);
    res.json(preparedItems);
    // res.json(result);
  } catch (error) {
    logEvents(`fkItemsData, savePrepareItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funckja zapisujaca zmianę pojedyńczego itema np. ownera, wykonuje również zmianę w preparedItemsData
const saveItem = async (req, res) => {
  const { info } = req.params;
  const { departments, localizations, areas, owners, guardians, aging } =
    req.body;
  // Mapowanie nazw na odpowiadające im klucze
  // console.log(info);
  // console.log(departments, localizations, areas, owners, guardians, aging);

  const dataMap = {
    departments,
    localizations,
    areas,
    owners,
    guardians,
    aging,
  };

  const variableItem = {
    departments: "department",
    localizations: "localization",
    areas: "area",
    owners: "owner",
    guardians: "guardian",
  };
  try {
    if (info !== "aging") {
      const result = await FKRaport.aggregate([
        {
          $project: {
            _id: 0,
            data: "$items",
          },
        },
      ]);

      const itemsData = result[0].data[info];
      const updatedItemsData = itemsData.map((item) => {
        if (item === dataMap[info].oldName) {
          return dataMap[info].newName;
        }
        return item;
      });

      await FKRaport.updateOne(
        {},
        { $set: { [`items.${info}`]: updatedItemsData } },
        { new: true, upsert: true }
      );

      const resultItems = await FKRaport.aggregate([
        {
          $project: {
            _id: 0, // Wyłączamy pole _id z wyniku
            preparedItemsData: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
          },
        },
      ]);

      const preparedItemsData = [...resultItems[0].preparedItemsData];
      const updateItems = preparedItemsData.map((item) => {
        if (info === "owners" || info === "guardians") {
          // Jeśli tak, przeiteruj przez każdy element tablicy
          item[variableItem[info]].forEach((value, index) => {
            // Sprawdź, czy wartość jest równa dataMap[info].oldName
            if (value === dataMap[info].oldName) {
              // Jeśli tak, zaktualizuj wartość na dataMap[info].newName
              item[variableItem[info]][index] = dataMap[info].newName;
            }
          });
        } else {
          if (item[variableItem[info]] === dataMap[info].oldName) {
            return {
              ...item,
              [variableItem[info]]: dataMap[info].newName,
            };
          }
        }
        return item;
      });

      await FKRaport.updateOne(
        {},
        { $set: { preparedItemsData: updateItems } },
        { new: true, upsert: true }
      );
    } else {
      await FKRaport.updateOne(
        {},
        { $set: { "items.aging": aging } },
        { new: true, upsert: true }
      );
    }

    res.end();
  } catch (error) {
    logEvents(`fkItemsData, saveItem: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getDataItems,
  saveItemsData,
  getFKSettingsItems,
  getDepfromAccountancy,
  savePreparedItems,
  getPreparedItems,
  saveItem,
};
