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
const { syncColumns } = require("./tableController");

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

const changeSettingsPermissions = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_settings DROP COLUMN `COLUMNS`"
    );
    const [settings] = await connect_SQL.query(
      "SELECT * FROM company_settings WHERE id_setting = 1"
    );
    const permissions = [...settings[0].PERMISSIONS, "Koordynator"];
    // const permissions = ["Pracownik", "Kancelaria", "Polisy", "Koordynator"];
    await connect_SQL.query(
      "UPDATE company_settings SET PERMISSIONS = ? WHERE id_setting = 1",
      [JSON.stringify(permissions)]
    );
  } catch (error) {
    console.error(error);
  }
};

const changeUserColumnsTableSettings = async () => {
  try {
    const [users] = await connect_SQL.query("SELECT * FROM company_users");
    for (const user of users) {
      const tableSettings = user.tableSettings;
      tableSettings.Kancelaria = {
        size: {},
        order: ["mrt-row-spacer"],
        pinning: { left: [], right: [] },
        visible: {},
        pagination: {
          pageSize: 30,
          pageIndex: 0,
        },
      };
      tableSettings.Polisy = {
        size: {},
        order: ["mrt-row-spacer"],
        pinning: { left: [], right: [] },
        visible: {},
        pagination: {
          pageSize: 30,
          pageIndex: 0,
        },
      };
      tableSettings.Koordynator = {
        size: {},
        order: ["mrt-row-spacer"],
        pinning: { left: [], right: [] },
        visible: {},
        pagination: {
          pageSize: 30,
          pageIndex: 0,
        },
      };
      const raportSettings = user.raportSettings;
      raportSettings.Kancelaria = {};
      raportSettings.Polisy = {};
      raportSettings.Koordynator = {};

      const columns = user.columns;
      columns.Kancelaria = [];
      columns.Polisy = [];
      columns.Koordynator = [];

      const departments = user.departments;
      departments.Polisy = [];
      departments.Koordynator = [];

      await connect_SQL.query(
        "UPDATE company_users SET tableSettings = ?, raportSettings = ?, columns = ?, departments = ? WHERE id_user = ?",
        [
          JSON.stringify(tableSettings),
          JSON.stringify(raportSettings),
          JSON.stringify(columns),
          JSON.stringify(departments),
          user.id_user,
        ]
      );
    }

    const [permissions] = await connect_SQL.query(
      "SELECT PERMISSIONS FROM company_settings"
    );
    for (const permission of permissions[0].PERMISSIONS) {
      await syncColumns(permission);
    }
  } catch (error) {
    console.error(error);
  }
};

const changePartnerColumn = async () => {
  try {
    const [columns] = await connect_SQL.query(
      'SELECT * FROM company_table_columns WHERE EMPLOYEE = "Kancelaria"'
    );
    for (const column of columns) {
      if (column.ACCESSOR_KEY === "CZAT_KANCELARIA") {
        await connect_SQL.query(
          `UPDATE company_table_columns SET ACCESSOR_KEY = "KANAL_KOMUNIKACJI" WHERE id_table_columns = ?`,
          [column.id_table_columns]
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
    // await changeSettingsPermissions();
    // console.log("changeSettingsPermissions");
    // await changeUserColumnsTableSettings();
    // console.log("changeUserColumnsTableSettings");
    // await changePartnerColumn();
    // console.log("changePartnerColumn");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
