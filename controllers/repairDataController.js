const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const { generatePassword, documentsType } = require("./manageDocumentAddition");
const { addDepartment } = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");

const createLawTable = async () => {
  try {
    //  await connect_SQL.query(
    //   "CREATE TABLE company_fk_settlements (  id_company_fk_settlements INT NOT NULL AUTO_INCREMENT,   NUMER_FV VARCHAR(255) NOT NULL,   DO_ROZLICZENIA DECIMAL(12,2) NOT NULL,   FIRMA VARCHAR(10) NOT NULL,   PRIMARY KEY (id_company_fk_settlements),   UNIQUE (id_company_fk_settlements))"
    // );
  } catch (error) {
    console.error(error);
  }
};

const changeOldUserPewrmissions = async () => {
  try {
    const permissions = { Pracownik: true, Kancelaria: false };

    await connect_SQL.query("UPDATE company_users SET permissions = ? ", [
      JSON.stringify(permissions),
    ]);
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    const companies = ["KRT", "KEM", "RAC"];

    // await addRoleRaports();

    // await getOwnersMail("KRT");

    // await generateHistoryDocuments("KRT");

    // await checkHistory();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repairAdvisersName,
  createAccounts,
  generatePassword,
  repairManagementDecision,
  repair,
};
