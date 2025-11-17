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

//szukam czy jakiś user ma role Root

const createLawTable = async () => {
  try {
    await connect_SQL.query(
      "CREATE TABLE company_law_documents (  id_company_law_documents INT NOT NULL AUTO_INCREMENT, NUMER_FV VARCHAR(50) NOT NULL, KONTRAHENT VARCHAR(250) NOT NULL, DATA_PRZEKAZANIA DATE NOT NULL DEFAULT (CURRENT_DATE), NAZWA_KANCELARII VARCHAR(50) NOT NULL, PRIMARY KEY (id_company_law_documents), UNIQUE (NUMER_FV))"
    );
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
    const roles = {
      Start: 1,
      User: 100,
      Editor: 110,
      Controller: 120,
      DNiKN: 150,
      FK_KRT: 200,
      FK_KEM: 201,
      FK_RAC: 202,
      Nora: 300,
      Raports: 400,
      LawPartner: 500,
      Admin: 1000,
      SuperAdmin: 2000,
    };
    await connect_SQL.query(
      "UPDATE company_settings SET permissions = ?,  roles = ?",
      [JSON.stringify(["Pracownik", "Kancelaria"]), JSON.stringify(roles)]
    );
  } catch (error) {
    console.error(error);
  }
};

const deleteDepartmentsColumn = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_settings CHANGE COLUMN departments EXT_COMPANY JSON, CHANGE COLUMN roles ROLES JSON, CHANGE COLUMN columns COLUMNS JSON, CHANGE COLUMN permissions PERMISSIONS JSON, CHANGE COLUMN target TARGET JSON, CHANGE COLUMN company COMPANY JSON"
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
      "ALTER TABLE company_table_columns CHANGE COLUMN description EMPLOYEE VARCHAR(45),  CHANGE COLUMN accessorKey ACCESSOR_KEY VARCHAR(45), CHANGE COLUMN header HEADER VARCHAR(45), CHANGE COLUMN filterVariant FILTER_VARIANT VARCHAR(45), CHANGE COLUMN type TYPE VARCHAR(45), CHANGE COLUMN areas AREAS JSON"
    );
    await connect_SQL.query(`
      UPDATE company_table_columns
      SET EMPLOYEE = 'Pracownik'
    `);

    const [columns] = await connect_SQL.query(
      "SELECT * FROM company_table_columns"
    );
    for (col of columns) {
      const uniqueAreas = [];
      const seen = new Set();

      for (const area of col.AREAS) {
        if (!seen.has(area.name)) {
          seen.add(area.name);
          // tworzymy nowy obiekt bez 'hide'
          const { hide, ...rest } = area;
          uniqueAreas.push(rest);
        }
      }

      col.AREAS = uniqueAreas;

      await connect_SQL.query(
        "UPDATE company_table_columns SET AREAS = ? where id_table_columns = ?",
        [JSON.stringify(col.AREAS), col.id_table_columns]
      );
    }

    // usuń UQ z ACCESSOR_KEY
    await connect_SQL.query(
      "ALTER TABLE company_table_columns DROP INDEX `accessorKey_UNIQUE`"
    );

    // -- 1️⃣ nadaj unikalność kolumnie id_table_columns
    await connect_SQL.query(
      "ALTER TABLE company_table_columns ADD CONSTRAINT uq_id_table_columns UNIQUE (id_table_columns)"
    );

    // -- 2️⃣ dodaj unikalność pary (EMPLOYEE, ACCESSOR_KEY)
    await connect_SQL.query(
      "ALTER TABLE company_table_columns ADD CONSTRAINT uq_employee_accessor UNIQUE (EMPLOYEE, ACCESSOR_KEY)"
    );

    // -- 3️⃣ dodaj unikalność pary (EMPLOYEE, HEADER)
    await connect_SQL.query(
      "ALTER TABLE company_table_columns ADD CONSTRAINT uq_employee_header UNIQUE (EMPLOYEE, HEADER)"
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

    const extCompany = ["Kancelaria Krotoski", "Krauze"];

    await connect_SQL.query(
      "UPDATE company_settings SET COLUMNS = ?, EXT_COMPANY = ? WHERE id_setting = 1",
      [JSON.stringify(newColumns), JSON.stringify(extCompany)]
    );
  } catch (error) {
    console.error(error);
  }
};

const update_table_setiings = async () => {
  try {
    const tableLawPartnerSettings = {
      size: {},
      order: ["mrt-row-spacer"],
      pinning: {
        left: [],
        right: [],
      },
      visible: {},
      pagination: {
        pageSize: 50,
        pageIndex: 0,
      },
    };
    const [userTableSettings] = await connect_SQL.query(
      "SELECT id_user, tableSettings FROM company_users"
    );
    for (const user of userTableSettings) {
      user.tableSettings["Kancelaria"] = tableLawPartnerSettings;

      await connect_SQL.query(
        "UPDATE company_users SET tableSettings = ? WHERE id_user = ?",
        [JSON.stringify(user.tableSettings), user.id_user]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const rebuildDataBase = async () => {
  try {
    await createLawTable();
    await deleteBasicUsers();
    await changeTypeColumnPermissions();
    await changeUserTable();
    //
    //
    await changePermissionsTableSettings();
    await deleteDepartmentsColumn();
    await company_password_resets_Change();
    await company_fk_raport_excel_Change();
    await company_table_columns_Change();
    await company_setting_columns();
    await update_table_setiings();
    console.log("finish");
  } catch (error) {
    console.error(error);
  }
};

//tworzenie relacje pomiędzy tabelami SQL
const createTableRelations = async () => {
  try {
    // relacja dla tabeli company_documents i company_documents_actions
    await connect_SQL.query(
      "ALTER TABLE company_documents_actions ADD CONSTRAINT fk_company_documents_actions_documents FOREIGN KEY (document_id) REFERENCES company_documents(id_document) ON DELETE CASCADE ON UPDATE CASCADE"
    );
  } catch (error) {
    console.error(error);
  }
};

// dodaję testow dane do tabeli company_law_documents
const addDataToLawDocuments = async () => {
  try {
    const data = [
      {
        NUMER_FV: "FV/UBL/671/25/A/D8",
        KONTRAHENT:
          "PRZEDSIĘBIORSTWO PRZEMYSŁOWO-HANDLOWE 'HETMAN' SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
      },
      {
        NUMER_FV: "FV/WS/20/24/V/D8",
        KONTRAHENT: "JYOTI TEXTILES PARVENDRA SINGH BHATI",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
      },
      {
        NUMER_FV: "FV/AN/516/25/A/D1",
        KONTRAHENT:
          "VOLKSWAGEN FINANCIAL SERVICES POLSKA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
      },
      {
        NUMER_FV: "FV/UBL/1142/25/A/D8",
        KONTRAHENT:
          'JACEK TULIŃSKI "TULIPAN" FIRMA HANDLOWO-USŁUGOWO-PRODUKCYJNA',
        NAZWA_KANCELARII: "Kancelaria Krotoski",
      },
      {
        NUMER_FV: "FV/UBL/232/25/S/D8",
        KONTRAHENT: "Pietrzykowska-Dudek Lidia",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
      },
    ];

    for (const doc of data) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_law_documents (NUMER_FV, KONTRAHENT, NAZWA_KANCELARII) VALUES (?, ?, ?)",
        [doc.NUMER_FV, doc.KONTRAHENT, doc.NAZWA_KANCELARII]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await addDataToLawDocuments();
    // await rebuildDataBase();
    // console.log("repair");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
