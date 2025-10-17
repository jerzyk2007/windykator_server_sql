const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { updateData } = require("./getDataFromMSSQL");
const { repair } = require("./repairDataController");
const { getRaportArea } = require("./raportsController");

const getTime = async (req, res) => {
  try {
    // await updateData();

    await repair();

    // await getRaportArea();

    const [getUpdatesData] = await connect_SQL.query(
      "SELECT DATA_NAME, DATE, HOUR, UPDATE_SUCCESS FROM company_updates"
    );
    res.json(getUpdatesData);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
  }
};

module.exports = {
  getTime,
};
