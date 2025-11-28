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

    await connect_SQL.query(
      "ALTER TABLE company_law_documents CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci"
    );
    await connect_SQL.query(
      "ALTER TABLE company_law_documents_settlements CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci"
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
      connect_SQL.query(
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
    await createLawTable();
    await createTriggers();
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
    await repairCompanyUpdatesTable();
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
    const [docs] = await connect_SQL.query(
      "SELECT distinct NUMER_DOKUMENTU FROM company_law_documents"
    );

    const sqlCondition =
      docs?.length > 0
        ? `(${docs
            .map((dep) => `r.dsymbol = '${dep.NUMER_DOKUMENTU}' `)
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

    // console.log(settlementDescription.length);

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

    const testData = [
      {
        NUMER_DOKUMENTU: "FV/MN/17376/25/A/D447",
        WYKAZ_SPLACONEJ_KWOTY: [],
        SUMA: 0,
        NALEZNOSC: 8868.8,
      },
      {
        NUMER_DOKUMENTU: "FV/MN/20211/25/S/D7",
        WYKAZ_SPLACONEJ_KWOTY: [],
        SUMA: 0,
        NALEZNOSC: 3508.84,
      },
      {
        NUMER_DOKUMENTU: "FV/UBL/671/25/A/D8",
        WYKAZ_SPLACONEJ_KWOTY: [
          { data: "2025-07-25", symbol: "KP/DC/915/25/V/D17", kwota: 850.69 },
        ],
        SUMA: 850.69,
        NALEZNOSC: 8248.02,
      },
      {
        NUMER_DOKUMENTU: "FV/UP/5298/18/D6",
        WYKAZ_SPLACONEJ_KWOTY: [
          { data: "2018-12-31", symbol: "PK 554/12/18", kwota: 2000 },
          { data: "2018-11-08", symbol: "WBRA 217/11/2018", kwota: 827.46 },
          { data: "2018-11-05", symbol: "WBRE 214/11/2018", kwota: 1302.55 },
          { data: "2018-10-29", symbol: "WBRW 210/10/2018", kwota: 2547.71 },
          { data: "2018-10-17", symbol: "WBRW 202/10/2018", kwota: 2647.53 },
        ],
        SUMA: 9325.25,
        NALEZNOSC: 4606.34,
      },
    ];

    for (const doc of result) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_law_documents_settlements (NUMER_DOKUMENTU_FK, WYKAZ_SPLACONEJ_KWOTY_FK, SUMA_SPLACONEJ_KWOTY_FK, POZOSTALA_NALEZNOSC_FK) VALUES (?, ?, ?, ?)",
        [
          doc.NUMER_DOKUMENTU,
          JSON.stringify(doc.WYKAZ_SPLACONEJ_KWOTY),
          doc.SUMA,
          doc.NALEZNOSC,
        ]
      );
    }
    console.log(result.length);
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
    await createLawTable();
    console.log("createLawTable");
    await createTriggers();
    console.log("createTriggers");
    await addDataToLawDocuments();
    console.log("addDataToLawDocuments");
    // pobiera Wartość spłaconej kwoty
    await updateLawSettlements();
    console.log("updateLawSettlements");
    // tworzy relacje pomiędzy tabelami
    await createTableRelations();
    // wczytanie testowych kolumn dla Kancelarii
    await copyTableKolumnsPartner();
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await rebuildDataBase();
    // console.log("repair");
    //
    // chwilowa funkcja
    // await temporaryFunc();
    console.log("temporaryFunc");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
