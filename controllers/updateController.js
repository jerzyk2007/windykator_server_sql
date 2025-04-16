const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkFKDocuments, repairRoles, repairColumnsRaports, createAccounts, generatePassword, repairHistory, repairManagementDecisionFK, usersDepartmentsCompany } = require("./repairDataController");
const { updateData, updateSettlements, updateSettlementDescription, updateDocZal, updateCarReleaseDates } = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
const { generateHistoryDocument } = require("./fkRaportController");

const getTime = async (req, res) => {
  try {
    // await updateData();
    // await updateSettlementDescription();
    // await updateDocZal();
    // await changeUserSettings();
    // await updateCarReleaseDates();
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

    const [getUpdatesData] = await connect_SQL.query(
      "SELECT data_name, date,  hour, update_success FROM updates"
    );
    res.json(getUpdatesData);
  } catch (error) {
    logEvents(`updateController, getTime: ${error}`, "reqServerErrors.txt");
  }
};

module.exports = {
  getTime,
};
