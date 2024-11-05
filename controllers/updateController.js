const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

const getTime = async (req, res) => {
  try {
    const [getDate] = await connect_SQL.query(
      "SELECT settlements FROM updates"
    );
    res.json(getDate[0].settlements);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getTime,
};
