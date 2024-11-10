const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { updateData } = require("./getDataFromMSSQL");

const getTime = async (req, res) => {
  try {
    // await updateData();
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT data_name, date,TIME_FORMAT(hour, '%H:%i') as hour, success FROM updates"
    );
    res.json(getUpdatesData);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
    console.error(error);
    // res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getTime,
};
