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
const { calculateCommercialInterest } = require("./payGuard");

//zebrane kawałki kodu, nieużywac funkcji
const test = async () => {
  await connect_SQL.query(
    "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
  );
  await connect_SQL.query(
    "ALTER TABLE company_insurance_documents  ADD KWOTA_DOKUMENT  DECIMAL(12,2) NULL AFTER OW"
  );

  await connect_SQL.query(
    "CREATE TABLE company_pay_guard (  id_pay_guard INT UNSIGNED AUTO_INCREMENT,  value VARCHAR(255) NULL,  PROCENTY_ROK JSON  NULL,  WOLNE_USTAWOWE JSON NULL,  PRIMARY KEY (id_pay_guard),  UNIQUE KEY uq_id_pay_guard (id_pay_guard)) ENGINE=InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci"
  );
};

const changeTableSettings = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_settings ADD PROCENTY_ROK JSON NULL AFTER COMPANY, ADD WOLNE_USTAWOWE JSON NULL AFTER PROCENTY_ROK"
    );
  } catch (error) {
    console.error(error);
  }
};

//zapisuje do tabeli odsetki ustawowe i obowiązujące okresy
const saveHistorical = async () => {
  try {
    const historyczneOdsetki = [
      {
        date: "2008-12-15",
        percent: 13,
      },
      {
        date: "2012-12-23",
        percent: 11.5,
      },
      {
        date: "2013-07-04",
        percent: 10,
      },
      {
        date: "2014-10-09",
        percent: 8,
      },
      {
        date: "2016-01-01",
        percent: 9.5,
      },
      {
        date: "2020-01-01",
        percent: 11.5,
      },
      {
        date: "2020-07-01",
        percent: 10.1,
      },
      {
        date: "2022-01-01",
        percent: 11.75,
      },
      {
        date: "2022-07-01",
        percent: 16,
      },
      {
        date: "2023-01-01",
        percent: 16.75,
      },
      {
        date: "2024-01-01",
        percent: 15.75,
      },
      {
        date: "2025-07-01",
        percent: 15.25,
      },
      {
        date: "2026-01-01",
        percent: 14,
      },
    ];
    const polishMonts = [
      {
        day: 1,
        name: "Nowy Rok",
        month: 1,
      },
      {
        day: 6,
        name: "Trzech Króli",
        month: 1,
      },
      {
        day: 1,
        name: "1 Maja",
        month: 5,
      },
      {
        day: 3,
        name: "3 Maja",
        month: 5,
      },
      {
        day: 15,
        name: "Wniebowzięcie NMP",
        month: 8,
      },
      {
        day: 1,
        name: "Wszystkich Świętych",
        month: 11,
      },
      {
        day: 11,
        name: "Święto Niepodległości",
        month: 11,
      },
      {
        day: 24,
        name: "Wigilia",
        month: 12,
      },
      {
        day: 25,
        name: "Boże Narodzenie",
        month: 12,
      },
      {
        day: 26,
        name: "Boże Narodzenie",
        month: 12,
      },
    ];
    await connect_SQL.query(
      "UPDATE company_settings SET PROCENTY_ROK = ?, WOLNE_USTAWOWE = ? WHERE id_setting = 1",
      [JSON.stringify(historyczneOdsetki), JSON.stringify(polishMonts)]
    );
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await changeTableSettings();
    // console.log("changeTableSettings");
    // await saveHistorical();
    // console.log("saveHistorical");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
