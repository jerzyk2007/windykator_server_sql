const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { updateData, updateDocuments, updateSettlementDescription, addDocumentToDatabase, updateDocZal, updateCarReleaseDates, updateSettlements, updateSettlementDescriptionCompany } = require("./getDataFromMSSQL");
const { testMail } = require("./mailController");
// const { getAccountancyDataMsSQL } = require("./fkRaportController");
const { addDocToHistory, getOwnersMail, prepareToNewCompany } = require("./repairDataController");
const { getAccountancyDataMsSQL, generateRaportCompany } = require("./generateRaportFK");

const getTime = async (req, res) => {
  try {
    // await updateData();
    // await updateSettlementDescription();
    // await generateHistoryDocuments('KRT');
    // await copyDbtoDB();

    // await addDocToHistory();
    // await getAccountancyDataMsSQL('KRT', 1);
    // await getAccountancyDataMsSQL('KEM', 1);

    // await createAccounts();

    // await generateRaportCompany('KRT');

    // await getOwnersMail('KRT');


    // await addDocumentToDatabase("KEM");

    // await updateSettlements();

    // await updateSettlementDescriptionCompany('KEM');

    // await prepareToNewCompany();


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
