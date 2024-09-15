const UpdateDB = require("../model/UpdateDB");
const { logEvents } = require("../middleware/logEvents");

const getTime = async (req, res) => {
  try {
    const result = await UpdateDB.findOne({}, { date: 1 }).exec();
    console.log(result);
    res.json(result.date);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getTime,
};
