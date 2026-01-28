const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const {
  generatePassword,
  documentsType,
  addDepartment,
  getLastMonthDate,
} = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");
const { addDocumentToDatabase } = require("./getDataFromMSSQL");
const { syncColumns } = require("./tableController");
const { calculateCommercialInterest } = require("./payGuard");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const validator = require("validator");

//zebrane kawałki kodu, nieużywac funkcji
const test = async () => {
  // await connect_SQL.query(
  //   "ALTER TABLE company_documents_actions CHANGE COLUMN UWAGI_ASYSTENT KANAL_KOMUNIKACJI JSON"
  // );
  // await connect_SQL.query(
  //   "ALTER TABLE company_insurance_documents  ADD KWOTA_DOKUMENT  DECIMAL(12,2) NULL AFTER OW"
  // );
  // await connect_SQL.query(
  //   "CREATE TABLE company_pay_guard (  id_pay_guard INT UNSIGNED AUTO_INCREMENT,  value VARCHAR(255) NULL,  PROCENTY_ROK JSON  NULL,  WOLNE_USTAWOWE JSON NULL,  PRIMARY KEY (id_pay_guard),  UNIQUE KEY uq_id_pay_guard (id_pay_guard)) ENGINE=InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci"
  // );
};

// const generateHistoryDocuments = async (company) => {
//   try {
//     const [raportDate] = await connect_SQL.query(
//       `SELECT DATE FROM  company_fk_updates_date WHERE title = 'raport' AND COMPANY = ?`,
//       [company]
//     );
//     const [markDocumentsz] = await connect_SQL.query(
//       `SELECT NUMER_FV, COMPANY FROM company_mark_documents WHERE RAPORT_FK = 1 AND COMPANY = ?`,
//       [company]
//     );

//     const markDocuments = [{ NUMER_FV: "FV/UBL/105/25/D/D68", COMPANY: "KRT" }];

//     // for (const doc of markDocuments) {
//     //   if (doc.NUMER_FV === "FV/UBL/105/25/D/D68") {
//     //     console.log(doc);
//     //   }
//     // }

//     for (item of markDocuments) {
//       // sprawdzam czy dokument ma wpisy histori w tabeli management_decision_FK
//       const [getDoc] = await connect_SQL.query(
//         `SELECT * FROM company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`,
//         [item.NUMER_FV, raportDate[0].DATE, company]
//       );
//       console.log(getDoc);
//       //szukam czy jest wpis histori w tabeli history_fk_documents
//       const [getDocHist] = await connect_SQL.query(
//         `SELECT HISTORY_DOC FROM company_history_management WHERE NUMER_FV = ? AND COMPANY = ?`,
//         [item.NUMER_FV, company]
//       );
//       // console.log(getDocHist[0].HISTORY_DOC);
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
//         // await connect_SQL.query(
//         //   `UPDATE company_history_management SET HISTORY_DOC = ? WHERE NUMER_FV = ? AND COMPANY = ?`,
//         //   [JSON.stringify(prepareArray), item.NUMER_FV, company]
//         // );
//       }
//     }
//   } catch (error) {
//     console.error(error);
//   }
// };

const createKontrahentTable = async () => {
  try {
    await connect_SQL.query(
      "      CREATE TABLE company_contractor (  id_kontrahent INT NOT NULL AUTO_INCREMENT,     AK_KOD VARCHAR(20) NULL,     AK_KRAJ VARCHAR(100) NULL,     AK_MIASTO VARCHAR(100) NULL,     AK_NRDOMU VARCHAR(20) NULL,     AK_NRLOKALU VARCHAR(20) NULL,     AK_ULICA_EXT VARCHAR(255) NULL,     A_KOD VARCHAR(20) NULL,    A_KRAJ VARCHAR(100) NULL,     A_MIASTO VARCHAR(100) NULL,     A_NRDOMU VARCHAR(20) NULL,     A_NRLOKALU VARCHAR(20) NULL,     A_ULICA_EXT VARCHAR(255) NULL,  CUSTOMER_ID_CKK VARCHAR(20) NULL,   EMAIL JSON NULL,     IS_FIRMA TINYINT(1) NULL,     KOD_KONTR_LISTA VARCHAR(100) NULL,     KONTR_NIP VARCHAR(20) NULL,     KONTRAHENT_ID INT NOT NULL,     NAZWA_KONTRAHENTA_SLOWNIK VARCHAR(500) NULL,     PESEL VARCHAR(20) NULL,     PLATNOSCPOTEM_DNI INT NULL,     PRZYPISANA_FORMA_PLATNOSCI VARCHAR(100) NULL,     REGON VARCHAR(20) NULL,     SPOLKA VARCHAR(10) NOT NULL,     TELEFON JSON NULL, STATUS_WINDYKACJI TINYINT(1) NULL,     PRIMARY KEY (id_kontrahent),      UNIQUE INDEX uidx_kontrahent_spolka (KONTRAHENT_ID, SPOLKA),         INDEX idx_kontr_nip (KONTR_NIP) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci      "
    );
  } catch (error) {
    console.error(error);
  }
};

const updateKontrahentIDKRT1 = async () => {
  try {
    const BATCH_SIZE = 400;
    const MAX_ITERATIONS = 1000;

    // Zmienna, która będzie pamiętać, gdzie skończyliśmy w poprzedniej paczce
    let lastProcessedId = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(
        `Iteracja ${i + 1}: Szukam dokumentów o id > ${lastProcessedId}...`
      );

      // 1. Pobieramy paczkę, ale filtrujemy po id_document, żeby nie stać w miejscu
      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA IN ('KRT') 
         AND DATA_FV > '2024-01-01' 
         AND KONTRAHENT_ID IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Brak kolejnych dokumentów do sprawdzenia. Kończę.");
        break;
      }

      // Ustawiamy ID ostatniego dokumentu z tej paczki,
      // dzięki temu w następnej iteracji pobierzemy KOLEJNE 1000 sztuk,
      // nawet jeśli te obecne nie zostaną zaktualizowane.
      lastProcessedId = documents[documents.length - 1].id_document;

      const numerList = documents.map((doc) => `'${doc.NUMER_FV}'`).join(", ");

      try {
        const contarctor_id = await msSqlQuery(
          `SELECT NUMER, KONTRAHENT_ID FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerList})`
        );

        if (contarctor_id.length > 0) {
          console.log(
            `Znaleziono ${contarctor_id.length} powiązań w MSSQL. Aktualizuję...`
          );

          for (const row of contarctor_id) {
            // Ważne: sprawdzamy czy KONTRAHENT_ID z MSSQL nie jest NULLem
            if (row.KONTRAHENT_ID !== null) {
              await connect_SQL.query(
                "UPDATE company_documents SET KONTRAHENT_ID = ? WHERE NUMER_FV = ?",
                [row.KONTRAHENT_ID, row.NUMER]
              );
            }
          }
        } else {
          console.log("W tej paczce nie znaleziono żadnych dopasowań w MSSQL.");
        }
      } catch (err) {
        console.error(`Błąd MSSQL w iteracji ${i + 1}:`, err);
      }

      console.log(
        `Zakończono paczkę ${i + 1}. Ostatnie sprawdzone ID: ${lastProcessedId}`
      );
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const updateKontrahentIDKRT = async () => {
  try {
    const BATCH_SIZE = 1000; // Możesz zwiększyć do 1000-2000
    let lastProcessedId = 0;

    // Pętla będzie działać dopóki są dane
    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA = 'KRT' 
         AND DATA_FV > '2024-01-01' 
         AND FAKT_BANK_KONTO IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      lastProcessedId = documents[documents.length - 1].id_document;
      const numerFVArray = documents.map((doc) => doc.NUMER_FV);

      try {
        // 1. Pobieramy dane z MSSQL
        // Używamy parametrów, aby uniknąć problemów z zapytaniem
        const matches = await msSqlQuery(
          `SELECT NUMER, FAKT_BANK_KONTO FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerFVArray.map((n) => `'${n}'`).join(",")})`
        );

        if (matches.length > 0) {
          console.log(
            `Znaleziono ${matches.length} dopasowań. Aktualizuję grupowo...`
          );

          // 2. OPTYMALIZACJA: Zamiast pętli z UPDATE, budujemy jedno zapytanie CASE
          // lub wykonujemy aktualizacje równolegle (Promise.all)

          // Opcja A: Równoległe Promise.all (Szybsze niż pętla for-await)
          // Limitujemy konkurencję, żeby nie "zabić" puli połączeń
          const updatePromises = matches
            .filter((row) => row.KONTRAHENT_ID !== null)
            .map((row) =>
              connect_SQL.query(
                "UPDATE company_documents SET FAKT_BANK_KONTO = ? WHERE NUMER_FV = ? AND FIRMA = 'KRT'",
                [row.FAKT_BANK_KONTO, row.NUMER]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const updateKontrahentIDKEM = async () => {
  try {
    const BATCH_SIZE = 1000; // Możesz zwiększyć do 1000-2000
    let lastProcessedId = 0;

    // Pętla będzie działać dopóki są dane
    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA = 'KEM' 
         AND DATA_FV > '2024-01-01' 
         AND KONTRAHENT_ID IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      lastProcessedId = documents[documents.length - 1].id_document;
      const numerFVArray = documents.map((doc) => doc.NUMER_FV);

      try {
        // 1. Pobieramy dane z MSSQL
        // Używamy parametrów, aby uniknąć problemów z zapytaniem
        const matches = await msSqlQuery(
          `SELECT NUMER, KONTRAHENT_ID FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerFVArray.map((n) => `'${n}'`).join(",")})`
        );

        if (matches.length > 0) {
          console.log(
            `Znaleziono ${matches.length} dopasowań. Aktualizuję grupowo...`
          );

          // 2. OPTYMALIZACJA: Zamiast pętli z UPDATE, budujemy jedno zapytanie CASE
          // lub wykonujemy aktualizacje równolegle (Promise.all)

          // Opcja A: Równoległe Promise.all (Szybsze niż pętla for-await)
          // Limitujemy konkurencję, żeby nie "zabić" puli połączeń
          const updatePromises = matches
            .filter((row) => row.KONTRAHENT_ID !== null)
            .map((row) =>
              connect_SQL.query(
                "UPDATE company_documents SET KONTRAHENT_ID = ? WHERE NUMER_FV = ? AND FIRMA = 'KEM'",
                [row.KONTRAHENT_ID, row.NUMER]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const xxxupdateKontrahentIDKEM = async () => {
  try {
    const BATCH_SIZE = 1000;
    const MAX_ITERATIONS = 50;

    // Zmienna, która będzie pamiętać, gdzie skończyliśmy w poprzedniej paczce
    let lastProcessedId = 0;

    for (let i = 0; i < MAX_ITERATIONS; i++) {
      console.log(
        `Iteracja ${i + 1}: Szukam dokumentów o id > ${lastProcessedId}...`
      );

      // 1. Pobieramy paczkę, ale filtrujemy po id_document, żeby nie stać w miejscu
      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA IN ('KEM') 
         AND DATA_FV > '2024-01-01' 
         AND KONTRAHENT_ID IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Brak kolejnych dokumentów do sprawdzenia. Kończę.");
        break;
      }

      // Ustawiamy ID ostatniego dokumentu z tej paczki,
      // dzięki temu w następnej iteracji pobierzemy KOLEJNE 1000 sztuk,
      // nawet jeśli te obecne nie zostaną zaktualizowane.
      lastProcessedId = documents[documents.length - 1].id_document;

      const numerList = documents.map((doc) => `'${doc.NUMER_FV}'`).join(", ");

      try {
        const contarctor_id = await msSqlQuery(
          `SELECT NUMER, KONTRAHENT_ID FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerList})`
        );

        if (contarctor_id.length > 0) {
          console.log(
            `Znaleziono ${contarctor_id.length} powiązań w MSSQL. Aktualizuję...`
          );

          for (const row of contarctor_id) {
            // Ważne: sprawdzamy czy KONTRAHENT_ID z MSSQL nie jest NULLem
            if (row.KONTRAHENT_ID !== null) {
              await connect_SQL.query(
                "UPDATE company_documents SET KONTRAHENT_ID = ? WHERE NUMER_FV = ?",
                [row.KONTRAHENT_ID, row.NUMER]
              );
            }
          }
        } else {
          console.log("W tej paczce nie znaleziono żadnych dopasowań w MSSQL.");
        }
      } catch (err) {
        console.error(`Błąd MSSQL w iteracji ${i + 1}:`, err);
      }

      console.log(
        `Zakończono paczkę ${i + 1}. Ostatnie sprawdzone ID: ${lastProcessedId}`
      );
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const xxxxupdateTableContractorKRT1 = async () => {
  const BATCH_SIZE = 1000;
  const type = "KRT";
  let lastProcessedId = 0;

  // --- POPRAWIONA FUNKCJA PRZETWARZANIA TELEFONÓW (Z SET/MAP) ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);

    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);

      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }

      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }

      // DODAWANIE TYLKO UNIKALNYCH
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  // --- POPRAWIONA FUNKCJA PRZETWARZANIA MAILI (Z SET/MAP) ---
  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);

    const uniqueMap = new Map();

    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);

      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  try {
    while (true) {
      console.log(`Pobieram paczkę kontrahentów o ID > ${lastProcessedId}...`);

      const query = `
        SELECT TOP (${BATCH_SIZE})
            k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
            k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
            zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
            k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
            k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
            k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
            k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ,
            ckk.CUSTOMER_ID
        FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID > ${lastProcessedId}
        ORDER BY k.KONTRAHENT_ID ASC
      `;

      const contractors = await msSqlQuery(query);

      if (!contractors || contractors.length === 0) {
        console.log("Koniec danych w MSSQL.");
        break;
      }

      lastProcessedId = contractors[contractors.length - 1].KONTRAHENT_ID;

      for (const doc of contractors) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        const [existing] = await connect_SQL.query(
          "SELECT EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID = ? AND SPOLKA = ?",
          [doc.KONTRAHENT_ID, type]
        );

        let finalPhones = [];
        let finalEmails = [];

        // --- MERGE Z CZYSZCZENIEM ISTNIEJĄCYCH DUPLIKATÓW ---
        if (existing.length > 0) {
          try {
            const oldT =
              typeof existing[0].TELEFON === "string"
                ? JSON.parse(existing[0].TELEFON)
                : existing[0].TELEFON || [];
            const oldE =
              typeof existing[0].EMAIL === "string"
                ? JSON.parse(existing[0].EMAIL)
                : existing[0].EMAIL || [];

            // Czyścimy stare dane z duplikatów przy użyciu Mapy
            const cleanOldMapT = new Map();
            if (Array.isArray(oldT))
              oldT.forEach((item) => {
                if (item.value) cleanOldMapT.set(item.value, item);
              });

            const cleanOldMapE = new Map();
            if (Array.isArray(oldE))
              oldE.forEach((item) => {
                if (item.value) cleanOldMapE.set(item.value, item);
              });

            // Dodajemy nowe dane do wyczyszczonych starych
            newPhones.forEach((np) => {
              if (!cleanOldMapT.has(np.value)) cleanOldMapT.set(np.value, np);
            });
            newEmails.forEach((ne) => {
              if (!cleanOldMapE.has(ne.value)) cleanOldMapE.set(ne.value, ne);
            });

            finalPhones = Array.from(cleanOldMapT.values());
            finalEmails = Array.from(cleanOldMapE.values());
          } catch (e) {
            console.error("Błąd parsowania dla ID:", doc.KONTRAHENT_ID);
            finalPhones = newPhones;
            finalEmails = newEmails;
          }
        } else {
          finalPhones = newPhones;
          finalEmails = newEmails;
        }

        // Zapis do MySQL
        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [
            doc.AK_KOD || null,
            doc.AK_KRAJ || null,
            doc.AK_MIASTO || null,
            doc.AK_NRDOMU || null,
            doc.AK_NRLOKALU || null,
            doc.AK_ULICA_EXT || null,
            doc.A_KOD || null,
            doc.A_KRAJ || null,
            doc.A_MIASTO || null,
            doc.A_NRDOMU || null,
            doc.A_NRLOKALU || null,
            doc.A_ULICA_EXT || null,
            doc.CUSTOMER_ID || null,
            JSON.stringify(finalEmails),
            doc.IS_FIRMA ? 1 : 0,
            doc.KOD_KONTR_LISTA || null,
            doc.KONTR_NIP || null,
            doc.KONTRAHENT_ID,
            doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
            doc.PESEL || null,
            doc.PLATNOSCPOTEM_DNI || null,
            doc.PRZYPISANA_FORMA_PLATNOSCI || null,
            doc.REGON || null,
            type,
            JSON.stringify(finalPhones),
          ]
        );
      }
      console.log(`Przetworzono paczkę. Ostatnie ID: ${lastProcessedId}`);
    }
    console.log("AKTUALIZACJA ZAKOŃCZONA SUKCESEM.");
  } catch (error) {
    console.error("Błąd krytyczny:", error);
  }
};

const xxxxxupdateTableContractorKEM1 = async () => {
  const BATCH_SIZE = 1000;
  const type = "KEM";
  let lastProcessedId = 0;

  // --- POPRAWIONA FUNKCJA PRZETWARZANIA TELEFONÓW (Z SET/MAP) ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);

    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);

      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }

      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }

      // DODAWANIE TYLKO UNIKALNYCH
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  // --- POPRAWIONA FUNKCJA PRZETWARZANIA MAILI (Z SET/MAP) ---
  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);

    const uniqueMap = new Map();

    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);

      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  try {
    while (true) {
      console.log(`Pobieram paczkę kontrahentów o ID > ${lastProcessedId}...`);

      const query = `
        SELECT TOP (${BATCH_SIZE})
            k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
            k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
            zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
            k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
            k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
            k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
            k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ,
            ckk.CUSTOMER_ID
        FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID > ${lastProcessedId}
        ORDER BY k.KONTRAHENT_ID ASC
      `;

      const contractors = await msSqlQuery(query);

      if (!contractors || contractors.length === 0) {
        console.log("Koniec danych w MSSQL.");
        break;
      }

      lastProcessedId = contractors[contractors.length - 1].KONTRAHENT_ID;

      for (const doc of contractors) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        const [existing] = await connect_SQL.query(
          "SELECT EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID = ? AND SPOLKA = ?",
          [doc.KONTRAHENT_ID, type]
        );

        let finalPhones = [];
        let finalEmails = [];

        // --- MERGE Z CZYSZCZENIEM ISTNIEJĄCYCH DUPLIKATÓW ---
        if (existing.length > 0) {
          try {
            const oldT =
              typeof existing[0].TELEFON === "string"
                ? JSON.parse(existing[0].TELEFON)
                : existing[0].TELEFON || [];
            const oldE =
              typeof existing[0].EMAIL === "string"
                ? JSON.parse(existing[0].EMAIL)
                : existing[0].EMAIL || [];

            // Czyścimy stare dane z duplikatów przy użyciu Mapy
            const cleanOldMapT = new Map();
            if (Array.isArray(oldT))
              oldT.forEach((item) => {
                if (item.value) cleanOldMapT.set(item.value, item);
              });

            const cleanOldMapE = new Map();
            if (Array.isArray(oldE))
              oldE.forEach((item) => {
                if (item.value) cleanOldMapE.set(item.value, item);
              });

            // Dodajemy nowe dane do wyczyszczonych starych
            newPhones.forEach((np) => {
              if (!cleanOldMapT.has(np.value)) cleanOldMapT.set(np.value, np);
            });
            newEmails.forEach((ne) => {
              if (!cleanOldMapE.has(ne.value)) cleanOldMapE.set(ne.value, ne);
            });

            finalPhones = Array.from(cleanOldMapT.values());
            finalEmails = Array.from(cleanOldMapE.values());
          } catch (e) {
            console.error("Błąd parsowania dla ID:", doc.KONTRAHENT_ID);
            finalPhones = newPhones;
            finalEmails = newEmails;
          }
        } else {
          finalPhones = newPhones;
          finalEmails = newEmails;
        }

        // Zapis do MySQL
        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [
            doc.AK_KOD || null,
            doc.AK_KRAJ || null,
            doc.AK_MIASTO || null,
            doc.AK_NRDOMU || null,
            doc.AK_NRLOKALU || null,
            doc.AK_ULICA_EXT || null,
            doc.A_KOD || null,
            doc.A_KRAJ || null,
            doc.A_MIASTO || null,
            doc.A_NRDOMU || null,
            doc.A_NRLOKALU || null,
            doc.A_ULICA_EXT || null,
            doc.CUSTOMER_ID || null,
            JSON.stringify(finalEmails),
            doc.IS_FIRMA ? 1 : 0,
            doc.KOD_KONTR_LISTA || null,
            doc.KONTR_NIP || null,
            doc.KONTRAHENT_ID,
            doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
            doc.PESEL || null,
            doc.PLATNOSCPOTEM_DNI || null,
            doc.PRZYPISANA_FORMA_PLATNOSCI || null,
            doc.REGON || null,
            type,
            JSON.stringify(finalPhones),
          ]
        );
      }
      console.log(`Przetworzono paczkę. Ostatnie ID: ${lastProcessedId}`);
    }
    console.log("AKTUALIZACJA ZAKOŃCZONA SUKCESEM.");
  } catch (error) {
    console.error("Błąd krytyczny:", error);
  }
};

const xxxupdateTableContractorKRT = async () => {
  const BATCH_SIZE = 1000;
  const type = "KRT";

  // --- FUNKCJE POMOCNICZE (UNIKALNOŚĆ) ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);
    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);
      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }
      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);
    const uniqueMap = new Map();
    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);
      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  try {
    // 1. POBIERAMY LISTĘ ID KONTRAHENTÓW Z MYSQL (ok. 80 tys.)
    console.log("Pobieram listę KONTRAHENT_ID z MySQL...");
    const [resultId] = await connect_SQL.query(
      `SELECT DISTINCT KONTRAHENT_ID FROM company_documents WHERE DATA_FV > '2024-01-01' AND FIRMA = 'KRT' AND KONTRAHENT_ID IS NOT NULL`
    );

    const idList = resultId.map((row) => row.KONTRAHENT_ID);
    console.log(`Znaleziono ${idList.length} kontrahentów do aktualizacji.`);

    // 2. PRZETWARZAMY W PACZKACH PO 1000
    for (let i = 0; i < idList.length; i += BATCH_SIZE) {
      const batchIds = idList.slice(i, i + BATCH_SIZE);
      const idString = batchIds.join(",");

      console.log(
        `Przetwarzam paczkę ${i / BATCH_SIZE + 1} / ${Math.ceil(idList.length / BATCH_SIZE)}...`
      );

      const query = `
        SELECT
            k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
            k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
            zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
            k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
            k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
            k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
            k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ,
            ckk.CUSTOMER_ID
        FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID IN (${idString})
      `;

      const mssqlResults = await msSqlQuery(query);

      for (const doc of mssqlResults) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        const [existing] = await connect_SQL.query(
          "SELECT EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID = ? AND SPOLKA = ?",
          [doc.KONTRAHENT_ID, type]
        );

        let finalPhones = [];
        let finalEmails = [];

        if (existing.length > 0) {
          try {
            const oldT =
              typeof existing[0].TELEFON === "string"
                ? JSON.parse(existing[0].TELEFON)
                : existing[0].TELEFON || [];
            const oldE =
              typeof existing[0].EMAIL === "string"
                ? JSON.parse(existing[0].EMAIL)
                : existing[0].EMAIL || [];

            const cleanOldMapT = new Map();
            if (Array.isArray(oldT))
              oldT.forEach((item) => {
                if (item.value) cleanOldMapT.set(item.value, item);
              });

            const cleanOldMapE = new Map();
            if (Array.isArray(oldE))
              oldE.forEach((item) => {
                if (item.value) cleanOldMapE.set(item.value, item);
              });

            newPhones.forEach((np) => {
              if (!cleanOldMapT.has(np.value)) cleanOldMapT.set(np.value, np);
            });
            newEmails.forEach((ne) => {
              if (!cleanOldMapE.has(ne.value)) cleanOldMapE.set(ne.value, ne);
            });

            finalPhones = Array.from(cleanOldMapT.values());
            finalEmails = Array.from(cleanOldMapE.values());
          } catch (e) {
            finalPhones = newPhones;
            finalEmails = newEmails;
          }
        } else {
          finalPhones = newPhones;
          finalEmails = newEmails;
        }

        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [
            doc.AK_KOD || null,
            doc.AK_KRAJ || null,
            doc.AK_MIASTO || null,
            doc.AK_NRDOMU || null,
            doc.AK_NRLOKALU || null,
            doc.AK_ULICA_EXT || null,
            doc.A_KOD || null,
            doc.A_KRAJ || null,
            doc.A_MIASTO || null,
            doc.A_NRDOMU || null,
            doc.A_NRLOKALU || null,
            doc.A_ULICA_EXT || null,
            doc.CUSTOMER_ID || null,
            JSON.stringify(finalEmails),
            doc.IS_FIRMA ? 1 : 0,
            doc.KOD_KONTR_LISTA || null,
            doc.KONTR_NIP || null,
            doc.KONTRAHENT_ID,
            doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
            doc.PESEL || null,
            doc.PLATNOSCPOTEM_DNI || null,
            doc.PRZYPISANA_FORMA_PLATNOSCI || null,
            doc.REGON || null,
            type,
            JSON.stringify(finalPhones),
          ]
        );
      }
    }
    console.log("AKTUALIZACJA ZAKOŃCZONA SUKCESEM.");
  } catch (error) {
    console.error("Błąd krytyczny:", error);
  }
};

const updateTableContractorKRT = async () => {
  const BATCH_SIZE = 1000;
  const type = "KRT";

  // --- FUNKCJE POMOCNICZE WEWNĄTRZ ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);
    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);
      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }
      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);
    const uniqueMap = new Map();
    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);
      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const mergeData = (oldJson, newData) => {
    try {
      const oldData =
        typeof oldJson === "string" ? JSON.parse(oldJson) : oldJson || [];
      if (!Array.isArray(oldData)) return newData;

      const map = new Map();
      oldData.forEach((item) => {
        if (item.value) map.set(item.value, item);
      });
      newData.forEach((item) => {
        if (!map.has(item.value)) map.set(item.value, item);
      });

      return Array.from(map.values());
    } catch (e) {
      return newData;
    }
  };

  try {
    console.log("Pobieram listę KONTRAHENT_ID z MySQL...");
    const [resultId] = await connect_SQL.query(
      `SELECT DISTINCT KONTRAHENT_ID FROM company_documents 
       WHERE DATA_FV > '2024-01-01' AND FIRMA = ? AND KONTRAHENT_ID IS NOT NULL`,
      [type]
    );

    const idList = resultId.map((row) => row.KONTRAHENT_ID);
    console.log(`Znaleziono ${idList.length} kontrahentów do przetworzenia.`);

    for (let i = 0; i < idList.length; i += BATCH_SIZE) {
      const batchIds = idList.slice(i, i + BATCH_SIZE);
      console.log(
        `Przetwarzam paczkę ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(idList.length / BATCH_SIZE)}...`
      );

      // 1. MSSQL - Pobranie danych dla paczki
      const mssqlResults = await msSqlQuery(`
        SELECT k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
               k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
               zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
               k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
               k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
               k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
               k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ, ckk.CUSTOMER_ID
        FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID IN (${batchIds.join(",")})
      `);

      // 2. MySQL - Pobranie istniejących rekordów dla paczki
      const [existingRows] = await connect_SQL.query(
        "SELECT KONTRAHENT_ID, EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID IN (?) AND SPOLKA = ?",
        [batchIds, type]
      );
      const existingMap = new Map(
        existingRows.map((row) => [row.KONTRAHENT_ID, row])
      );

      // 3. Budowanie danych do wstawienia
      const valuesToInsert = [];

      for (const doc of mssqlResults) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        let finalPhones = newPhones;
        let finalEmails = newEmails;

        const existing = existingMap.get(doc.KONTRAHENT_ID);
        if (existing) {
          finalPhones = mergeData(existing.TELEFON, newPhones);
          finalEmails = mergeData(existing.EMAIL, newEmails);
        }

        valuesToInsert.push([
          doc.AK_KOD || null,
          doc.AK_KRAJ || null,
          doc.AK_MIASTO || null,
          doc.AK_NRDOMU || null,
          doc.AK_NRLOKALU || null,
          doc.AK_ULICA_EXT || null,
          doc.A_KOD || null,
          doc.A_KRAJ || null,
          doc.A_MIASTO || null,
          doc.A_NRDOMU || null,
          doc.A_NRLOKALU || null,
          doc.A_ULICA_EXT || null,
          doc.CUSTOMER_ID || null,
          JSON.stringify(finalEmails),
          doc.IS_FIRMA ? 1 : 0,
          doc.KOD_KONTR_LISTA || null,
          doc.KONTR_NIP || null,
          doc.KONTRAHENT_ID,
          doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
          doc.PESEL || null,
          doc.PLATNOSCPOTEM_DNI || null,
          doc.PRZYPISANA_FORMA_PLATNOSCI || null,
          doc.REGON || null,
          type,
          JSON.stringify(finalPhones),
        ]);
      }

      // 4. Masowy UPDATE/INSERT
      if (valuesToInsert.length > 0) {
        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES ? 
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [valuesToInsert]
        );
      }
    }
    console.log("AKTUALIZACJA ZAKOŃCZONA SUKCESEM.");
  } catch (error) {
    console.error("Błąd krytyczny:", error);
  }
};

// Funkcja pomocnicza do merge'owania JSONów (wyciągnięta na zewnątrz dla czytelności)
function mergeData(oldJson, newData) {
  try {
    const oldData =
      typeof oldJson === "string" ? JSON.parse(oldJson) : oldJson || [];
    if (!Array.isArray(oldData)) return newData;

    const map = new Map();
    oldData.forEach((item) => {
      if (item.value) map.set(item.value, item);
    });
    newData.forEach((item) => {
      if (!map.has(item.value)) map.set(item.value, item);
    });

    return Array.from(map.values());
  } catch (e) {
    return newData;
  }
}

const xxxupdateTableContractorKEM = async () => {
  const BATCH_SIZE = 1000;
  const type = "KEM";

  // --- FUNKCJE POMOCNICZE (UNIKALNOŚĆ) ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);
    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);
      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }
      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);
    const uniqueMap = new Map();
    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);
      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  try {
    // 1. POBIERAMY LISTĘ ID KONTRAHENTÓW Z MYSQL (ok. 80 tys.)
    console.log("Pobieram listę KONTRAHENT_ID z MySQL...");
    const [resultId] = await connect_SQL.query(
      `SELECT DISTINCT KONTRAHENT_ID FROM company_documents WHERE DATA_FV > '2024-01-01' AND FIRMA = 'KEM' AND KONTRAHENT_ID IS NOT NULL`
    );

    const idList = resultId.map((row) => row.KONTRAHENT_ID);
    console.log(`Znaleziono ${idList.length} kontrahentów do aktualizacji.`);

    // 2. PRZETWARZAMY W PACZKACH PO 1000
    for (let i = 0; i < idList.length; i += BATCH_SIZE) {
      const batchIds = idList.slice(i, i + BATCH_SIZE);
      const idString = batchIds.join(",");

      console.log(
        `Przetwarzam paczkę ${i / BATCH_SIZE + 1} / ${Math.ceil(idList.length / BATCH_SIZE)}...`
      );

      const query = `
        SELECT
            k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
            k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
            zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
            k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
            k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
            k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
            k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ,
            ckk.CUSTOMER_ID
        FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID IN (${idString})
      `;

      const mssqlResults = await msSqlQuery(query);

      for (const doc of mssqlResults) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        const [existing] = await connect_SQL.query(
          "SELECT EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID = ? AND SPOLKA = ?",
          [doc.KONTRAHENT_ID, type]
        );

        let finalPhones = [];
        let finalEmails = [];

        if (existing.length > 0) {
          try {
            const oldT =
              typeof existing[0].TELEFON === "string"
                ? JSON.parse(existing[0].TELEFON)
                : existing[0].TELEFON || [];
            const oldE =
              typeof existing[0].EMAIL === "string"
                ? JSON.parse(existing[0].EMAIL)
                : existing[0].EMAIL || [];

            const cleanOldMapT = new Map();
            if (Array.isArray(oldT))
              oldT.forEach((item) => {
                if (item.value) cleanOldMapT.set(item.value, item);
              });

            const cleanOldMapE = new Map();
            if (Array.isArray(oldE))
              oldE.forEach((item) => {
                if (item.value) cleanOldMapE.set(item.value, item);
              });

            newPhones.forEach((np) => {
              if (!cleanOldMapT.has(np.value)) cleanOldMapT.set(np.value, np);
            });
            newEmails.forEach((ne) => {
              if (!cleanOldMapE.has(ne.value)) cleanOldMapE.set(ne.value, ne);
            });

            finalPhones = Array.from(cleanOldMapT.values());
            finalEmails = Array.from(cleanOldMapE.values());
          } catch (e) {
            finalPhones = newPhones;
            finalEmails = newEmails;
          }
        } else {
          finalPhones = newPhones;
          finalEmails = newEmails;
        }

        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [
            doc.AK_KOD || null,
            doc.AK_KRAJ || null,
            doc.AK_MIASTO || null,
            doc.AK_NRDOMU || null,
            doc.AK_NRLOKALU || null,
            doc.AK_ULICA_EXT || null,
            doc.A_KOD || null,
            doc.A_KRAJ || null,
            doc.A_MIASTO || null,
            doc.A_NRDOMU || null,
            doc.A_NRLOKALU || null,
            doc.A_ULICA_EXT || null,
            doc.CUSTOMER_ID || null,
            JSON.stringify(finalEmails),
            doc.IS_FIRMA ? 1 : 0,
            doc.KOD_KONTR_LISTA || null,
            doc.KONTR_NIP || null,
            doc.KONTRAHENT_ID,
            doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
            doc.PESEL || null,
            doc.PLATNOSCPOTEM_DNI || null,
            doc.PRZYPISANA_FORMA_PLATNOSCI || null,
            doc.REGON || null,
            type,
            JSON.stringify(finalPhones),
          ]
        );
      }
    }
    console.log("AKTUALIZACJA ZAKOŃCZONA SUKCESEM.");
  } catch (error) {
    console.error("Błąd krytyczny:", error);
  }
};

const updateTableContractorKEM = async () => {
  const BATCH_SIZE = 1000;
  const type = "KEM";

  // --- FUNKCJE POMOCNICZE ---
  const processPhones = (rawPhones) => {
    if (!rawPhones) return [];
    const phoneArray = String(rawPhones)
      .split(/[\s,;]+/)
      .filter((p) => p.length >= 7);
    const uniqueMap = new Map();
    const mobilePrefixes = [
      "45",
      "50",
      "51",
      "53",
      "57",
      "60",
      "66",
      "69",
      "72",
      "73",
      "78",
      "79",
      "88",
    ];

    for (const p of phoneArray) {
      let clean = p.replace(/\D/g, "");
      if (clean.length === 11 && clean.startsWith("48")) clean = clean.slice(2);
      const phoneNumber = parsePhoneNumberFromString(clean, "PL");
      let isMobile = false;
      let isValid = false;
      let finalValue = clean;

      if (phoneNumber) {
        isValid = phoneNumber.isValid();
        isMobile = phoneNumber.getType() === "MOBILE";
        finalValue = phoneNumber.nationalNumber;
      }
      const prefix = finalValue.substring(0, 2);
      if (mobilePrefixes.includes(prefix) && finalValue.length === 9) {
        isMobile = true;
        isValid = true;
      }
      if (!uniqueMap.has(finalValue)) {
        uniqueMap.set(finalValue, {
          value: finalValue,
          verified: false,
          debtCollection: false,
          invalid: !isValid || finalValue.length !== 9,
          isMobile: isMobile,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const processEmails = (rawEmails) => {
    if (!rawEmails) return [];
    const emailArray = String(rawEmails)
      .split(/[\s,;]+/)
      .filter((e) => e.length > 3);
    const uniqueMap = new Map();
    for (const e of emailArray) {
      const email = e.trim().toLowerCase();
      const isValid = validator.isEmail(email);
      if (!uniqueMap.has(email)) {
        uniqueMap.set(email, {
          value: email,
          verified: false,
          debtCollection: false,
          invalid: !isValid,
        });
      }
    }
    return Array.from(uniqueMap.values());
  };

  const mergeData = (oldJson, newData) => {
    try {
      const oldData =
        typeof oldJson === "string" ? JSON.parse(oldJson) : oldJson || [];
      if (!Array.isArray(oldData)) return newData;

      const map = new Map();
      oldData.forEach((item) => {
        if (item.value) map.set(item.value, item);
      });
      newData.forEach((item) => {
        if (!map.has(item.value)) map.set(item.value, item);
      });

      return Array.from(map.values());
    } catch (e) {
      return newData;
    }
  };

  try {
    // 1. POBIERAMY LISTĘ ID Z MYSQL
    console.log(`Pobieram listę KONTRAHENT_ID dla ${type} z MySQL...`);
    const [resultId] = await connect_SQL.query(
      `SELECT DISTINCT KONTRAHENT_ID FROM company_documents 
       WHERE DATA_FV > '2024-01-01' AND FIRMA = ? AND KONTRAHENT_ID IS NOT NULL`,
      [type]
    );

    const idList = resultId.map((row) => row.KONTRAHENT_ID);
    console.log(`Znaleziono ${idList.length} kontrahentów do aktualizacji.`);

    // 2. PRZETWARZANIE W PACZKACH
    for (let i = 0; i < idList.length; i += BATCH_SIZE) {
      const batchIds = idList.slice(i, i + BATCH_SIZE);
      console.log(
        `Przetwarzam paczkę ${Math.floor(i / BATCH_SIZE) + 1} / ${Math.ceil(idList.length / BATCH_SIZE)}...`
      );

      // 3. MSSQL - Pobranie danych (inna baza: AS3_PRACA_KROTOSKI_ELECTROMOBILITY)
      const query = `
        SELECT
            k.KONTRAHENT_ID, k.TELKOMORKA, k.TELEFON_NORM, k.E_MAIL, k.IS_FIRMA,
            k.NIP AS KONTR_NIP, k.REGON, k.PESEL, k.PLATNOSCPOTEM_DNI,
            zap_k.NAZWA AS PRZYPISANA_FORMA_PLATNOSCI,
            k.NAZWA AS NAZWA_KONTRAHENTA_SLOWNIK,
            k.KOD_KONTR_LISTA, k.A_ULICA_EXT, k.A_NRDOMU, k.A_NRLOKALU,
            k.A_KOD, k.A_MIASTO, k.A_KRAJ, k.AK_ULICA_EXT, k.AK_NRDOMU,
            k.AK_NRLOKALU, k.AK_KOD, k.AK_MIASTO, k.AK_KRAJ,
            ckk.CUSTOMER_ID
        FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT] k
        LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[DOC_ZAPLATA] zap_k ON k.DOC_ZAPLATA_ID = zap_k.DOC_ZAPLATA_ID
        LEFT JOIN (
            SELECT KONTRAHENT_ID, MAX(CUSTOMER_ID) AS CUSTOMER_ID
            FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT_CKK_CON]
            WHERE CUSTOMER_ID IS NOT NULL
            GROUP BY KONTRAHENT_ID
        ) ckk ON k.KONTRAHENT_ID = ckk.KONTRAHENT_ID
        WHERE k.KONTRAHENT_ID IN (${batchIds.join(",")})
      `;

      const mssqlResults = await msSqlQuery(query);

      // 4. MYSQL - Pobranie istniejących danych (maile/telefony) do merge'owania
      const [existingRows] = await connect_SQL.query(
        "SELECT KONTRAHENT_ID, EMAIL, TELEFON FROM company_contractor WHERE KONTRAHENT_ID IN (?) AND SPOLKA = ?",
        [batchIds, type]
      );
      const existingMap = new Map(
        existingRows.map((row) => [row.KONTRAHENT_ID, row])
      );

      // 5. Budowanie tablicy wartości do masowego insertu
      const valuesToInsert = [];

      for (const doc of mssqlResults) {
        const rawPhoneString = `${doc.TELKOMORKA || ""} ${doc.TELEFON_NORM || ""}`;
        const newPhones = processPhones(rawPhoneString);
        const newEmails = processEmails(doc.E_MAIL);

        let finalPhones = newPhones;
        let finalEmails = newEmails;

        const existing = existingMap.get(doc.KONTRAHENT_ID);
        if (existing) {
          finalPhones = mergeData(existing.TELEFON, newPhones);
          finalEmails = mergeData(existing.EMAIL, newEmails);
        }

        valuesToInsert.push([
          doc.AK_KOD || null,
          doc.AK_KRAJ || null,
          doc.AK_MIASTO || null,
          doc.AK_NRDOMU || null,
          doc.AK_NRLOKALU || null,
          doc.AK_ULICA_EXT || null,
          doc.A_KOD || null,
          doc.A_KRAJ || null,
          doc.A_MIASTO || null,
          doc.A_NRDOMU || null,
          doc.A_NRLOKALU || null,
          doc.A_ULICA_EXT || null,
          doc.CUSTOMER_ID || null,
          JSON.stringify(finalEmails),
          doc.IS_FIRMA ? 1 : 0,
          doc.KOD_KONTR_LISTA || null,
          doc.KONTR_NIP || null,
          doc.KONTRAHENT_ID,
          doc.NAZWA_KONTRAHENTA_SLOWNIK || null,
          doc.PESEL || null,
          doc.PLATNOSCPOTEM_DNI || null,
          doc.PRZYPISANA_FORMA_PLATNOSCI || null,
          doc.REGON || null,
          type,
          JSON.stringify(finalPhones),
        ]);
      }

      // 6. MASOWA AKTUALIZACJA W MYSQL
      if (valuesToInsert.length > 0) {
        await connect_SQL.query(
          `INSERT INTO company_contractor (
            AK_KOD, AK_KRAJ, AK_MIASTO, AK_NRDOMU, AK_NRLOKALU, AK_ULICA_EXT,
            A_KOD, A_KRAJ, A_MIASTO, A_NRDOMU, A_NRLOKALU, A_ULICA_EXT, CUSTOMER_ID_CKK,
            EMAIL, IS_FIRMA, KOD_KONTR_LISTA, KONTR_NIP, KONTRAHENT_ID,
            NAZWA_KONTRAHENTA_SLOWNIK, PESEL, PLATNOSCPOTEM_DNI,
            PRZYPISANA_FORMA_PLATNOSCI, REGON, SPOLKA, TELEFON
          ) VALUES ? 
          ON DUPLICATE KEY UPDATE
            NAZWA_KONTRAHENTA_SLOWNIK = VALUES(NAZWA_KONTRAHENTA_SLOWNIK),
            EMAIL = VALUES(EMAIL),
            TELEFON = VALUES(TELEFON),
            KONTR_NIP = VALUES(KONTR_NIP),
            PLATNOSCPOTEM_DNI = VALUES(PLATNOSCPOTEM_DNI),
            AK_MIASTO = VALUES(AK_MIASTO),
            A_MIASTO = VALUES(A_MIASTO),
            CUSTOMER_ID_CKK = VALUES(CUSTOMER_ID_CKK)`,
          [valuesToInsert]
        );
      }
    }
    console.log(`AKTUALIZACJA ${type} ZAKOŃCZONA SUKCESEM.`);
  } catch (error) {
    console.error(`Błąd krytyczny w updateTableContractor${type}:`, error);
  }
};
//
//
//
//
//

/// do dodania nr konta
const changedocumentsTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_contractor MODIFY SPOLKA VARCHAR(10) CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci NULL"
    );

    await connect_SQL.query(
      "ALTER TABLE company_documents  ADD FAKT_BANK_KONTO VARCHAR(40) NULL AFTER KONTRAHENT_ID"
    );

    await connect_SQL.query(
      "ALTER TABLE company_contractor   ADD A_PRZEDROSTEK VARCHAR(10) NULL AFTER A_NRLOKALU,  ADD AK_PRZEDROSTEK VARCHAR(10) NULL AFTER AK_NRLOKALU"
    );
  } catch (error) {
    console.error(error);
  }
};

const update_ULICA_KEM = async () => {
  try {
    const BATCH_SIZE = 1000;
    let lastProcessedId = 0;

    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      // 1. Poprawione nawiasy w WHERE i nazwa id_kontrahent
      const [documents] = await connect_SQL.query(
        `SELECT KONTRAHENT_ID FROM company_contractor 
         WHERE SPOLKA = 'KEM' 
         AND (AK_PRZEDROSTEK IS NULL OR A_PRZEDROSTEK IS NULL)
         AND KONTRAHENT_ID > ? 
         ORDER BY KONTRAHENT_ID ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      // 2. Poprawione przypisanie ID do pętli (z id_kontrahent)
      lastProcessedId = documents[documents.length - 1].KONTRAHENT_ID;
      const numerIDArray = documents.map((doc) => doc.KONTRAHENT_ID);

      try {
        // 3. Pobieramy dane z MSSQL - upewnij się, że te kolumny istnieją w FAKTDOC
        const matches = await msSqlQuery(
          `SELECT KONTRAHENT_ID, A_PRZEDROSTEK, AK_PRZEDROSTEK 
           FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[KONTRAHENT] 
           WHERE KONTRAHENT_ID IN (${numerIDArray.map((n) => `'${n}'`).join(",")})`
        );

        if (matches.length > 0) {
          console.log(`Znaleziono ${matches.length} dopasowań. Aktualizuję...`);

          const updatePromises = matches
            .filter(
              (row) => row.A_PRZEDROSTEK !== null || row.AK_PRZEDROSTEK !== null
            )
            .map((row) =>
              connect_SQL.query(
                // Sprawdź czy w MySQL kolumna to id_kontrahent czy KONTRAHENT_ID
                "UPDATE company_contractor SET A_PRZEDROSTEK = ?, AK_PRZEDROSTEK = ? WHERE KONTRAHENT_ID = ? AND SPOLKA = 'KEM'",
                [row.A_PRZEDROSTEK, row.AK_PRZEDROSTEK, row.KONTRAHENT_ID]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const update_ULICA_KRT = async () => {
  try {
    const BATCH_SIZE = 1000;
    let lastProcessedId = 0;

    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      // 1. Poprawione nawiasy w WHERE i nazwa id_kontrahent
      const [documents] = await connect_SQL.query(
        `SELECT KONTRAHENT_ID FROM company_contractor 
         WHERE SPOLKA = 'KRT' 
         AND (AK_PRZEDROSTEK IS NULL OR A_PRZEDROSTEK IS NULL)
         AND KONTRAHENT_ID > ? 
         ORDER BY KONTRAHENT_ID ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      // 2. Poprawione przypisanie ID do pętli (z id_kontrahent)
      lastProcessedId = documents[documents.length - 1].KONTRAHENT_ID;
      const numerIDArray = documents.map((doc) => doc.KONTRAHENT_ID);

      try {
        // 3. Pobieramy dane z MSSQL - upewnij się, że te kolumny istnieją w FAKTDOC
        const matches = await msSqlQuery(
          `SELECT KONTRAHENT_ID, A_PRZEDROSTEK, AK_PRZEDROSTEK 
           FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT] 
           WHERE KONTRAHENT_ID IN (${numerIDArray.map((n) => `'${n}'`).join(",")})`
        );

        if (matches.length > 0) {
          console.log(`Znaleziono ${matches.length} dopasowań. Aktualizuję...`);

          const updatePromises = matches
            .filter(
              (row) => row.A_PRZEDROSTEK !== null || row.AK_PRZEDROSTEK !== null
            )
            .map((row) =>
              connect_SQL.query(
                // Sprawdź czy w MySQL kolumna to id_kontrahent czy KONTRAHENT_ID
                "UPDATE company_contractor SET A_PRZEDROSTEK = ?, AK_PRZEDROSTEK = ? WHERE KONTRAHENT_ID = ? AND SPOLKA = 'KRT'",
                [row.A_PRZEDROSTEK, row.AK_PRZEDROSTEK, row.KONTRAHENT_ID]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const update_FAKT_BANK_KONTO_KRT = async () => {
  try {
    const BATCH_SIZE = 1000; // Możesz zwiększyć do 1000-2000
    let lastProcessedId = 0;

    // Pętla będzie działać dopóki są dane
    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA = 'KRT' 
         AND DATA_FV > '2024-01-01' 
         AND FAKT_BANK_KONTO IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      lastProcessedId = documents[documents.length - 1].id_document;
      const numerFVArray = documents.map((doc) => doc.NUMER_FV);

      try {
        // 1. Pobieramy dane z MSSQL
        // Używamy parametrów, aby uniknąć problemów z zapytaniem
        const matches = await msSqlQuery(
          `SELECT NUMER, FAKT_BANK_KONTO FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerFVArray.map((n) => `'${n}'`).join(",")})`
        );

        for (const doc of matches) {
          if (doc.NUMER === "FV/UBL/30/26/A/D38") {
            console.log("test");
            console.log(doc);
          }
        }
        if (matches.length > 0) {
          console.log(
            `Znaleziono ${matches.length} dopasowań. Aktualizuję grupowo...`
          );

          // 2. OPTYMALIZACJA: Zamiast pętli z UPDATE, budujemy jedno zapytanie CASE
          // lub wykonujemy aktualizacje równolegle (Promise.all)

          // Opcja A: Równoległe Promise.all (Szybsze niż pętla for-await)
          // Limitujemy konkurencję, żeby nie "zabić" puli połączeń
          const updatePromises = matches
            .filter((row) => row.FAKT_BANK_KONTO !== null)
            .map((row) =>
              connect_SQL.query(
                "UPDATE company_documents SET FAKT_BANK_KONTO = ? WHERE NUMER_FV = ? AND FIRMA = 'KRT'",
                [row.FAKT_BANK_KONTO, row.NUMER]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const update_FAKT_BANK_KONTO_KEM = async () => {
  try {
    const BATCH_SIZE = 1000; // Możesz zwiększyć do 1000-2000
    let lastProcessedId = 0;

    // Pętla będzie działać dopóki są dane
    while (true) {
      console.log(
        `Pobieram paczkę dokumentów powyżej ID: ${lastProcessedId}...`
      );

      const [documents] = await connect_SQL.query(
        `SELECT id_document, NUMER_FV FROM company_documents 
         WHERE FIRMA = 'KEM' 
         AND DATA_FV > '2024-01-01' 
         AND FAKT_BANK_KONTO IS NULL 
         AND id_document > ? 
         ORDER BY id_document ASC 
         LIMIT ?`,
        [lastProcessedId, BATCH_SIZE]
      );

      if (documents.length === 0) {
        console.log("Koniec danych.");
        break;
      }

      lastProcessedId = documents[documents.length - 1].id_document;
      const numerFVArray = documents.map((doc) => doc.NUMER_FV);

      try {
        // 1. Pobieramy dane z MSSQL
        // Używamy parametrów, aby uniknąć problemów z zapytaniem
        const matches = await msSqlQuery(
          `SELECT NUMER, FAKT_BANK_KONTO FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] 
           WHERE NUMER IN (${numerFVArray.map((n) => `'${n}'`).join(",")})`
        );

        if (matches.length > 0) {
          console.log(
            `Znaleziono ${matches.length} dopasowań. Aktualizuję grupowo...`
          );

          // 2. OPTYMALIZACJA: Zamiast pętli z UPDATE, budujemy jedno zapytanie CASE
          // lub wykonujemy aktualizacje równolegle (Promise.all)

          // Opcja A: Równoległe Promise.all (Szybsze niż pętla for-await)
          // Limitujemy konkurencję, żeby nie "zabić" puli połączeń
          const updatePromises = matches
            .filter((row) => row.FAKT_BANK_KONTO !== null)
            .map((row) =>
              connect_SQL.query(
                "UPDATE company_documents SET FAKT_BANK_KONTO = ? WHERE NUMER_FV = ? AND FIRMA = 'KEM'",
                [row.FAKT_BANK_KONTO, row.NUMER]
              )
            );

          await Promise.all(updatePromises);
        }
      } catch (err) {
        console.error(`Błąd w trakcie przetwarzania paczki:`, err);
      }
    }
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const changeDateReport = async () => {
  try {
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/M/2477/25/P/D97' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UBL/1247/25/A/D38' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UBL/463/25/A/D78' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/WS/15/25/A/D38' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3695/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3744/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3744/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3675/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/1721/25/S/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3803/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/3949/25/V/D66' AND WYKORZYSTANO_RAPORT_FK = '2026-01-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "UPDATE company_management_date_description_FK SET WYKORZYSTANO_RAPORT_FK = '2026-01-13'WHERE WYKORZYSTANO_RAPORT_FK = '2026-01-14' AND COMPANY = 'KRT'"
    );

    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/828/25/D/D66' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/1537/25/S/D66' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/779/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/596/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/732/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/176/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/179/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/178/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/177/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/175/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/1534/25/S/D66' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/1538/25/S/D66' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/UP/1540/25/S/D66' AND WYKORZYSTANO_RAPORT_FK = '2025-12-15' AND COMPANY = 'KRT'"
    );

    await connect_SQL.query(
      "UPDATE company_management_date_description_FK SET WYKORZYSTANO_RAPORT_FK = '2025-12-15' WHERE WYKORZYSTANO_RAPORT_FK = '2025-12-16' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "UPDATE company_management_date_description_FK SET WYKORZYSTANO_RAPORT_FK = '2026-01-13' WHERE WYKORZYSTANO_RAPORT_FK = '2026-01-14' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "UPDATE company_management_date_description_FK SET WYKORZYSTANO_RAPORT_FK = '2026-01-27' WHERE WYKORZYSTANO_RAPORT_FK = '2026-01-28' AND COMPANY = 'KRT'"
    );

    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/133/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/134/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/135/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/132/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/727/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/738/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/740/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/739/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/681/25/S/D172' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/853/25/A/D72' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/847/25/A/D72' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/I/F/138/25/A/D72' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/857/25/A/D72' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/859/25/A/D72' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "DELETE FROM company_management_date_description_FK WHERE NUMER_FV = 'FV/AN/F/165/25/C/D192' AND WYKORZYSTANO_RAPORT_FK = '2025-11-13' AND COMPANY = 'KRT'"
    );
    await connect_SQL.query(
      "UPDATE company_management_date_description_FK SET WYKORZYSTANO_RAPORT_FK = '2025-11-13' WHERE WYKORZYSTANO_RAPORT_FK = '2025-11-14' AND COMPANY = 'KRT'"
    );
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const repairDecisionHistory = async (company) => {
  try {
    const [allHistory] = await connect_SQL.query(
      "SELECT * FROM company_history_management WHERE COMPANY = ? ",
      [company]
    );

    const [docHistory] = await connect_SQL.query(
      "SELECT * FROM company_management_date_description_fk WHERE COMPANY = ? ",
      [company]
    );

    // const newData = allHistory.map((doc) => {
    //   // 1. Sprawdzamy czy HISTORY_DOC istnieje, jeśli nie - używamy pustej tablicy
    //   const history = doc.HISTORY_DOC || [];

    //   // 2. Wyciągamy daty z pola 'info'
    //   const dates = history
    //     .map((h) => (h.info ? h.info.match(/\d{4}-\d{2}-\d{2}/) : null))
    //     .filter((match) => match !== null) // usuwamy wpisy, gdzie nie znaleziono daty
    //     .map((match) => match[0]); // pobieramy sam tekst daty

    //   // 3. Zwracamy obiekt w pożądanym formacie
    //   return {
    //     numer_fv: doc.NUMER_FV,
    //     dates: dates,
    //     count: dates.length, // pokaże 0, 1 lub więcej
    //   };
    // });

    // for (doc of allHistory) {
    //   if (doc.NUMER_FV === "FV/I/18/25/X/D79") {
    //     console.log(doc);
    //   }
    // }

    // for (doc of docHistory) {
    //   if (doc.NUMER_FV === "FV/I/18/25/X/D79") {
    //     console.log(doc);
    //   }
    // }

    // const newData = [
    //   {
    //     numer_fv: "FV/UBL/1032/25/A/D8",
    //     dates: ["2025-12-15", "2026-01-13"],
    //     count: 5,
    //   },
    // ];

    // 1. Mapa 1:1 dla allHistory (po staremu - bierzemy ostatni pasujący lub jedyny obiekt)
    // const allHistoryMap = new Map(
    //   allHistory.map((item) => [item.NUMER_FV, item])
    // );

    // // 2. Mapa 1:N dla docHistory (grupujemy wiele obiektów w tablicę)
    // const docHistoryMap = new Map();
    // for (const item of docHistory) {
    //   const key = item.NUMER_FV;
    //   if (!docHistoryMap.has(key)) {
    //     docHistoryMap.set(key, []);
    //   }
    //   docHistoryMap.get(key).push(item);
    // }

    // // 3. Przetwarzanie i wyświetlanie danych
    // for (const doc of newData) {
    //   // Pobieramy pojedynczy obiekt z allHistory (może być undefined)
    //   const fullHistoryObj = allHistoryMap.get(doc.numer_fv);

    //   // Pobieramy tablicę obiektów z docHistory (zawsze zwracamy tablicę, choćby pustą)
    //   const fullDocArray = docHistoryMap.get(doc.numer_fv) || [];

    //   const completeData = {
    //     ...doc,
    //     historyDetails: fullHistoryObj, // Pojedynczy obiekt JSON
    //     documentDetails: fullDocArray, // Tablica obiektów JSON
    //   };

    //   console.log(`FV: ${doc.numer_fv}`);
    //   console.log(`History:`, completeData.historyDetails);
    //   console.log(
    //     `Documents (znaleziono: ${completeData.documentDetails.length}):`,
    //     completeData.documentDetails
    //   );
    //   console.log("---------------------------");
    // }

    const xxxprocessHistory = (allHistory, docHistory) => {
      allHistory.forEach((historyObj) => {
        // 1. Szukamy obiektów w docHistory o tym samym NUMER_FV i COMPANY
        const matchingDocs = docHistory.filter(
          (doc) =>
            doc.NUMER_FV === historyObj.NUMER_FV &&
            doc.COMPANY === historyObj.COMPANY
        );

        if (matchingDocs.length === 0) return;

        // 2. Przetwarzamy każdy element w HISTORY_DOC
        historyObj.HISTORY_DOC.forEach((historyDocItem) => {
          // Wyciągamy datę z info (format YYYY-MM-DD)
          const dateMatch = historyDocItem.info.match(/\d{4}-\d{2}-\d{2}/);
          if (!dateMatch) return;
          const extractedDate = dateMatch[0];

          // 3. Szukamy w dopasowanych dokumentach daty w WYKORZYSTANO_RAPORT_FK
          matchingDocs.forEach((doc) => {
            if (doc.WYKORZYSTANO_RAPORT_FK === extractedDate) {
              // Funkcja pomocnicza do formatowania stringa: date - username - note
              const formatEntry = (entry) => {
                if (!entry) return null;
                const parts = [];
                if (entry.date) parts.push(entry.date);
                if (entry.username) parts.push(entry.username);
                if (entry.note) parts.push(entry.note);
                return parts.join(" - ");
              };

              // Pobieramy ostatni element z HISTORIA_ZMIANY_DATY_ROZLICZENIA
              if (
                doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA &&
                doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length > 0
              ) {
                const lastDateChange =
                  doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA[
                    doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length - 1
                  ];
                const formattedDate = formatEntry(lastDateChange);
                if (formattedDate) {
                  historyDocItem.historyDate.push(formattedDate);
                }
              }

              // Pobieramy ostatni element z INFORMACJA_ZARZAD
              if (doc.INFORMACJA_ZARZAD && doc.INFORMACJA_ZARZAD.length > 0) {
                const lastInfo =
                  doc.INFORMACJA_ZARZAD[doc.INFORMACJA_ZARZAD.length - 1];
                const formattedText = formatEntry(lastInfo);
                if (formattedText) {
                  historyDocItem.historyText.push(formattedText);
                }
              }
            }
          });
        });
      });

      return allHistory;
    };

    const processHistory = (allHistory, docHistory) => {
      allHistory.forEach((historyObj) => {
        // 1. Szukamy wszystkich pasujących dokumentów w docHistory (FV + Firma)
        const matchingDocs = docHistory.filter(
          (doc) =>
            doc.NUMER_FV === historyObj.NUMER_FV &&
            doc.COMPANY === historyObj.COMPANY
        );

        if (matchingDocs.length === 0) return;

        // 2. Przetwarzamy każdy element w HISTORY_DOC
        historyObj.HISTORY_DOC.forEach((historyDocItem) => {
          const dateMatch = historyDocItem.info.match(/\d{4}-\d{2}-\d{2}/);
          if (!dateMatch) return;
          const extractedDate = dateMatch[0];

          // Szukamy dokumentów, które pasują do daty konkretnego raportu
          const docsWithSpecificDate = matchingDocs.filter(
            (doc) => doc.WYKORZYSTANO_RAPORT_FK === extractedDate
          );

          // JEŚLI ZNALEZIONO DOPASOWANIE - czyścimy i wstawiamy unikalne dane
          if (docsWithSpecificDate.length > 0) {
            // Używamy Set, aby zbierać unikalne stringi
            const uniqueDatesSet = new Set();
            const uniqueTextsSet = new Set();

            const formatEntry = (entry) => {
              if (!entry) return null;
              const parts = [];
              if (entry.date) parts.push(entry.date.trim());
              if (entry.username) parts.push(entry.username.trim());
              if (entry.note) parts.push(entry.note.trim());
              return parts.join(" - ");
            };

            docsWithSpecificDate.forEach((doc) => {
              // Ostatnia historia zmiany daty
              if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA?.length > 0) {
                const lastDate =
                  doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA[
                    doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length - 1
                  ];
                const formatted = formatEntry(lastDate);
                if (formatted) uniqueDatesSet.add(formatted);
              }

              // Ostatnia informacja zarządu
              if (doc.INFORMACJA_ZARZAD?.length > 0) {
                const lastInfo =
                  doc.INFORMACJA_ZARZAD[doc.INFORMACJA_ZARZAD.length - 1];
                const formatted = formatEntry(lastInfo);
                if (formatted) uniqueTextsSet.add(formatted);
              }
            });

            // KLUCZOWY MOMENT: Czyścimy i nadpisujemy tablice nowymi, unikalnymi danymi
            historyDocItem.historyDate = Array.from(uniqueDatesSet);
            historyDocItem.historyText = Array.from(uniqueTextsSet);
          }
          // Jeśli nie znaleziono dopasowania daty, historyDocItem pozostaje bez zmian
        });
      });

      return allHistory;
    };

    const result = processHistory(allHistory, docHistory);

    await connect_SQL.query(`TRUNCATE TABLE company_history_management`);
    for (const doc of result) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)",
        [doc.NUMER_FV, JSON.stringify(doc.HISTORY_DOC), doc.COMPANY]
      );
    }
    // console.log(result);
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const distinctDate = async (company) => {
  try {
    const [allHistory] = await connect_SQL.query(
      "SELECT * FROM company_history_management WHERE COMPANY = ? ",
      [company]
    );
    const allUniqueDates = new Set();
    for (const doc of allHistory) {
      // Sprawdzamy czy HISTORY_DOC istnieje i jest tablicą
      if (Array.isArray(doc.HISTORY_DOC)) {
        for (const item of doc.HISTORY_DOC) {
          if (item.info) {
            // Regex szukający daty na końcu stringa ($ oznacza koniec linii)
            const match = item.info.match(/\d{4}-\d{2}-\d{2}$/);
            if (match) {
              allUniqueDates.add(match[0]); // Set sam zadba o unikalność
            }
          }
        }
      }
    }
    // Zamieniamy Set z powrotem na tablicę i sortujemy chronologicznie
    const sortedDates = Array.from(allUniqueDates).sort();
    console.log("Wszystkie unikalne daty:");
    console.log(sortedDates);
  } catch (error) {
    console.error("Błąd główny funkcji:", error);
  }
};

const repair = async () => {
  try {
    // await changeDateReport();
    // console.log("changeDateReport");
    // await repairDecisionHistory("KRT");
    // console.log("repairDecisionHistory");
    // await distinctDate("KRT");
    //
    // console.log("changedocumentsTable");
    // await update_FAKT_BANK_KONTO_KRT();
    // console.log("update_FAKT_BANK_KONTO_KRT");
    // await update_FAKT_BANK_KONTO_KEM();
    // console.log("update_FAKT_BANK_KONTO_KEM");
    // await update_ULICA_KRT();
    // console.log("update_ULICA_KRT");
    // await update_ULICA_KEM();
    // console.log("update_ULICA_KEM");
    //
    //
    //
    // await addDocumentToDatabase("KRT");
    // await changedocumentsTable();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
