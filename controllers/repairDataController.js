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
    await connect_SQL.query(`
CREATE TABLE IF NOT EXISTS company_law_documents (
    id_document INT NOT NULL AUTO_INCREMENT,
    NUMER_DOKUMENTU VARCHAR(250) NOT NULL,
    KONTRAHENT VARCHAR(500) NOT NULL,
    NIP_NR VARCHAR(20) NULL,
    NAZWA_KANCELARII VARCHAR(50) NOT NULL,
    DATA_PRZYJECIA_SPRAWY DATE NULL,
    DATA_WYSTAWIENIA_DOKUMENTU DATE NULL,
    KWOTA_BRUTTO_DOKUMENTU DECIMAL(12,2) NOT NULL,
    ODDZIAL JSON NULL,
    OPIS_DOKUMENTU VARCHAR(250) NULL,
    FIRMA VARCHAR(45) NOT NULL,
    DATA_PRZEKAZANIA_SPRAWY DATE NULL,
    KWOTA_ROSZCZENIA_DO_KANCELARII DECIMAL(12,2) NOT NULL,
    CZAT_KANCELARIA JSON NULL,
    CZAT_LOGI JSON NULL,
    STATUS_SPRAWY VARCHAR(45)  NULL,
    SYGNATURA_SPRAWY VARCHAR(250)  NULL,
    TERMIN_PRZEDAWNIENIA_ROSZCZENIA DATE NULL,
    DATA_WYMAGALNOSCI_PLATNOSCI DATE NULL,
    WYDZIAL_SADU VARCHAR(250)  NULL,
    ORGAN_EGZEKUCYJNY VARCHAR(250)  NULL,
    SYGN_SPRAWY_EGZEKUCYJNEJ VARCHAR(250)  NULL,
    PRIMARY KEY (id_document),
    UNIQUE KEY unique_doc_firma (NUMER_DOKUMENTU)
);
`);
    //     await connect_SQL.query(`
    // CREATE TABLE IF NOT EXISTS company_law_documents_settlements (
    //    ********** id_document INT NOT NULL AUTO_INCREMENT,
    //    ********** NUMER_DOKUMENTU VARCHAR(250) NOT NULL,
    //    ********** WYKAZ_SPLACONEJ_KWOTY JSON NULL,
    //    ********** SUMA_SPLACONEJ_KWOTY DECIMAL(12,2) NULL,
    //     FIRMA VARCHAR(45) NOT NULL,
    //    **********   PRIMARY KEY (id_document),
    //    ********** UNIQUE KEY unique_doc_firma (NUMER_DOKUMENTU, FIRMA)
    // );
    // `);

    await connect_SQL.query(`
    CREATE TABLE IF NOT EXISTS company_law_documents_settlements (
        id_document_settlements INT NOT NULL AUTO_INCREMENT,
        NUMER_DOKUMENTU_FK VARCHAR(250) NOT NULL,
        WYKAZ_SPLACONEJ_KWOTY_FK JSON NULL,
        SUMA_SPLACONEJ_KWOTY_FK DECIMAL(12,2) NULL,
         FIRMA VARCHAR(45) NOT NULL,
        POZOSTALA_NALEZNOSC_FK DECIMAL(12,2) NULL,
          PRIMARY KEY (id_document_settlements),
            UNIQUE KEY unique_numer (NUMER_DOKUMENTU_FK)
    );
    `);

    await connect_SQL.query(`
    CREATE TABLE IF NOT EXISTS company_insurance_documents (
        id_document INT NOT NULL AUTO_INCREMENT,
        NUMER_POLISY VARCHAR(45) NOT NULL,
        DATA_WYSTAWIENIA DATE NOT NULL,
        UBEZPIECZYCIEL VARCHAR(45) NOT NULL,
        KONTRAHENT VARCHAR(500) NOT NULL,
        DZIAL VARCHAR(45) NOT NULL,
        DATA_PRZEKAZANIA DATE NOT NULL,
        FAKTURA_NR VARCHAR(45) NOT NULL,
        STATUS JSON NULL,
        OW DATE NULL,
        NIP VARCHAR(45) NULL,
        KWOTA_ROSZCZENIA DECIMAL(12,2) NOT NULL,
        OSOBA_ZLECAJACA_WINDYKACJE VARCHAR(45) NOT NULL,
        KONTAKT_DO_KLIENTA JSON NULL,
        NR_KONTA VARCHAR(45) NOT NULL,
        CZAT JSON NULL,
        LOGI_ZDARZEN JSON NULL,
          PRIMARY KEY (id_document),
            UNIQUE KEY unique_numer (NUMER_POLISY)
    );
    `);

    await connect_SQL.query(
      "ALTER TABLE company_law_documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci"
    );
    await connect_SQL.query(
      "ALTER TABLE company_law_documents_settlements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci"
    );

    await connect_SQL.query(
      "ALTER TABLE company_insurance_documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci"
    );
  } catch (error) {
    console.error(error);
  }
};

const createTriggers = async () => {
  try {
    await connect_SQL.query(
      "DROP TRIGGER IF EXISTS set_DATA_PRZEKAZANIA_SPRAWY"
    );

    await connect_SQL.query(`
CREATE TRIGGER set_DATA_PRZEKAZANIA_SPRAWY
BEFORE INSERT ON company_law_documents
FOR EACH ROW
BEGIN
    IF NEW.DATA_PRZEKAZANIA_SPRAWY IS NULL THEN
        SET NEW.DATA_PRZEKAZANIA_SPRAWY = CURDATE();
    END IF;
END
`);

    // 1. Usuń trigger, jeśli istnieje
    await connect_SQL.query("DROP TRIGGER IF EXISTS generate_NUMER_DOKUMENTU");

    // 2. Stwórz trigger
    await connect_SQL.query(`
CREATE TRIGGER generate_NUMER_DOKUMENTU
BEFORE INSERT ON company_law_documents
FOR EACH ROW
BEGIN
    IF NEW.NUMER_DOKUMENTU IS NULL OR NEW.NUMER_DOKUMENTU = '' THEN
        SET @last_noid = (
            SELECT CAST(SUBSTRING(NUMER_DOKUMENTU, 11) AS UNSIGNED)
            FROM company_law_documents
            WHERE NUMER_DOKUMENTU LIKE 'BRAK_NOID_%'
            ORDER BY CAST(SUBSTRING(NUMER_DOKUMENTU, 11) AS UNSIGNED) DESC
            LIMIT 1
        );

        IF @last_noid IS NULL THEN
            SET @last_noid = 1;
        ELSE
            SET @last_noid = @last_noid + 1;
        END IF;

        SET NEW.NUMER_DOKUMENTU = CONCAT('BRAK_NOID_', @last_noid);
    END IF;
END
`);
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
        Polisy: {},
      };
      const raportSettings = {
        Pracownik: user.raportSettings,
        Kancelaria: {},
        Polisy: {},
      };
      const departments = {
        Pracownik: [...user.departments],
        Kancelaria: [],
        Polisy: [],
      };
      const columns = {
        Pracownik: [...user.columns],
        Kancelaria: [],
        Polisy: [],
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
      Insurance: 350,
      Raports: 400,
      LawPartner: 500,
      Admin: 1000,
      SuperAdmin: 2000,
    };
    await connect_SQL.query(
      "UPDATE company_settings SET permissions = ?,  roles = ?",
      [
        JSON.stringify(["Pracownik", "Kancelaria", "Polisy"]),
        JSON.stringify(roles),
      ]
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

    // const extCompany = ["Kancelaria Krotoski", "Krauze"];
    const extCompany = ["Kancelaria Krotoski"];

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
      user.tableSettings["Polisy"] = tableLawPartnerSettings;

      await connect_SQL.query(
        "UPDATE company_users SET tableSettings = ? WHERE id_user = ?",
        [JSON.stringify(user.tableSettings), user.id_user]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const repairCompanyUpdatesTable = async () => {
  try {
    // const [getUpdatesData] = await connect_SQL.query(
    //   "SELECT DATA_NAME, DATE, HOUR, UPDATE_SUCCESS FROM company_updates"
    // );
    // const newItem = {
    //   DATA_NAME: "Wpłaty dla spraw w Kancelarii Krotoski.",
    //   DATE: "2025-11-24",
    //   HOUR: "06:32",
    //   UPDATE_SUCCESS: "",
    // };

    // const updateItems = [...getUpdatesData, newItem];

    // *********************
    await connect_SQL.query(
      "ALTER TABLE company_updates MODIFY COLUMN DATA_NAME VARCHAR(45) NOT NULL, ADD UNIQUE INDEX DATA_NAME_UNIQUE (DATA_NAME)"
    );
    console.log("repairCompanyUpdatesTable");
    await connect_SQL.query("TRUNCATE TABLE company_updates");

    const updateItems = [
      {
        DATA_NAME: "Faktury",
        DATE: "2025-11-24",
        HOUR: "06:32",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Wydania samochodów",
        DATE: "2025-11-24",
        HOUR: "06:32",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Rozrachunki",
        DATE: "2025-11-24",
        HOUR: "06:30",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Opisy rozrachunków",
        DATE: "2025-11-24",
        HOUR: "06:49",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Rozliczenia Symfonia",
        DATE: "2025-11-24",
        HOUR: "06:32",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Rubicon",
        DATE: "2025-11-24",
        HOUR: "06:56",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "BeCared",
        DATE: "2025-11-24",
        HOUR: "07:06",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Dokumenty Raportu FK - KRT",
        DATE: "2025-11-24",
        HOUR: "07:21",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Dokumenty Raportu FK - KEM",
        DATE: "2025-10-26",
        HOUR: "17:59",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
      {
        DATA_NAME: "Dokumenty Raportu FK - RAC",
        DATE: null,
        HOUR: null,
        UPDATE_SUCCESS: null,
      },
      {
        DATA_NAME: "Wpłaty dla spraw w Kancelarii Krotoski",
        DATE: "2025-11-27",
        HOUR: "11:18",
        UPDATE_SUCCESS: "Zaktualizowano.",
      },
    ];

    for (const doc of updateItems) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_updates (DATA_NAME, DATE, HOUR, UPDATE_SUCCESS) VALUES (?, ?, ?, ?)",
        [doc.DATA_NAME, doc.DATE, doc.HOUR, doc.UPDATE_SUCCESS]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const rebuildDataBase = async () => {
  try {
    // await createLawTable();
    // await createTriggers();
    // await deleteBasicUsers();
    // await changeTypeColumnPermissions();
    // await changeUserTable();
    //
    //
    // await changePermissionsTableSettings();
    // await deleteDepartmentsColumn();
    // await company_password_resets_Change();
    // await company_fk_raport_excel_Change();
    // await company_table_columns_Change();
    // await company_setting_columns();
    // await update_table_setiings();
    // await repairCompanyUpdatesTable();
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
  const chatLawPartner = [
    {
      profile: "Pracownik",
      date: "17-10-2025",
      username: "Kowalski",
      userlogin: "jan.kowalski@krotoski.com",
      note: "Zapłata nastąpi zgodnie z terminem płatności 24.11.2025 Sławomir Sołdon",
    },
    {
      profile: "Kancelaria",
      date: "18-10-2025",
      username: "Mickiewicz",
      userlogin: "adam.mickiewicz@kancelaria-krotoski.com",
      note: "Złożony wniosek o uzasadnienie wyroku.",
    },
    {
      profile: "Kancelaria",
      date: "29-10-2025",
      username: "Mickiewicz",
      userlogin: "adam.mickiewicz@kancelaria-krotoski.com",
      note: "Przekazałem uzasadnienie wyroku do jan.kowalski@krotoski.com",
    },
  ];

  try {
    const data = [
      {
        NUMER_DOKUMENTU: "FV/UBL/671/25/A/D8",
        OPIS_DOKUMENTU: null,
        KONTRAHENT:
          "PRZEDSIĘBIORSTWO PRZEMYSŁOWO-HANDLOWE 'HETMAN' SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
        DATA_PRZYJECIA_SPRAWY: null,
        DATA_WYSTAWIENIA_DOKUMENTU: "2025-06-26",
        KWOTA_BRUTTO_DOKUMENTU: 9098.71,
        ODDZIAL: {
          DZIAL: "D008",
          LOKALIZACJA: "Łódź Przybyszewskiego",
          OBSZAR: "BLACHARNIA",
        },
        FIRMA: "KRT",
        DATA_PRZEKAZANIA_SPRAWY: null,
        KWOTA_ROSZCZENIA_DO_KANCELARII: 6731.88,
        CZAT_KANCELARIA: null,
      },
      {
        NUMER_DOKUMENTU: null,
        OPIS_DOKUMENTU: "Polisa nr 123456, Hestia",
        KONTRAHENT:
          "ALEXAS CAR SERVICE SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
        DATA_PRZYJECIA_SPRAWY: null,
        DATA_WYSTAWIENIA_DOKUMENTU: null,
        KWOTA_BRUTTO_DOKUMENTU: 1000,
        ODDZIAL: {
          DZIAL: "D039",
          LOKALIZACJA: "Wolica",
          OBSZAR: "F&I",
        },
        FIRMA: "KRT",
        DATA_PRZEKAZANIA_SPRAWY: null,
        KWOTA_ROSZCZENIA_DO_KANCELARII: 112.11,
        CZAT_KANCELARIA: null,
      },
      {
        NUMER_DOKUMENTU: "FV/MN/20211/25/S/D7",
        OPIS_DOKUMENTU: null,
        KONTRAHENT:
          "AUTOKOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ SPÓŁKA KOMANDYTOWA",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
        DATA_PRZYJECIA_SPRAWY: null,
        DATA_WYSTAWIENIA_DOKUMENTU: "2025-11-19",
        KWOTA_BRUTTO_DOKUMENTU: 3508.84,
        ODDZIAL: {
          DZIAL: "D007",
          LOKALIZACJA: "Łódź Niciarniana",
          OBSZAR: "CZĘŚCI",
        },
        FIRMA: "KRT",
        DATA_PRZEKAZANIA_SPRAWY: null,
        KWOTA_ROSZCZENIA_DO_KANCELARII: 3508.84,
        CZAT_KANCELARIA: chatLawPartner,
      },
      {
        NUMER_DOKUMENTU: null,
        OPIS_DOKUMENTU: "kara umowna + odszkodowanie uzupełniające",
        KONTRAHENT: "Euro - Trans - Poland sp. z o.o.",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
        DATA_PRZYJECIA_SPRAWY: null,
        DATA_WYSTAWIENIA_DOKUMENTU: null,
        KWOTA_BRUTTO_DOKUMENTU: 872.11,

        ODDZIAL: {
          DZIAL: "D076",
          LOKALIZACJA: "Warszawa Radzymińska",
          OBSZAR: "SERWIS",
        },
        FIRMA: "KRT",
        DATA_PRZEKAZANIA_SPRAWY: null,
        KWOTA_ROSZCZENIA_DO_KANCELARII: 872.11,
        CZAT_KANCELARIA: null,
      },
      {
        NUMER_DOKUMENTU: "FV/UP/5298/18/D6",
        OPIS_DOKUMENTU: null,
        KONTRAHENT: "PHU WACAR ARKADIUSZ WAWRZYNIAK",
        NAZWA_KANCELARII: "Kancelaria Krotoski",
        DATA_PRZYJECIA_SPRAWY: null,
        DATA_WYSTAWIENIA_DOKUMENTU: "2019-04-03",
        KWOTA_BRUTTO_DOKUMENTU: 13931.59,

        ODDZIAL: {
          DZIAL: "D447",
          LOKALIZACJA: "Audi Białołęka",
          OBSZAR: "CZĘŚCI",
        },
        FIRMA: "KRT",
        DATA_PRZEKAZANIA_SPRAWY: null,
        KWOTA_ROSZCZENIA_DO_KANCELARII: 13931.59,
        CZAT_KANCELARIA: null,
      },
    ];

    for (const doc of data) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_law_documents (NUMER_DOKUMENTU, OPIS_DOKUMENTU, KONTRAHENT, NAZWA_KANCELARII, DATA_PRZYJECIA_SPRAWY, DATA_WYSTAWIENIA_DOKUMENTU, KWOTA_BRUTTO_DOKUMENTU, ODDZIAL, FIRMA, DATA_PRZEKAZANIA_SPRAWY, KWOTA_ROSZCZENIA_DO_KANCELARII, CZAT_KANCELARIA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.NUMER_DOKUMENTU,
          doc.OPIS_DOKUMENTU,
          doc.KONTRAHENT,
          doc.NAZWA_KANCELARII,
          doc.DATA_PRZYJECIA_SPRAWY,
          doc.DATA_WYSTAWIENIA_DOKUMENTU,
          doc.KWOTA_BRUTTO_DOKUMENTU,
          JSON.stringify(doc.ODDZIAL),
          doc.FIRMA,
          doc.DATA_PRZEKAZANIA_SPRAWY,
          JSON.stringify(doc.KWOTA_ROSZCZENIA_DO_KANCELARII),
          JSON.stringify(doc.CZAT_KANCELARIA) || null,
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const updateLawSettlements = async () => {
  try {
    // console.log("docs");

    // const [docs] = await connect_SQL.query(
    //   "SELECT distinct NUMER_DOKUMENTU FROM company_law_documents"
    // );
    // console.log(docs);

    const docs = [
      {
        "Numer dokumentu": "FV/MN/5673/18/D7",
      },
      {
        "Numer dokumentu": "KF/UP/78/19/D36",
      },
      {
        "Numer dokumentu": "FV/MN/2175/16/D57",
      },
      {
        "Numer dokumentu": "FV/MN/6540/18/D7",
      },
      {
        "Numer dokumentu": "109/08/RAC/2023",
      },
      {
        "Numer dokumentu": "121/05/RAC/2023",
      },
      {
        "Numer dokumentu": "126/08/RAC/2023",
      },
      {
        "Numer dokumentu": "130/06/RAC/2023",
      },
      {
        "Numer dokumentu": "134/07/RAC/2023",
      },
      {
        "Numer dokumentu": "136/06/RAC/2023",
      },
      {
        "Numer dokumentu": "138/07/RAC/2023",
      },
      {
        "Numer dokumentu": "dot. nadpłaty",
      },
      {
        "Numer dokumentu": "FC/UBL/238/23/A/D78",
      },
      {
        "Numer dokumentu": "FV/AN/169/19/PCS",
      },
      {
        "Numer dokumentu": "7/11/2019",
      },
      {
        "Numer dokumentu": "FV/4/12/19",
      },
      {
        "Numer dokumentu": "FV/AU/304/19/D54",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10248/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/10309/15/D8",
      },
      {
        "Numer dokumentu": "FV/BL/1184/15/D38",
      },
      {
        "Numer dokumentu": "FV/BL/1215/15/D38",
      },
      {
        "Numer dokumentu": "FV/BL/1233/19/23/A/D118",
      },
      {
        "Numer dokumentu": "FV/BL/125/09/D8",
      },
      {
        "Numer dokumentu": "FV/BL/1344/14/D8",
      },
      {
        "Numer dokumentu": "FV/BL/21/23/A/D118",
      },
      {
        "Numer dokumentu": "FV/BL/45/18/D78,",
      },
      {
        "Numer dokumentu": "FV/BL/54/17/D78",
      },
      {
        "Numer dokumentu": "FV/BL/992/14/D38",
      },
      {
        "Numer dokumentu": "FV/I/156/16/D2",
      },
      {
        "Numer dokumentu": "FV/I/19/21D3",
      },
      {
        "Numer dokumentu": "FV/I/20/20/D31",
      },
      {
        "Numer dokumentu": "FV/M/127/19/D87",
      },
      {
        "Numer dokumentu": "FV/M/1292/19/D17",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3125/14/D37",
      },
      {
        "Numer dokumentu": "FV/M/3819/13/D6",
      },
      {
        "Numer dokumentu": "FV/M/3920/13/D6",
      },
      {
        "Numer dokumentu": "FV/M/4021/13/D6",
      },
      {
        "Numer dokumentu": "FV/M/N/1887/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/1904/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/1905/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2126/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2158/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2296/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2296/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2296/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2514/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2536/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2536/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2536/19/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2539/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2601/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2701/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2799/18/D67",
      },
      {
        "Numer dokumentu": "FV/M/N/2987/18/D67",
      },
      {
        "Numer dokumentu": "FV/MN/10864/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10871/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10920/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10920/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10921/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/10985/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11078/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11138/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/11645/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/126/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1262/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/128/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1351/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/1351/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/1454/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1509/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1509/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1509/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1516/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1517/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1544/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1553/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1577/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/16014/23/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1716/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/1716/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/1729/16/D37",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/194/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/195/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/196/24/S/D7",
      },
      {
        "Numer dokumentu": "FV/MN/1961/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2014/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2021/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2058/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2093/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2093/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2098/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2175/16/D57",
      },
      {
        "Numer dokumentu": "FV/MN/2303/16/D57",
      },
      {
        "Numer dokumentu": "FV/MN/2341/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2342/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2382/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2383/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2384/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2412/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2412/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2432/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2432/22/D67",
      },
      {
        "Numer dokumentu": "FV/MN/2480/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2481/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2482/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2483/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2548/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2552/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2558/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2639/18/D57",
      },
      {
        "Numer dokumentu": "FV/MN/2656/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2711/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2712/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2749/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2804/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2805/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2806/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2858/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/2908/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/3649/18/d7",
      },
      {
        "Numer dokumentu": "FV/MN/3684/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/5661/18/D7",
      },
      {
        "Numer dokumentu": "FV/MN/6646/17/D7",
      },
      {
        "Numer dokumentu": "FV/MN/6671/18/D7 .",
      },
      {
        "Numer dokumentu": "FV/MN/6750/17/D7",
      },
      {
        "Numer dokumentu": "FV/MN/717/18/D47",
      },
      {
        "Numer dokumentu": "FV/MN/717/18/D47",
      },
      {
        "Numer dokumentu": "FV/MN/9120/17/D7",
      },
      {
        "Numer dokumentu": "FV/MN/936/18/D57",
      },
      {
        "Numer dokumentu": "FV/MN/986/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/986/19/D7",
      },
      {
        "Numer dokumentu": "FV/MN/986/19/D7",
      },
      {
        "Numer dokumentu": "FV/UBL/1503/16/D8",
      },
      {
        "Numer dokumentu": "FV/UBL/1627/17/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/165/24/D38",
      },
      {
        "Numer dokumentu": "FV/UBL/1656/19/D8",
      },
      {
        "Numer dokumentu": "FV/UBL/1788/17/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/1788/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/232/23/A/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/232/23/A/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/238/23/A/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/280/20/D38",
      },
      {
        "Numer dokumentu": "FV/UBL/329/22/A/D38",
      },
      {
        "Numer dokumentu": "FV/UBL/329/22/A/D38",
      },
      {
        "Numer dokumentu": "FV/UBL/359/22/S/D8",
      },
      {
        "Numer dokumentu": "FV/UBL/529/16/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/581/21/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/619/21/D78",
      },
      {
        "Numer dokumentu": "FV/UBL/672/22/A/D38",
      },
      {
        "Numer dokumentu": "FV/UBL/975/18/D8",
      },
      {
        "Numer dokumentu": "FV/UP/1008/18/D6",
      },
      {
        "Numer dokumentu": "FV/UP/1019/17/D76",
      },
      {
        "Numer dokumentu": "FV/UP/10204/15/D6",
      },
      {
        "Numer dokumentu": "FV/UP/1119/18/D86",
      },
      {
        "Numer dokumentu": "FV/UP/11538/15/D6",
      },
      {
        "Numer dokumentu": "FV/UP/12/20/D46",
      },
      {
        "Numer dokumentu": "FV/UP/1233/23/A/D116",
      },
      {
        "Numer dokumentu": "FV/UP/1365/18/D56",
      },
      {
        "Numer dokumentu": "FV/UP/1437/19/D76",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2519/16/D6",
      },
      {
        "Numer dokumentu": "FV/UP/2991/19/D36",
      },
      {
        "Numer dokumentu": "FV/UP/2991/19/D36",
      },
      {
        "Numer dokumentu": "KF/UP/78/19/D36",
      },
      {
        "Numer dokumentu": "FV/UP/3192/19/D66",
      },
      {
        "Numer dokumentu": "FV/UP/3478/19/D66",
      },
      {
        "Numer dokumentu": "FV/UP/3478/19/D66",
      },
      {
        "Numer dokumentu": "FV/UP/3671/19/D66",
      },
      {
        "Numer dokumentu": "FV/UP/3959/18/D36",
      },
      {
        "Numer dokumentu": "FV/UP/3959/18/D36",
      },
      {
        "Numer dokumentu": "FV/UP/3959/18/D36",
      },
      {
        "Numer dokumentu": "FV/UP/4405/21/D36",
      },
      {
        "Numer dokumentu": "FV/UP/4426/18/D76",
      },
      {
        "Numer dokumentu": "FV/UP/444/19/D96",
      },
      {
        "Numer dokumentu": "FV/UP/444/19/D96",
      },
      {
        "Numer dokumentu": "FV/UP/5298/18/D6",
      },
      {
        "Numer dokumentu": "FV/UP/822/18/D36",
      },
      {
        "Numer dokumentu": "FV/UP/822/18/D36",
      },
      {
        "Numer dokumentu": "FV/UP/843/13/D6",
      },
      {
        "Numer dokumentu": "FV/UP/890/19/D76",
      },
      {
        "Numer dokumentu": "FV/UP/991/19/D76",
      },
      {
        "Numer dokumentu": "FV/WS/1/13/D1",
      },
      {
        "Numer dokumentu": "FV/WS/15/17/D56",
      },
      {
        "Numer dokumentu": "FV/WY/1/19/D72",
      },
      {
        "Numer dokumentu": "FV/WY/105/19/D62",
      },
      {
        "Numer dokumentu": "FV/WY/154/19/D62",
      },
      {
        "Numer dokumentu": "FV/WY/159/19/D62",
      },
      {
        "Numer dokumentu": "FV/WY/90/19/D62",
      },
    ];

    // *******************************
    const sqlCondition =
      docs?.length > 0
        ? `(${docs
            .map((dep) => `r.dsymbol = '${dep["Numer dokumentu"]}' `)
            .join(" OR ")})`
        : null;

    await msSqlQuery("TRUNCATE TABLE [rapdb].dbo.fkkomandytowams");

    await msSqlQuery(
      `
        INSERT INTO [rapdb].dbo.fkkomandytowams
        SELECT DISTINCT
            GETDATE() AS smf_stan_na_dzien,
            'N' AS smf_typ,
            r.dsymbol AS smf_numer,
            r1.dsymbol,
            r1.kwota AS kwota_platnosci,
            CAST(r1.data AS DATE) AS data_platnosci,
            r.kwota AS kwota_faktury,
            CAST(
                (CASE WHEN r.strona = 0 THEN r.kwota ELSE r.kwota * (-1) END)
                + SUM(ISNULL(CASE WHEN r1.strona = 0 THEN r1.kwota ELSE r1.kwota * (-1) END, 0))
                    OVER (PARTITION BY r.id)
            AS MONEY) AS naleznosc,
            CAST(r.dataokr AS DATE) AS smf_data_otwarcia_rozrachunku
        FROM [fkkomandytowa].[FK].[rozrachunki] r
        LEFT JOIN [fkkomandytowa].[FK].[rozrachunki] r1
            ON r.id = r1.transakcja
            AND ISNULL(r1.czyrozliczenie, 0) = 1
            AND ISNULL(r1.dataokr, 0) <= GETDATE()
        WHERE
            r.czyrozliczenie = 0
            AND CAST(r.dataokr AS DATE) BETWEEN '2001-01-01' AND GETDATE()
            AND ${sqlCondition}

      `
    );

    // 4. Pobierz to, co zostało zapisane
    const settlementDescription = await msSqlQuery(`
        SELECT *
        FROM [rapdb].dbo.fkkomandytowams
    `);

    const result = [];

    settlementDescription.forEach((item) => {
      const key = item.smf_numer;

      // czy już istnieje dokument z tym numerem
      let existing = result.find((r) => r.NUMER_DOKUMENTU === key);

      // format daty yyyy-mm-dd
      const formatDate = (date) =>
        date ? new Date(date).toISOString().slice(0, 10) : null;

      const paymentObj = {
        data: formatDate(item.data_platnosci),
        symbol: item.dsymbol,
        kwota: item["kwota_platności"],
        // kwota_faktury: item.kwota_faktury,
      };

      if (!existing) {
        // tworzymy nowy dokument
        result.push({
          NUMER_DOKUMENTU: key,
          WYKAZ_SPLACONEJ_KWOTY: item["kwota_platności"] ? [paymentObj] : [],
          SUMA: item["kwota_platności"] || 0,
          NALEZNOSC: item["naleznosc"] || 0,
        });
      } else {
        // dopisujemy płatność jeśli istnieje
        if (item["kwota_platności"]) {
          existing.WYKAZ_SPLACONEJ_KWOTY.push(paymentObj);
          existing.SUMA += item["kwota_platności"];
        }
      }
    });

    // 🔽 SORTOWANIE WYKAZ_SPLACONEJ_KWOTY według daty (najnowsze na górze)
    result.forEach((doc) => {
      doc.WYKAZ_SPLACONEJ_KWOTY.sort((a, b) => {
        if (!a.data) return 1;
        if (!b.data) return -1;
        return new Date(b.data) - new Date(a.data); // malejąco
      });
    });

    // for (const doc of result) {
    //   console.log(doc);
    //   await connect_SQL.query(
    //     "INSERT IGNORE INTO company_law_documents_settlements (NUMER_DOKUMENTU_FK, WYKAZ_SPLACONEJ_KWOTY_FK, SUMA_SPLACONEJ_KWOTY_FK, POZOSTALA_NALEZNOSC_FK) VALUES (?, ?, ?, ?)",
    //     [
    //       doc.NUMER_DOKUMENTU,
    //       JSON.stringify(doc.WYKAZ_SPLACONEJ_KWOTY),
    //       doc.SUMA,
    //       doc.NALEZNOSC,
    //     ]
    //   );
    // }
    // console.log(result);
    console.log(JSON.stringify(result, null, 2));
    logEvents(JSON.stringify(result, null, 2), "json.txt");
  } catch (error) {
    console.error(error);
  }
};

const copyTableKolumnsPartner = async () => {
  try {
    // const [columns] = await connect_SQL.query(
    //   "SELECT * FROM company_table_columns WHERE EMPLOYEE = 'Kancelaria'"
    // );

    const columns = [
      {
        id_table_columns: 47,
        ACCESSOR_KEY: "CZAT_KANCELARIA",
        HEADER: "Panel komunikacji",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 45,
        ACCESSOR_KEY: "DATA_PRZEKAZANIA_SPRAWY",
        HEADER: "Data przekazania sprawy",
        FILTER_VARIANT: "date-range",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 42,
        ACCESSOR_KEY: "DATA_PRZYJECIA_SPRAWY",
        HEADER: "Data przyjęcia sprawy",
        FILTER_VARIANT: "multi-select",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 54,
        ACCESSOR_KEY: "DATA_WYMAGALNOSCI_PLATNOSCI",
        HEADER: "Data wymagalności płatności",
        FILTER_VARIANT: "date-range",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 43,
        ACCESSOR_KEY: "DATA_WYSTAWIENIA_DOKUMENTU",
        HEADER: "Data wystawienia dokumentu",
        FILTER_VARIANT: "date-range",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 41,
        ACCESSOR_KEY: "KONTRAHENT",
        HEADER: "Kontrahent",
        FILTER_VARIANT: "startsWith",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 44,
        ACCESSOR_KEY: "KWOTA_BRUTTO_DOKUMENTU",
        HEADER: "Kwota brutto dokumentu",
        FILTER_VARIANT: "none",
        TYPE: "money",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 46,
        ACCESSOR_KEY: "KWOTA_ROSZCZENIA_DO_KANCELARII",
        HEADER: "Kwota roszczenia",
        FILTER_VARIANT: "none",
        TYPE: "money",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 48,
        ACCESSOR_KEY: "NIP_NR",
        HEADER: "NIP",
        FILTER_VARIANT: "startsWith",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 40,
        ACCESSOR_KEY: "NUMER_DOKUMENTU",
        HEADER: "Numer dokumentu",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 49,
        ACCESSOR_KEY: "ODDZIAL",
        HEADER: "Oddział",
        FILTER_VARIANT: "multi-select",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 50,
        ACCESSOR_KEY: "OPIS_DOKUMENTU",
        HEADER: "Opis dokumentu",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 56,
        ACCESSOR_KEY: "ORGAN_EGZEKUCYJNY",
        HEADER: "Organ egzekucyjny",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 60,
        ACCESSOR_KEY: "POZOSTALA_NALEZNOSC_FK",
        HEADER: "Pozostała należność FK",
        FILTER_VARIANT: "none",
        TYPE: "money",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 51,
        ACCESSOR_KEY: "STATUS_SPRAWY",
        HEADER: "Status sprawy",
        FILTER_VARIANT: "multi-select",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 59,
        ACCESSOR_KEY: "SUMA_SPLACONEJ_KWOTY_FK",
        HEADER: "Suma spłaconej kwoty",
        FILTER_VARIANT: "none",
        TYPE: "money",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 57,
        ACCESSOR_KEY: "SYGN_SPRAWY_EGZEKUCYJNEJ",
        HEADER: "Sygnatura sprawy egz.",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 52,
        ACCESSOR_KEY: "SYGNATURA_SPRAWY",
        HEADER: "Sygnatura sprawy",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 53,
        ACCESSOR_KEY: "TERMIN_PRZEDAWNIENIA_ROSZCZENIA",
        HEADER: "Termin przedawnienia roszcz.",
        FILTER_VARIANT: "date-range",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 55,
        ACCESSOR_KEY: "WYDZIAL_SADU",
        HEADER: "Wydział Sądu",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
      {
        id_table_columns: 58,
        ACCESSOR_KEY: "WYKAZ_SPLACONEJ_KWOTY_FK",
        HEADER: "Wykaz spłaconej kwoty",
        FILTER_VARIANT: "none",
        TYPE: "text",
        EMPLOYEE: "Kancelaria",
        AREAS: [{ name: "Kancelaria Krotoski", available: true }],
      },
    ];

    for (const col of columns) {
      // console.log(col);
      await connect_SQL.query(
        "INSERT IGNORE INTO company_table_columns (ACCESSOR_KEY, HEADER, FILTER_VARIANT, TYPE, EMPLOYEE, AREAS) VALUES (?, ?, ?, ?, ?, ?)",
        [
          col.ACCESSOR_KEY,
          col.HEADER,
          col.FILTER_VARIANT,
          col.TYPE,
          col.EMPLOYEE,
          JSON.stringify(col.AREAS),
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const temporaryFunc = async () => {
  try {
    // await createLawTable();
    // console.log("createLawTable");
    // await createTriggers();
    // console.log("createTriggers");
    // await addDataToLawDocuments();
    // console.log("addDataToLawDocuments");
    // pobiera Wartość spłaconej kwoty
    // await updateLawSettlements();
    // console.log("updateLawSettlements");
    // tworzy relacje pomiędzy tabelami
    //   await createTableRelations();
    //   // wczytanie testowych kolumn dla Kancelarii
    //   await copyTableKolumnsPartner();
  } catch (error) {
    console.error(error);
  }
};

const copyDataToLaw = async () => {
  try {
    // Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
    const excelDateToISODate = (excelDate) => {
      const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
      return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
    };

    // funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
    const isExcelDate = (value) => {
      // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
      if (typeof value === "number" && value > 0) {
        // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
        return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
      }
      return false;
    };

    // const DATA_KOMENTARZA_BECARED = isExcelDate(
    //     row["Data ostatniego komentarza"]
    //   )
    //     ? excelDateToISODate(row["Data ostatniego komentarza"])
    //     : null;
    const data = [
      {
        "Numer dokumentu": "FV/MN/5673/18/D7",
        "Data wystawienia dokumentu": 43244,
        Kontrahent: "Auto Galeria Team sp. z o.o.",
        "Kwota brutto dokumentu": 3912.32,
        "Data przekazania sprawy": 43615,
        "Data przyjęcia sprawy": 43615,
        "Data wymagalności płatności": 43273,
        "Pozostała należność FK": 10499.9,
        Odzial: {
          DZIAL: "D007",
          OBSZAR: "CZĘŚCI",
          LOKALIZACJA: "Łódź Niciarniana",
        },
        FIRMA: "KRT",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym w Białej Podlaskiej Łukasz Nejman Kancelaria Komornicza nr 5 w Białej Podlaskiej",
        "Status sprawy": "EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "GKm 205/24",
        "Panel komunikacji": [
          {
            date: "2024-12-16",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-12-20",
            note: "zajęcie wierzytelności z rachunku bankowego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "KF/UP/78/19/D36",
        "Data wystawienia dokumentu": 43698,
        Kontrahent: "Remigiusz Szostek (RAMP INVESTMENTS)",
        "Kwota brutto dokumentu": 5843.72,
        "Data przekazania sprawy": 40179,
        "Data przyjęcia sprawy": 40179,
        "Data wymagalności płatności": 43720,
        "Pozostała należność FK": 8216.2,
        Odzial: {
          DZIAL: "D036",
          OBSZAR: "SERWIS",
          LOKALIZACJA: "Wolica",
        },
        FIRMA: "KRT",
        "Status sprawy": "SĄDOWA",
        "Termin przedawnienia roszcz.": 46752,
        "Wydział Sądu":
          "Sąd Rejonowy dla m.st. Warszawy w Warszawie I Wydział Gospodarczy ",
        "Panel komunikacji": [
          {
            date: "2024-12-17",
            note: "pozew o zapłatę w postępowaniu upominawczym przeciwko członkowi zarządu spółki z ograniczoną odpowiedzialnością na podstawie art.. 299 KSH",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-02-26",
            note: "nakaz zapłaty 10.146,66 zł",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "Brak danych",
            note: "Faktura FV/UP/2991/19/D36 skorygowana na KF/UP/78/19/D36",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "FV/MN/2175/16/D57",
        "Data wystawienia dokumentu": 42661,
        Kontrahent: "Piotr Gołaszewski (AUTO SERWIS Piotr Gołaszewski)",
        "Kwota brutto dokumentu": 1893.56,
        "Data przekazania sprawy": 42746,
        "Data przyjęcia sprawy": 42746,
        "Data wymagalności płatności": 42682,
        "Pozostała należność FK": 8118.47,
        Odzial: {
          DZIAL: "D057",
          OBSZAR: "CZĘŚCI",
          LOKALIZACJA: "Wolica",
        },
        FIRMA: "KRT",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym w Białymstoku Zastępca Cezarego Kalinowskiego Alicja Wysocka-Wasiluk, Kancelaria komornicza nr II w Białymstoku",
        "Status sprawy": "EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "CK GKm 42/25",

        "Panel komunikacji": [
          {
            date: "2024-12-16",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "FV/MN/6540/18/D7",
        "Data wystawienia dokumentu": 43266,
        Kontrahent: "Auto Galeria Team sp. z o.o.",
        "Kwota brutto dokumentu": 102.93,
        "Data przekazania sprawy": 43616,
        "Data przyjęcia sprawy": 43616,
        "Data wymagalności płatności": 43295,
        "Pozostała należność FK": 10499.9,
        Odzial: {
          DZIAL: "D007",
          OBSZAR: "CZĘŚCI",
          LOKALIZACJA: "Łódź Niciarniana",
        },
        FIRMA: "KRT",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym w Białej Podlaskiej Łukasz Nejman Kancelaria Komornicza nr 5 w Białej Podlaskiej",
        "Status sprawy": "EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "GKm 205/24",
        "Panel komunikacji": [
          {
            date: "2024-12-16",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-12-20",
            note: "zajęcie wierzytelności z rachunku bankowego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "109/08/RAC/2023",
        "Data wystawienia dokumentu": 45166,
        Kontrahent: "Mozell Sp. z o.o.",
        "Kwota brutto dokumentu": 6826.5,
        "Data przekazania sprawy": 40179,
        "Data przyjęcia sprawy": 40179,
        "Data wymagalności płatności": 45180,
        "Pozostała należność FK": 7139.29,
        Odzial: {
          DZIAL: "",
          OBSZAR: "",
          LOKALIZACJA: "RAC",
        },
        FIRMA: "RAC",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym dla Warszawy-Woli w Warszawie Piotr Bukszewicz Kancelaria Komornicza ",
        "Status sprawy": "SĄDOWA / EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "Km 1036/24",
        "Termin przedawnienia roszcz.": 46752,
        "Panel komunikacji": [
          {
            date: "2024-08-27",
            note: "postanowienie o odmówieniu wszczęcia egzekucji",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-09-06",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },

          {
            date: "2024-09-27",
            note: "wezwanie do uiszczenia zaliczki na wydatki (Km 2579/24)",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-12",
            note: "wysłuchanie wierzyciela przed umorzeniem postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-25",
            note: "wniosek o poszukiwanie majątku",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "121/05/RAC/2023",
        "Data wystawienia dokumentu": 45075,
        Kontrahent: "Mozell Sp. z o.o.",
        "Kwota brutto dokumentu": 2755.59,
        "Data przekazania sprawy": 40179,
        "Data przyjęcia sprawy": 40179,
        "Data wymagalności płatności": 45090,
        "Pozostała należność FK": 3072.4,
        Odzial: {
          DZIAL: "",
          OBSZAR: "",
          LOKALIZACJA: "RAC",
        },
        FIRMA: "RAC",

        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym dla Warszawy-Woli w Warszawie Piotr Bukszewicz Kancelaria Komornicza ",
        "Status sprawy": "SĄDOWA / EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "Km 1036/24",
        "Termin przedawnienia roszcz.": 46752,
        "Panel komunikacji": [
          {
            date: "2024-08-27",
            note: "postanowienie o odmówieniu wszczęcia egzekucji",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-09-06",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },

          {
            date: "2024-09-27",
            note: "wezwanie do uiszczenia zaliczki na wydatki (Km 2579/24)",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-12",
            note: "wysłuchanie wierzyciela przed umorzeniem postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-25",
            note: "wniosek o poszukiwanie majątku",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "126/08/RAC/2023",
        "Data wystawienia dokumentu": 45166,
        Kontrahent: "Mozell Sp. z o.o.",
        "Kwota brutto dokumentu": 5694.9,
        "Data przekazania sprawy": 40179,
        "Data przyjęcia sprawy": 40179,
        "Data wymagalności płatności": 45180,
        "Pozostała należność FK": 6007.69,
        Odzial: {
          DZIAL: "",
          OBSZAR: "",
          LOKALIZACJA: "RAC",
        },
        FIRMA: "RAC",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym dla Warszawy-Woli w Warszawie Piotr Bukszewicz Kancelaria Komornicza ",
        "Status sprawy": "SĄDOWA / EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "Km 1036/24",
        "Termin przedawnienia roszcz.": 46752,
        "Panel komunikacji": [
          {
            date: "2024-08-27",
            note: "postanowienie o odmówieniu wszczęcia egzekucji",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-09-06",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },

          {
            date: "2024-09-27",
            note: "wezwanie do uiszczenia zaliczki na wydatki (Km 2579/24)",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-12",
            note: "wysłuchanie wierzyciela przed umorzeniem postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-25",
            note: "wniosek o poszukiwanie majątku",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
      {
        "Numer dokumentu": "130/06/RAC/2023",
        "Data wystawienia dokumentu": 45105,
        Kontrahent: "Mozell Sp. z o.o.",
        "Kwota brutto dokumentu": 5694.9,
        "Data przekazania sprawy": 40179,
        "Data przyjęcia sprawy": 40179,
        "Data wymagalności płatności": 45119,
        "Pozostała należność FK": 6207.65,
        Odzial: {
          DZIAL: "",
          OBSZAR: "",
          LOKALIZACJA: "RAC",
        },
        FIRMA: "RAC",
        "Organ egzekucyjny":
          "Komornik Sądowy przy Sądzie Rejonowym dla Warszawy-Woli w Warszawie Piotr Bukszewicz Kancelaria Komornicza ",
        "Status sprawy": "SĄDOWA / EGZEKUCYJNA",
        "Sygnatura sprawy egz.": "Km 1036/24",
        "Termin przedawnienia roszcz.": 46752,
        "Panel komunikacji": [
          {
            date: "2024-08-27",
            note: "postanowienie o odmówieniu wszczęcia egzekucji",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2024-09-06",
            note: "wniosek o wszczęcie postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },

          {
            date: "2024-09-27",
            note: "wezwanie do uiszczenia zaliczki na wydatki (Km 2579/24)",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-12",
            note: "wysłuchanie wierzyciela przed umorzeniem postępowania egzekucyjnego",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
          {
            date: "2025-05-25",
            note: "wniosek o poszukiwanie majątku",
            profile: "Kancelaria",
            username: "Archiwum",
            userlogin: "Brak danych",
          },
        ],
      },
    ];

    await connect_SQL.query("TRUNCATE TABLE company_law_documents");

    for (const item of data) {
      const NUMER_DOKUMENTU = item["Numer dokumentu"];
      const KONTRAHENT = item["Kontrahent"];
      const NAZWA_KANCELARII = "Kancelaria Krotoski";
      const DATA_PRZYJECIA_SPRAWY = isExcelDate(item["Data przekazania sprawy"])
        ? excelDateToISODate(item["Data przekazania sprawy"])
        : null;
      const DATA_WYSTAWIENIA_DOKUMENTU = isExcelDate(
        item["Data wystawienia dokumentu"]
      )
        ? excelDateToISODate(item["Data wystawienia dokumentu"])
        : null;
      const KWOTA_BRUTTO_DOKUMENTU = item["Kwota brutto dokumentu"];
      const ODDZIAL = item.Odzial;
      const FIRMA = item.FIRMA;
      const DATA_PRZEKAZANIA_SPRAWY = isExcelDate(
        item["Data przekazania sprawy"]
      )
        ? excelDateToISODate(item["Data przekazania sprawy"])
        : null;
      const KWOTA_ROSZCZENIA_DO_KANCELARII = null;

      const CZAT_KANCELARIA = item["Panel komunikacji"];
      const STATUS_SPRAWY = item["Status sprawy"];
      const TERMIN_PRZEDAWNIENIA_ROSZCZENIA = isExcelDate(
        item["Termin przedawnienia roszcz."]
      )
        ? excelDateToISODate(item["Termin przedawnienia roszcz."])
        : null;

      const DATA_WYMAGALNOSCI_PLATNOSCI = isExcelDate(
        item["Data wymagalności płatności"]
      )
        ? excelDateToISODate(item["Data wymagalności płatności"])
        : null;
      const WYDZIAL_SADU = item["Wydział Sądu"];
      const ORGAN_EGZEKUCYJNY = item["Organ egzekucyjny"];
      const SYGN_SPRAWY_EGZEKUCYJNEJ = item["Sygnatura sprawy egz."];
      await connect_SQL.query(
        "INSERT IGNORE INTO company_law_documents (NUMER_DOKUMENTU, KONTRAHENT, NAZWA_KANCELARII, DATA_PRZYJECIA_SPRAWY, DATA_WYSTAWIENIA_DOKUMENTU, KWOTA_BRUTTO_DOKUMENTU, ODDZIAL, FIRMA, DATA_PRZEKAZANIA_SPRAWY, KWOTA_ROSZCZENIA_DO_KANCELARII, CZAT_KANCELARIA, STATUS_SPRAWY, TERMIN_PRZEDAWNIENIA_ROSZCZENIA, DATA_WYMAGALNOSCI_PLATNOSCI, WYDZIAL_SADU, ORGAN_EGZEKUCYJNY, SYGN_SPRAWY_EGZEKUCYJNEJ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          NUMER_DOKUMENTU || null,
          KONTRAHENT || null,
          NAZWA_KANCELARII || null,
          DATA_PRZYJECIA_SPRAWY || null,
          DATA_WYSTAWIENIA_DOKUMENTU || null,
          KWOTA_BRUTTO_DOKUMENTU || null,
          JSON.stringify(ODDZIAL) || null,
          FIRMA || null,
          DATA_PRZEKAZANIA_SPRAWY || null,
          KWOTA_ROSZCZENIA_DO_KANCELARII || null,
          JSON.stringify(CZAT_KANCELARIA) || null,
          STATUS_SPRAWY || null,
          TERMIN_PRZEDAWNIENIA_ROSZCZENIA || null,
          DATA_WYMAGALNOSCI_PLATNOSCI || null,
          WYDZIAL_SADU || null,
          ORGAN_EGZEKUCYJNY || null,
          SYGN_SPRAWY_EGZEKUCYJNEJ || null,
        ]
      );
    }
    await updateLawSettlements();
  } catch (error) {
    console.error(error);
  }
};

const copyDefaultTableSettings = async () => {
  try {
    const [user] = await connect_SQL.query(
      "SELECT * FROM company_users WHERE id_user = 117"
    );
    const Kancelaria = {
      size: {
        KONTRAHENT: 204,
        CZAT_KANCELARIA: 314,
        NUMER_DOKUMENTU: 196,
        ORGAN_EGZEKUCYJNY: 251,
        DATA_PRZYJECIA_SPRAWY: 195,
        KWOTA_BRUTTO_DOKUMENTU: 158,
        POZOSTALA_NALEZNOSC_FK: 155,
        DATA_PRZEKAZANIA_SPRAWY: 190,
        WYKAZ_SPLACONEJ_KWOTY_FK: 316,
        DATA_WYSTAWIENIA_DOKUMENTU: 182,
        DATA_WYMAGALNOSCI_PLATNOSCI: 200,
      },
      order: [
        "NUMER_DOKUMENTU",
        "DATA_WYSTAWIENIA_DOKUMENTU",
        "KONTRAHENT",
        "KWOTA_BRUTTO_DOKUMENTU",
        "KWOTA_ROSZCZENIA_DO_KANCELARII",
        "POZOSTALA_NALEZNOSC_FK",
        "CZAT_KANCELARIA",
        "DATA_PRZYJECIA_SPRAWY",
        "DATA_PRZEKAZANIA_SPRAWY",
        "SUMA_SPLACONEJ_KWOTY_FK",
        "WYKAZ_SPLACONEJ_KWOTY_FK",
        "DATA_WYMAGALNOSCI_PLATNOSCI",
        "ODDZIAL",
        "NIP_NR",
        "OPIS_DOKUMENTU",
        "ORGAN_EGZEKUCYJNY",
        "STATUS_SPRAWY",
        "SYGN_SPRAWY_EGZEKUCYJNEJ",
        "SYGNATURA_SPRAWY",
        "TERMIN_PRZEDAWNIENIA_ROSZCZENIA",
        "WYDZIAL_SADU",
        "mrt-row-spacer",
      ],
      pinning: { left: ["NUMER_DOKUMENTU"], right: [] },
      visible: { NIP_NR: false, OPIS_DOKUMENTU: false },
      pagination: { pageSize: 50, pageIndex: 0 },
    };

    // const userTable = user[0].tableSettings;
    // userTable.Kancelaria = Kancelaria;

    const id = [4, 20, 21, 117];

    for (const item of id) {
      const [newUser] = await connect_SQL.query(
        "SELECT tableSettings FROM company_users WHERE id_user = ?",
        [item]
      );
      const tableSeting = newUser[0].tableSettings;
      tableSeting.Kancelaria = Kancelaria;

      await connect_SQL.query(
        "UPDATE company_users SET tableSettings = ? WHERE id_user = ?",
        [JSON.stringify(tableSeting), item]
      );
    }
    console.log("finish");
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await rebuildDataBase();
    // console.log("rebuildDataBase");
    //
    //
    // chwilowa funkcja
    // await temporaryFunc();
    // console.log("temporaryFunc");
    // await copyDataToLaw();
    //
    // await copyDefaultTableSettings();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
