const FKRaport = require("../model/FKRaport");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów
const getDataItems = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0,
          data: "$items",
        },
      },
    ]);

    res.json({
      data: result[0].data,
    });
    res.end();
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

    res.json({
      departments: result[0].data.departments,
      areas: result[0].data.areas,
      localizations: result[0].data.localizations,
      owners: result[0].data.owners,
      guardians: result[0].data.guardians,
    });
    res.end();
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

  try {
    if (info !== "aging") {
      await FKRaport.updateOne(
        {},
        { $set: { [`items.${info}`]: dataMap[info] } },
        { new: true, upsert: true }
      );
    } else {
      console.log(aging);
      await FKRaport.updateOne(
        {},
        { $set: { "items.aging": aging } },
        { new: true, upsert: true }
      );
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
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0,
          depData: "$preparedRaportData",
        },
      },
    ]);

    if (result[0].depData.length > 1) {
      let uniqueDepartments = [];
      result[0].depData.forEach((item) => {
        if (item.DZIAL && typeof item.DZIAL === "string") {
          if (!uniqueDepartments.includes(item.DZIAL)) {
            uniqueDepartments.push(item.DZIAL);
          }
        }
      });

      res.json({
        departments: uniqueDepartments.sort(),
      });
    } else {
      res.json({
        departments: [],
      });
    }
  } catch (error) {
    logEvents(
      `fkItemsData, getDepfromAccountancy: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const savePreparedItems = async (req, res) => {
  const { dataItems } = req.body;
  try {
    const result = await FKRaport.updateOne(
      {},
      { $set: { preparedItemsData: dataItems } },
      { new: true, upsert: true }
    );
  } catch (error) {
    logEvents(`fkItemsData, savePrepareItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

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

    res.json(result);
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
      console.log("aging");
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
