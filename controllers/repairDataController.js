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

const changeDocumentsTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
    );
    await connect_SQL.query(
      "ALTER TABLE company_documents_actions ADD COLUMN DZIENNIK_ZMIAN JSON NULL AFTER KANAL_KOMUNIKACJI"
    );
    const [result] = await connect_SQL.query(
      "SELECT id_action, KANAL_KOMUNIKACJI FROM company_documents_actions WHERE KANAL_KOMUNIKACJI IS NOT NULL   AND JSON_VALID(KANAL_KOMUNIKACJI)   AND JSON_TYPE(KANAL_KOMUNIKACJI) <> 'NULL'   AND (         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'ARRAY'  AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)         OR         (JSON_TYPE(KANAL_KOMUNIKACJI) = 'OBJECT' AND JSON_LENGTH(KANAL_KOMUNIKACJI) > 0)      ) "
    );
    for (const item of result) {
      if (item?.KANAL_KOMUNIKACJI?.length) {
        const newItem = item.KANAL_KOMUNIKACJI.map((doc) => {
          return {
            date: "",
            note: doc,
            profile: "Pracownik",
            username: "",
            userlogin: "brak danych",
          };
        });
        await connect_SQL.query(
          "UPDATE company_documents_actions SET KANAL_KOMUNIKACJI = ? WHERE id_action = ?",
          [JSON.stringify(newItem), item.id_action]
        );
      }
    }
    const [tableColumns] = await connect_SQL.query(
      'UPDATE company_table_columns SET ACCESSOR_KEY = "KANAL_KOMUNIKACJI" WHERE ACCESSOR_KEY = "UWAGI_ASYSTENT" AND EMPLOYEE = "Pracownik"'
    );
    const [userSettings] = await connect_SQL.query(
      "SELECT id_user, tableSettings, columns FROM company_users"
    );

    // ======= Pracownik =======
    const keyMapPracownik = {
      UWAGI_ASYSTENT: "KANAL_KOMUNIKACJI",
      "100_VAT": "VAT_100",
      "50_VAT": "VAT_50",
    };

    const replaceKeyPracownik = (key) => keyMapPracownik[key] || key;

    const updateColumnsPracownik = (pracownik = []) =>
      pracownik.map((item) => {
        if (keyMapPracownik[item.accessorKey]) {
          return { ...item, accessorKey: keyMapPracownik[item.accessorKey] };
        }
        return item;
      });

    const updateTableSettingsPracownik = (pracownik) => {
      if (!pracownik) return pracownik;
      return {
        ...pracownik,
        size: Object.fromEntries(
          Object.entries(pracownik.size || {}).map(([k, v]) => [
            replaceKeyPracownik(k),
            v,
          ])
        ),
        visible: Object.fromEntries(
          Object.entries(pracownik.visible || {}).map(([k, v]) => [
            replaceKeyPracownik(k),
            v,
          ])
        ),
        order: (pracownik.order || []).map(replaceKeyPracownik),
        pinning: {
          ...pracownik.pinning,
          left: (pracownik.pinning?.left || []).map(replaceKeyPracownik),
          right: (pracownik.pinning?.right || []).map(replaceKeyPracownik),
        },
      };
    };

    // ======= Kancelaria =======
    const replaceKeyKancelaria = (key) =>
      key === "CZAT_KANCELARIA" ? "KANAL_KOMUNIKACJI" : key;

    const updateColumnsKancelaria = (kancelaria = []) =>
      kancelaria.map((item) => {
        if (item.accessorKey === "CZAT_KANCELARIA") {
          return { ...item, accessorKey: "KANAL_KOMUNIKACJI" };
        }
        return item;
      });

    const updateTableSettingsKancelaria = (kancelaria) => {
      if (!kancelaria) return kancelaria;
      return {
        ...kancelaria,
        size: Object.fromEntries(
          Object.entries(kancelaria.size || {}).map(([k, v]) => [
            replaceKeyKancelaria(k),
            v,
          ])
        ),
        visible: Object.fromEntries(
          Object.entries(kancelaria.visible || {}).map(([k, v]) => [
            replaceKeyKancelaria(k),
            v,
          ])
        ),
        order: (kancelaria.order || []).map(replaceKeyKancelaria),
        pinning: {
          ...kancelaria.pinning,
          left: (kancelaria.pinning?.left || []).map(replaceKeyKancelaria),
          right: (kancelaria.pinning?.right || []).map(replaceKeyKancelaria),
        },
      };
    };

    // ======= Aktualizacja w bazie =======
    for (const user of userSettings) {
      const { id_user, columns, tableSettings } = user;
      if (!columns) continue;

      const updatedColumns = {
        ...columns,
        Pracownik: columns?.Pracownik
          ? updateColumnsPracownik(columns.Pracownik)
          : columns.Pracownik,
        Kancelaria: columns?.Kancelaria
          ? updateColumnsKancelaria(columns.Kancelaria)
          : columns.Kancelaria,
      };

      const updatedTableSettings = {
        ...tableSettings,
        Pracownik: tableSettings?.Pracownik
          ? updateTableSettingsPracownik(tableSettings.Pracownik)
          : tableSettings?.Pracownik,
        Kancelaria: tableSettings?.Kancelaria
          ? updateTableSettingsKancelaria(tableSettings.Kancelaria)
          : tableSettings?.Kancelaria,
      };

      await connect_SQL.query(
        `
      UPDATE company_users
      SET columns = ?, tableSettings = ?
      WHERE id_user = ?
    `,
        [
          JSON.stringify(updatedColumns),
          JSON.stringify(updatedTableSettings),
          id_user,
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

const changeControlBLTable = async () => {
  try {
    const [chatControlBL] = await connect_SQL.query(
      "SELECT id_control_documents, CONTROL_UWAGI FROM company_control_documents"
    );

    for (const item of chatControlBL) {
      if (item?.CONTROL_UWAGI?.length) {
        const newItem = item.CONTROL_UWAGI.map((doc) => {
          return {
            date: "",
            note: doc,
            profile: "Pracownik",
            username: "",
            userlogin: "brak danych",
          };
        });
        // console.log(newItem);
        await connect_SQL.query(
          "UPDATE company_control_documents SET CONTROL_UWAGI = ? WHERE id_control_documents = ?",
          [JSON.stringify(newItem), item.id_control_documents]
        );
      }
    }

    await connect_SQL.query(
      "ALTER TABLE company_control_documents CHANGE COLUMN CONTROL_UWAGI KANAL_KOMUNIKACJI JSON"
    );
    await connect_SQL.query(
      "ALTER TABLE company_control_documents ADD COLUMN DZIENNIK_ZMIAN JSON NULL AFTER KANAL_KOMUNIKACJI"
    );
  } catch (error) {
    console.error(error);
  }
};

const repairVatColumns = async () => {
  try {
    const [tableColumns] = await connect_SQL.query(
      "SELECT id_table_columns, ACCESSOR_KEY FROM company_table_columns"
    );

    for (const col of tableColumns) {
      if (col.ACCESSOR_KEY === "100_VAT") {
        await connect_SQL.query(
          'UPDATE company_table_columns SET ACCESSOR_KEY = "VAT_100" WHERE id_table_columns = ?',
          [col.id_table_columns]
        );
      } else if (col.ACCESSOR_KEY === "50_VAT") {
        await connect_SQL.query(
          'UPDATE company_table_columns SET ACCESSOR_KEY = "VAT_50" WHERE id_table_columns = ?',
          [col.id_table_columns]
        );
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// naprawa ostatecznej decyzji i historii daty rozliczenia
const managementRepair = async () => {
  try {
    await connect_SQL.query(`
        UPDATE company_documents_actions
        SET
            INFORMACJA_ZARZAD = CASE
                WHEN JSON_TYPE(INFORMACJA_ZARZAD) = 'NULL' THEN NULL
                ELSE INFORMACJA_ZARZAD
            END,
            HISTORIA_ZMIANY_DATY_ROZLICZENIA = CASE
                WHEN JSON_TYPE(HISTORIA_ZMIANY_DATY_ROZLICZENIA) = 'NULL' THEN NULL
                ELSE HISTORIA_ZMIANY_DATY_ROZLICZENIA
            END
        WHERE
            JSON_TYPE(INFORMACJA_ZARZAD) = 'NULL'
            OR JSON_TYPE(HISTORIA_ZMIANY_DATY_ROZLICZENIA) = 'NULL'
    `);

    const [docActions] = await connect_SQL.query(
      `
    SELECT
      id_action,
      HISTORIA_ZMIANY_DATY_ROZLICZENIA,
      INFORMACJA_ZARZAD
    FROM company_documents_actions
    WHERE
      (
        HISTORIA_ZMIANY_DATY_ROZLICZENIA IS NOT NULL
        AND JSON_TYPE(HISTORIA_ZMIANY_DATY_ROZLICZENIA) <> 'NULL'
      )
      OR
      (
        INFORMACJA_ZARZAD IS NOT NULL
        AND JSON_TYPE(INFORMACJA_ZARZAD) <> 'NULL'
      )
    `
    );

    const safeJsonArray = (value) => {
      if (!value) return [];

      if (Array.isArray(value)) return value;

      if (typeof value === "string") {
        try {
          const parsed = JSON.parse(value);
          return Array.isArray(parsed) ? parsed : [];
        } catch {
          return [];
        }
      }

      return [];
    };

    for (const doc of docActions) {
      const infoZarzad = safeJsonArray(doc.INFORMACJA_ZARZAD);
      const historiaRozl = safeJsonArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);

      const newInfo = infoZarzad.map((item) => ({
        date: "",
        note: item,
        profile: "Pracownik",
        username: "",
        userlogin: "brak danych",
      }));

      const newHistoria = historiaRozl.map((item) => ({
        date: "",
        note: item,
        profile: "Pracownik",
        username: "",
        userlogin: "brak danych",
      }));

      await connect_SQL.query(
        "UPDATE company_documents_actions SET INFORMACJA_ZARZAD = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ? WHERE id_action = ?",
        [JSON.stringify(newInfo), JSON.stringify(newHistoria), doc.id_action]
      );
    }

    const [manageDateDecision] = await connect_SQL.query(
      "SELECT * FROM company_management_date_description_FK"
    );
    for (const doc of manageDateDecision) {
      const infoZarzad = safeJsonArray(doc.INFORMACJA_ZARZAD);
      const historiaRozl = safeJsonArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);

      const newInfo = infoZarzad.map((item) => ({
        date: "",
        note: item,
        profile: "Pracownik",
        username: "",
        userlogin: "brak danych",
      }));

      const newHistoria = historiaRozl.map((item) => ({
        date: "",
        note: item,
        profile: "Pracownik",
        username: "",
        userlogin: "brak danych",
      }));

      await connect_SQL.query(
        "UPDATE company_management_date_description_FK SET INFORMACJA_ZARZAD = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ? WHERE id_management_date_description_FK = ?",
        [
          JSON.stringify(newInfo) ?? [],
          JSON.stringify(newHistoria) ?? [],
          doc.id_management_date_description_FK,
        ]
      );
    }
  } catch (error) {
    console.error(error);
  }
};

// / generuję historię decyzji i ostatecznej daty rozliczenia
// const generateHistoryDocuments = async (company) => {
//   console.log(company);
//   try {
//     const [raportDate] = await connect_SQL.query(
//       `SELECT DATE FROM  company_fk_updates_date WHERE title = 'raport' AND COMPANY = ?`,
//       [company]
//     );

//     const [markDocuments] = await connect_SQL.query(
//       `SELECT NUMER_FV, COMPANY FROM company_mark_documents WHERE RAPORT_FK = 1 AND COMPANY = ?`,
//       [company]
//     );

//     for (item of markDocuments) {
//       // sprawdzam czy dokument ma wpisy histori w tabeli management_decision_FK
//       const [getDoc] = await connect_SQL.query(
//         `SELECT * FROM company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`,
//         [item.NUMER_FV, raportDate[0].DATE, company]
//       );

//       // if (item.NUMER_FV === "FV/UP/885/25/D/D66") {
//       //   console.log(item);
//       // }
//       //szukam czy jest wpis histori w tabeli history_fk_documents
//       const [getDocHist] = await connect_SQL.query(
//         `SELECT HISTORY_DOC FROM company_history_management WHERE NUMER_FV = ? AND COMPANY = ?`,
//         [item.NUMER_FV, company]
//       );
//       if (getDocHist.length) {
//         console.log(getDocHist[0].HISTORY_DOC);
//       }

//       // tworzę string z danych obiektu
//       const formatHistoryItem = ({ date, note, username }) =>
//         [date, note, username].filter(Boolean).join(" - ");
//       //jesli nie ma historycznych wpisów tworzę nowy
//       if (!getDocHist.length) {
//         const newHistory = {
//           info: `1 raport utworzono ${raportDate[0].DATE}`,
//           historyDate: [],
//           historyText: [],
//         };

//         // Przechodzimy przez każdy obiekt w getDoc i dodajemy wartości do odpowiednich tablic
//         getDoc.forEach((doc) => {
//           if (Array.isArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA)) {
//             newHistory.historyDate.push(
//               ...doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.map(formatHistoryItem)
//             );
//           }

//           if (Array.isArray(doc.INFORMACJA_ZARZAD)) {
//             newHistory.historyText.push(
//               ...doc.INFORMACJA_ZARZAD.map(formatHistoryItem)
//             );
//           }
//         });
//         // console.log([newHistory]);
//         // await connect_SQL.query(
//         //   `INSERT INTO company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
//         //   [item.NUMER_FV, JSON.stringify([newHistory]), company]
//         // );
//       } else {
//         const newHistory = {
//           info: `${getDocHist[0].HISTORY_DOC.length + 1} raport utworzono ${
//             raportDate[0].DATE
//           }`,
//           historyDate: [],
//           historyText: [],
//         };
//         // getDoc.forEach((doc) => {
//         //   if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
//         //     newHistory.historyDate.push(
//         //       ...doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA
//         //     );
//         //   }
//         //   if (doc.INFORMACJA_ZARZAD) {
//         //     newHistory.historyText.push(...doc.INFORMACJA_ZARZAD);
//         //   }
//         // });
//         getDoc.forEach((doc) => {
//           if (Array.isArray(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA)) {
//             newHistory.historyDate.push(
//               ...doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.map(formatHistoryItem)
//             );
//           }

//           if (Array.isArray(doc.INFORMACJA_ZARZAD)) {
//             newHistory.historyText.push(
//               ...doc.INFORMACJA_ZARZAD.map(formatHistoryItem)
//             );
//           }
//         });
//         const prepareArray = [...getDocHist[0].HISTORY_DOC, newHistory];
//         console.log(prepareArray);
//         console.log(item);
//         // await connect_SQL.query(
//         //   `UPDATE company_history_management SET HISTORY_DOC = ? WHERE NUMER_FV = ? AND COMPANY = ?`,
//         //   [JSON.stringify(prepareArray), item.NUMER_FV, company]
//         // );
//       }
//     }
//   } catch (error) {
//     logEvents(
//       `fKRaportController, generateHistoryDocuments: ${error}`,
//       "reqServerErrors.txt"
//     );
//   }
// };

const repair = async () => {
  try {
    // await changeDocumentsTable();
    // console.log("changeDocumentsTable");
    // await changeControlBLTable();
    // console.log("changeControlBLTable");
    // await repairVatColumns();
    // console.log("repairVatColumns");
    // await managementRepair();
    // console.log("managementRepair");
    // // aktualizacja rozrachunków - czas kilka min
    // await updateSettlementDescription();
    // console.log("updateSettlementDescription");
    // await generateHistoryDocuments("KRT");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
