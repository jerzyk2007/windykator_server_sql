const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const {
  generatePassword,
  documentsType,
  addDepartment,
} = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");

const { updateSettlementDescription } = require("./getDataFromMSSQL");

//zebrane kawałki kodu, nieużywac funkcji
const test = async () => {
  await connect_SQL.query(
    "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
  );
};

// zmiana w yablei z polisami, dodaję kolumnę Firma
const changeInsuranceTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_insurance_documents  ADD COLUMN FIRMA VARCHAR(45) NULL AFTER DZIAL"
    );

    await connect_SQL.query(
      ' UPDATE company_insurance_documents SET FIRMA = "KRT"'
    );
  } catch (error) {
    console.error(error);
  }
};

const changUserTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_users  ADD COLUMN company JSON NULL AFTER roles"
    );
    const [users] = await connect_SQL.query("SELECT * FROM company_users");
    for (const user of users) {
      if (user?.roles?.Insurance || user?.roles?.LawPartner) {
        await connect_SQL.query(
          "UPDATE company_users SET company = ? WHERE id_user = ?",
          [JSON.stringify(["KRT"]), user.id_user]
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await changeInsuranceTable();
    // console.log("changeInsuranceTable");
    // await changUserTable();
    // console.log("changUserTable");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
