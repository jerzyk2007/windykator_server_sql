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
// const getDataItems = async (req, res) => {
//   try {
//     const result = await FKRaport.aggregate([
//       {
//         $project: {
//           _id: 0,
//           FKAccountancy: "$data.FKAccountancy",
//         },
//       },
//     ]);

//     let uniqueDepartments = [];
//     result[0].FKAccountancy.forEach((item) => {
//       if (item.DZIAL && typeof item.DZIAL === "string") {
//         if (!uniqueDepartments.includes(item.DZIAL)) {
//           uniqueDepartments.push(item.DZIAL);
//         }
//       }
//     });

//     res.json({
//       data: {
//         departments: uniqueDepartments.sort(),
//         areas: "ok",
//       },
//     });
//   } catch (error) {
//     logEvents(`fkItemsData, getDataItems: ${error}`, "reqServerErrors.txt");
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

//funckja zapisujaca działy, ownerów, lokalizacje
const saveItemsData = async (req, res) => {
  const { type } = req.params;
  const { departments, localization } = req.body;
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
    }

    console.log(type);

    res.end();
  } catch (error) {
    logEvents(`fkItemsData, saveItemsData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getDataItems,
  saveItemsData,
};
