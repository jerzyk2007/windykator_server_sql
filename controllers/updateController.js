const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const {
  updateData,
  updateDocuments,
  updateSettlementDescription,
  addDocumentToDatabase,
  updateDocZal,
  updateCarReleaseDates,
  updateSettlements,
  updateSettlementDescriptionCompany,
} = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
// const { getAccountancyDataMsSQL } = require("./fkRaportController");
const {
  prepareRac,
  copy_fk_raport_KRT,
  checkAccountancyData,
} = require("./repairDataController");
const {
  getAccountancyDataMsSQL,
  generateRaportCompany,
  generateRaportData,
  getMainRaportFK,
} = require("./generateRaportFK");

const getTime = async (req, res) => {
  try {
    // await updateData();
    // await updateSettlementDescription();
    // await generateHistoryDocuments('KRT');
    // await copyDbtoDB();

    // await addDocToHistory();
    // await getAccountancyDataMsSQL('KRT', 1);
    // await getAccountancyDataMsSQL('KEM', 1);

    // await prepareRac();

    // await copy_fk_raport_KRT();

    // await generateRaportData();
    // await getMainRaportFK();
    // console.log("generateRaportData");

    // await checkAccountancyData();

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
