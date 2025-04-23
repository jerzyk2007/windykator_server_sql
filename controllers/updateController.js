const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkFKDocuments, repairRoles, repairColumnsRaports, createAccounts, generatePassword, repairHistory, repairManagementDecisionFK, usersDepartmentsCompany, testAddDocumentToDatabase } = require("./repairDataController");
const { updateData, updateDocuments } = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
const { generateHistoryDocuments } = require("./fkRaportController");
const { allUpdate } = require("./copyDBtoDB");

const getTime = async (req, res) => {
  try {
    // await updateData();

    // await generateHistoryDocuments('KRT');

    // await allUpdate();

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
