const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");
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

//szukam czy jakiś user ma role Root

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
const deleteBasicUsers = async () => {
  try {
    const [users] = await connect_SQL.query("SELECT * FROM company_users");
    for (const user of users) {
      if (user.permissions.Basic) {
        await connect_SQL.query("DELETE FROM company_users WHERE id_user = ?", [
          user.id_user,
        ]);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// zmiana typu kolumny permissions
const changeTypeColumnPermissions = async () => {
  try {
    await connect_SQL.query(
      'ALTER TABLE company_users MODIFY COLUMN permissions VARCHAR(45) NOT NULL DEFAULT "Pracownik"'
    );
    await connect_SQL.query(
      'UPDATE company_users SET permissions = "Pracownik"'
    );
  } catch (error) {
    console.error(error);
  }
};

// zmiana kolumn tableSettings, raportSettings, departments, columns
const changeUserTable = async () => {
  try {
    const [users] = await connect_SQL.query("SELECT * FROM company_users");
    for (const user of users) {
      const tableSettings = {
        Pracownik: user.tableSettings,
        Kancelaria: {},
      };
      const raportSettings = {
        Pracownik: user.raportSettings,
        Kancelaria: {},
      };
      const departments = {
        Pracownik: [...user.departments],
        Kancelaria: [],
      };
      const columns = {
        Pracownik: [...user.columns],
        Kancelaria: [],
      };
      await connect_SQL.query(
        "UPDATE company_users SET tableSettings = ?, raportSettings = ?, departments = ?, columns = ? WHERE id_user = ?",
        [
          JSON.stringify(tableSettings),
          JSON.stringify(raportSettings),
          JSON.stringify(departments),
          JSON.stringify(columns),
          user.id_user,
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const changePermissionsTableSettings = async () => {
  try {
    await connect_SQL.query("UPDATE company_settings SET permissions = ?", [
      JSON.stringify(["Pracownik", "Kancelaria"]),
    ]);
  } catch (error) {
    console.error(error);
  }
};

const deleteDepartmentsColumn = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_settings DROP COLUMN departments, CHANGE COLUMN roles ROLES JSON, CHANGE COLUMN columns COLUMNS JSON, CHANGE COLUMN permissions PERMISSIONS JSON, CHANGE COLUMN target TARGET JSON, CHANGE COLUMN company COMPANY JSON"
    );
  } catch (error) {
    console.error(error);
  }
};

const company_password_resets_Change = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_password_resets CHANGE COLUMN email EMAIL VARCHAR(255), CHANGE COLUMN token TOKEN VARCHAR(255), CHANGE COLUMN created_at CREATED_AT TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP"
    );
  } catch (error) {
    console.error(error);
  }
};

const company_fk_raport_excel_Change = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_fk_raport_excel CHANGE COLUMN company COMPANY VARCHAR(45), CHANGE COLUMN data DATA JSON"
    );
  } catch (error) {
    console.error(error);
  }
};

const company_table_columns_Change = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_table_columns DROP COLUMN description, CHANGE COLUMN accessorKey ACCESSOR_KEY VARCHAR(45), CHANGE COLUMN header HEADER VARCHAR(45), CHANGE COLUMN filterVariant FILTER_VARIANT VARCHAR(45), CHANGE COLUMN type TYPE VARCHAR(45), CHANGE COLUMN areas AREAS JSON"
    );
  } catch (error) {
    console.error(error);
  }
};

const company_setting_columns = async () => {
  try {
    const [changeColumns] = await connect_SQL.query(
      "SELECT COLUMNS FROM company_settings"
    );

    const newColumns = {
      PRACOWNIK: changeColumns[0].COLUMNS,
      KANCELARIA: [],
    };

    await connect_SQL.query(
      "UPDATE company_settings SET COLUMNS = ? WHERE id_setting = 1",
      [JSON.stringify(newColumns)]
    );
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // zmiana tabeli company_users
    // await deleteBasicUsers();
    // await changeTypeColumnPermissions();
    // await changeUserTable();
    // //
    // //
    // await changePermissionsTableSettings();
    // await deleteDepartmentsColumn();
    // await company_password_resets_Change();
    // await company_fk_raport_excel_Change();
    // await company_table_columns_Change();
    // await company_setting_columns();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
