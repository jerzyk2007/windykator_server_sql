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
const { addDocumentToDatabase } = require("./getDataFromMSSQL");
const { syncColumns } = require("./tableController");
const { calculateCommercialInterest } = require("./payGuard");
const { parsePhoneNumberFromString } = require("libphonenumber-js");
const validator = require("validator");

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

const changedocumentsTable = async () => {
  try {
    await connect_SQL.query(
      "ALTER TABLE company_documents  ADD KONTRAHENT_ID INT NULL AFTER KONTRAHENT"
    );
  } catch (error) {
    console.error(error);
  }
};

const createKontrahentTable = async () => {
  try {
    await connect_SQL.query(
      "      CREATE TABLE company_contractor (  id_kontrahent INT NOT NULL AUTO_INCREMENT,     AK_KOD VARCHAR(20) NULL,     AK_KRAJ VARCHAR(100) NULL,     AK_MIASTO VARCHAR(100) NULL,     AK_NRDOMU VARCHAR(20) NULL,     AK_NRLOKALU VARCHAR(20) NULL,     AK_ULICA_EXT VARCHAR(255) NULL,     A_KOD VARCHAR(20) NULL,    A_KRAJ VARCHAR(100) NULL,     A_MIASTO VARCHAR(100) NULL,     A_NRDOMU VARCHAR(20) NULL,     A_NRLOKALU VARCHAR(20) NULL,     A_ULICA_EXT VARCHAR(255) NULL,  CUSTOMER_ID_CKK VARCHAR(20) NULL,   EMAIL JSON NULL,     IS_FIRMA TINYINT(1) NULL,     KOD_KONTR_LISTA VARCHAR(100) NULL,     KONTR_NIP VARCHAR(20) NULL,     KONTRAHENT_ID INT NOT NULL,     NAZWA_KONTRAHENTA_SLOWNIK VARCHAR(500) NULL,     PESEL VARCHAR(20) NULL,     PLATNOSCPOTEM_DNI INT NULL,     PRZYPISANA_FORMA_PLATNOSCI VARCHAR(100) NULL,     REGON VARCHAR(20) NULL,     SPOLKA VARCHAR(10) NOT NULL,     TELEFON JSON NULL, STATUS_WINDYKACJI TINYINT(1) NULL,     PRIMARY KEY (id_kontrahent),      UNIQUE INDEX uidx_kontrahent_spolka (KONTRAHENT_ID, SPOLKA),         INDEX idx_kontr_nip (KONTR_NIP) ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci      "
    );
  } catch (error) {
    console.error(error);
  }
};

const updateKontrahentIDKRT = async () => {
  try {
    const BATCH_SIZE = 1000;
    const MAX_ITERATIONS = 600;

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

const updateKontrahentIDKEM = async () => {
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

const updateTableContractorKRT = async () => {
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

const updateTableContractorKEM = async () => {
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

const repair = async () => {
  try {
    // await changedocumentsTable();
    // console.log("changedocumentsTable");
    // await createKontrahentTable();
    // console.log("createKontrahentTable");
    // await updateKontrahentIDKRT();
    // console.log("updateKontrahentIDKRT");
    // await updateKontrahentIDKEM();
    // console.log("updateKontrahentIDKEM");
    // await updateTableContractorKRT();
    // console.log("updateTableContractorKRT");
    // await updateTableContractorKEM();
    // console.log("updateTableContractorKEM");
    //
    //
    //
    // await addDocumentToDatabase("KRT");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
