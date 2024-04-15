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
      localization: result[0].data.localization,
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
  const { type } = req.params;
  const { departments, localization, areas, owners, guardians, aging } =
    req.body;
  try {
    if (type === "departments") {
      const result = await FKRaport.updateOne(
        {},
        { $set: { "items.departments": departments } },
        { new: true, upsert: true }
      );
    } else if (type === "localization") {
      const result = await FKRaport.updateOne(
        {},
        { $set: { "items.localization": localization } },
        { new: true, upsert: true }
      );
    } else if (type === "areas") {
      const result = await FKRaport.updateOne(
        {},
        { $set: { "items.areas": areas } },
        { new: true, upsert: true }
      );
    } else if (type === "owners") {
      const result = await FKRaport.updateOne(
        {},
        { $set: { "items.owners": owners } },
        { new: true, upsert: true }
      );
    } else if (type === "guardians") {
      const result = await FKRaport.updateOne(
        {},
        { $set: { "items.guardians": guardians } },
        { new: true, upsert: true }
      );
    } else if (type === "aging") {
      const result = await FKRaport.updateOne(
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
          FKAccountancy: "$data.FKAccountancy",
        },
      },
    ]);

    let uniqueDepartments = [];
    result[0].FKAccountancy.forEach((item) => {
      if (item.DZIAL && typeof item.DZIAL === "string") {
        if (!uniqueDepartments.includes(item.DZIAL)) {
          uniqueDepartments.push(item.DZIAL);
        }
      }
    });

    res.json({
      departments: uniqueDepartments.sort(),
    });
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

module.exports = {
  getDataItems,
  saveItemsData,
  getFKSettingsItems,
  getDepfromAccountancy,
  savePreparedItems,
  getPreparedItems,
};
