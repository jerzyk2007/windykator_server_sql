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

//szukam czy jakiś user ma role Root
const searchRootUser = async () => {
  try {
    const [users] = await connect_SQL.query("SELECT * FROM company_users");
    for (const user of users) {
      if (user.roles.Root) {
        console.log(user.userlogin);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const createLawTable = async () => {
  try {
    //  await connect_SQL.query(
    //   "CREATE TABLE company_fk_settlements (  id_company_fk_settlements INT NOT NULL AUTO_INCREMENT,   NUMER_FV VARCHAR(255) NOT NULL,   DO_ROZLICZENIA DECIMAL(12,2) NOT NULL,   FIRMA VARCHAR(10) NOT NULL,   PRIMARY KEY (id_company_fk_settlements),   UNIQUE (id_company_fk_settlements))"
    // );
  } catch (error) {
    console.error(error);
  }
};

// zmiana permissions w tabeli company_settings - dla zmian poz zewn kancelarie
const changePermissionsTableSettings = async () => {
  try {
    await connect_SQL.query("UPDATE company_settings SET permissions = ?", [
      JSON.stringify(["Pracownik", "Kancelaria"]),
    ]);
  } catch (error) {
    console.error(error);
  }
};

// nadanie wszytskim obecnym pracownikom dostępu dla wewn pracownika
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
    // await searchRootUser();

    // zewnętrzne kancelarie
    // await changePermissionsTableSettings();
    // await changeOldUserPewrmissions();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
