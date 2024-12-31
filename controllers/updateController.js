const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { updateSettlementsTest, repairDocumentDB, changeUserSettings } = require("./repairDataController");
const { updateData, updateSettlements, updateSettlementDescription, updateDocZal, updateCarReleaseDates } = require("./getDataFromMSSQL");

const getTime = async (req, res) => {
  try {
    // await updateSettlementsTest();
    // await repairDocumentDB();
    // await updateData();
    // await updateSettlementDescription();
    // await updateDocZal();
    // await changeUserSettings();
    // await updateCarReleaseDates();
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT data_name, date,  hour, update_success FROM updates"
    );
    res.json(getUpdatesData);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
    // console.error(error);
    // res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getTime,
};
