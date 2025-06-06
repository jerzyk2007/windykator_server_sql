const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkFKDocuments, repairRoles, repairColumnsRaports, createAccounts, generatePassword, repairHistory, repairManagementDecisionFK, usersDepartmentsCompany, testAddDocumentToDatabase } = require("./repairDataController");
const { updateData, updateDocuments, updateSettlementDescription } = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
const { generateHistoryDocuments } = require("./fkRaportController");
const { addDocToHistory } = require("./repairDataController");

const getTime = async (req, res) => {
  try {
    // await updateData();
    // await updateSettlementDescription();
    // await generateHistoryDocuments('KRT');
    // await copyDbtoDB();

    // await addDocToHistory();

    // await createAccounts();

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
