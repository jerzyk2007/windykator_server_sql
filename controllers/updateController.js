const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkFKDocuments, repairRoles, repairColumnsRaports, createAccounts, generatePassword, repairHistory, repairManagementDecisionFK, usersDepartmentsCompany, testAddDocumentToDatabase } = require("./repairDataController");
const { updateData, updateDocuments } = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
const { generateHistoryDocument } = require("./fkRaportController");

const getTime = async (req, res) => {
  try {
    // await updateData();

    // await updateDocuments();
    // await updateSettlementDescription();
    // await updateDocZal();
    // await changeUserSettings();
    // await checkFKDocuments();
    // await repairRoles();
    // await repairColumnsRaports();
    // await createAccounts();
    // testMail();
    // await generatePassword();
    // await repairHistory();
    // await generateHistoryDocuments();
    // await repairManagementDecisionFK();
    // await usersDepartmentsCompany();

    // await updateDocZal();
    // await updateCarReleaseDates();

    // await addDocumentToDatabase();

    // await testAddDocumentToDatabase();
    // await updateDataKEM();

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
