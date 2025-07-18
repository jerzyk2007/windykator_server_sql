const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const cron = require('node-cron');
const { logEvents } = require("../middleware/logEvents");
const { addDepartment } = require('./manageDocumentAddition');
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { allUpdate } = require('./copyDBtoDB');
const { addDocumentToDatabaseQuery, updateDocZaLQuery, updateCarReleaseDatesQuery, updateSettlementsQuery, updateSettlementDescriptionQuery } = require('./sqlQueryForGetDataFromMSSQL');

const today = new Date();
today.setDate(today.getDate() - 2); // Odejmujemy 2 dni
const twoDaysAgo = today.toISOString().split("T")[0];
// const twoDaysAgo = "2024-10-01";

// zamienia na krótki format daty
const formatDate = (date) => {
  if (date instanceof Date) {
    return date.toISOString().split('T')[0]; // Wyciąga tylko część daty, np. "2024-11-08"
  }
  return date;
};

//pobieram dokumenty z bazy mssql AS
const addDocumentToDatabase = async (type) => {
  //   const queryKRT = `SELECT 
  //        fv.[NUMER],
  // 	    CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA,
  // 	CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23) AS DATA_ZAPLATA,
  //        fv.[KONTR_NAZWA],
  //        fv.[KONTR_NIP],
  //        SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
  //        SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
  //        fv.[NR_SZKODY],
  //        fv.[NR_AUTORYZACJI],
  //        fv.[UWAGI],
  //        fv.[KOREKTA_NUMER],
  //        zap.[NAZWA] AS TYP_PLATNOSCI,
  //        us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL,
  //        auto.[REJESTRACJA],
  //        auto.[NR_NADWOZIA],
  //        tr.[WARTOSC_NAL]
  // FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
  // WHERE fv.[NUMER] != 'POTEM' 
  //   AND fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}'
  // GROUP BY 
  //        fv.[NUMER],
  // 	   CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23),
  // 	   CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23),
  //            fv.[KONTR_NAZWA],
  //        fv.[KONTR_NIP],
  //        fv.[NR_SZKODY],
  //        fv.[NR_AUTORYZACJI],
  //        fv.[UWAGI],
  //        fv.[KOREKTA_NUMER],
  //        zap.[NAZWA],
  //        us.[NAZWA] + ' ' + us.[IMIE],
  //        auto.[REJESTRACJA],
  //        auto.[NR_NADWOZIA],
  //        tr.[WARTOSC_NAL];
  // `;

  //   const queryKEM = `SELECT 
  // fv.[NUMER],
  //  CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA,
  // CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23) AS DATA_ZAPLATA,
  // fv.[KONTR_NAZWA],
  // fv.[KONTR_NIP],
  // SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
  // SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
  // fv.[NR_SZKODY],
  // fv.[NR_AUTORYZACJI],
  // fv.[UWAGI],
  // fv.[KOREKTA_NUMER],
  // zap.[NAZWA] AS TYP_PLATNOSCI,
  // us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL,
  // auto.[REJESTRACJA],
  // auto.[NR_NADWOZIA],
  // tr.[WARTOSC_NAL]
  // FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] AS fv
  // LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
  // LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
  // LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
  // LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
  // LEFT JOIN [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
  // WHERE fv.[NUMER] != 'POTEM' 
  // AND fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}'
  // GROUP BY 
  // fv.[NUMER],
  // CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23),
  // CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23),
  //     fv.[KONTR_NAZWA],
  // fv.[KONTR_NIP],
  // fv.[NR_SZKODY],
  // fv.[NR_AUTORYZACJI],
  // fv.[UWAGI],
  // fv.[KOREKTA_NUMER],
  // zap.[NAZWA],
  // us.[NAZWA] + ' ' + us.[IMIE],
  // auto.[REJESTRACJA],
  // auto.[NR_NADWOZIA],
  // tr.[WARTOSC_NAL];
  // `;
  // const twoDaysAgo = '2024-01-01';
  const query = addDocumentToDatabaseQuery(type, twoDaysAgo);
  // console.log(query);

  // const query = type === "KRT" ? queryKRT : type === "KEM" ? queryKEM : "";
  // const firma = type;
  try {
    const documents = await msSqlQuery(query);
    console.log(documents.length);
    // dodaje nazwy działów
    const addDep = addDepartment(documents);

    addDep.forEach(row => {
      row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
      row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
    });


    for (const doc of addDep) {

      await connect_SQL.query(
        "INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.NUMER,
          doc.WARTOSC_BRUTTO,
          doc.WARTOSC_NETTO,
          doc.DZIAL,
          doc.WARTOSC_NAL || 0,
          doc.DATA_WYSTAWIENIA,
          doc.DATA_ZAPLATA,
          doc.KONTR_NAZWA,
          doc.PRZYGOTOWAL ? doc.PRZYGOTOWAL : "Brak danych",
          doc.REJESTRACJA,
          doc.NR_SZKODY || null,
          doc.UWAGI,
          doc.TYP_PLATNOSCI || null,
          doc.KONTR_NIP || null,
          doc.NR_NADWOZIA,
          doc.NR_AUTORYZACJI || null,
          doc.KOREKTA_NUMER,
          type
        ]
      );
    }

    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, addDocumentToDatabase: ${error}`, "reqServerErrors.txt");
    return false;
  }
};

// pobieram fv zaliczkowe, nazwy i kwoty dla KRT i KEM
const updateDocZal = async () => {
  try {

    const companies = ['KRT', 'KEM', 'RAC'];

    const documents = (
      await Promise.all(
        companies.map(async (company) => {
          const docs = await msSqlQuery(updateDocZaLQuery(company));
          return docs.map(doc => ({ ...doc, COMPANY: company }));
        })
      )
    ).flat();

    await connect_SQL.query("TRUNCATE TABLE company_fv_zaliczkowe");

    // //     // // Teraz przygotuj dane do wstawienia
    const values = documents.map(item => [
      item.NUMER_FV,
      item.FV_ZALICZKOWA,
      item.WARTOSC_BRUTTO,
      item.COMPANY
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO company_fv_zaliczkowe 
            ( NUMER_FV, FV_ZALICZKOWA, KWOTA_BRUTTO, COMPANY) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?)").join(", ")}
        `;

    //     // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateDocZal: ${error}`, "reqServerErrors.txt");
    return false;
  }
};

// aktualizuję daty wydania dla KEM i KRT
const updateCarReleaseDates = async () => {
  const twoDaysAgo = '2024-01-01';
  //   const queryMsSqlKRT = `
  //   SELECT 
  //       [NUMER], 
  //       CONVERT(VARCHAR(10), [DATA_WYDANIA], 23) AS DATA_WYDANIA 
  //   FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] 
  //   WHERE [DATA_WYDANIA] IS NOT NULL 
  //     AND [DATA_WYSTAWIENIA] > '${twoDaysAgo}' 
  //     AND [NUMER] != 'POTEM'
  // `;

  //   const queryMsSqlKEM = `
  //   SELECT 
  //       [NUMER], 
  //       CONVERT(VARCHAR(10), [DATA_WYDANIA], 23) AS DATA_WYDANIA 
  //   FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[FAKTDOC] 
  //   WHERE [DATA_WYDANIA] IS NOT NULL 
  //     AND [DATA_WYSTAWIENIA] > '${twoDaysAgo}' 
  //     AND [NUMER] != 'POTEM'
  // `;
  try {

    // const carReleaseDatesKRT = await msSqlQuery(updateCarReleaseDatesQuery('KRT'));
    // const carReleaseDatesKEM = await msSqlQuery(updateCarReleaseDatesQuery('KEM'));
    // const carReleaseDatesRAC = await msSqlQuery(updateCarReleaseDatesQuery('RAC'));

    // const updateCarReleaseDatesKRT = carReleaseDatesKRT.map(doc => ({
    //   ...doc,
    //   COMPANY: 'KRT'
    // }));
    // const updateCarReleaseDatesKEM = carReleaseDatesKEM.map(doc => ({
    //   ...doc,
    //   COMPANY: 'KEM'
    // }));
    // const updateCarReleaseDatesRAC = carReleaseDatesRAC.map(doc => ({
    //   ...doc,
    //   COMPANY: 'RAC'
    // }));

    // const carReleaseDates = [...updateCarReleaseDatesKRT, ...updateCarReleaseDatesKEM, ...updateCarReleaseDatesRAC];

    const companies = ['KRT', 'KEM', 'RAC'];

    const carReleaseDates = (
      await Promise.all(
        companies.map(async (company) => {
          const docs = await msSqlQuery(updateCarReleaseDatesQuery(company, twoDaysAgo));
          return docs.map(doc => ({ ...doc, COMPANY: company }));
        })
      )
    ).flat();


    const queryMySql = `
    SELECT fv.id_document, fv.NUMER_FV, fv.FIRMA
    FROM company_documents as fv 
    LEFT JOIN company_documents_actions as da ON fv.id_document = da.document_id 
    LEFT JOIN company_join_items as ji ON fv.DZIAL = ji.department 
    WHERE da.DATA_WYDANIA_AUTA IS  NULL AND (ji.area='SAMOCHODY NOWE' OR ji.area='SAMOCHODY UŻYWANE') AND fv.NUMER_FV LIKE '%FV%'`;

    const [findDoc] = await connect_SQL.query(queryMySql);

    const filteredFindDoc = findDoc
      .filter(doc => carReleaseDates.some(car => car.NUMER === doc.NUMER_FV && car.COMPANY === doc.FIRMA))
      .map(doc => {
        const carDate = carReleaseDates.find(car => car.NUMER === doc.NUMER_FV && car.COMPANY === doc.FIRMA);
        return {
          ...doc,
          DATA_WYDANIA: carDate?.DATA_WYDANIA ? formatDate(carDate.DATA_WYDANIA) : null
        };
      });

    for (const doc of filteredFindDoc) {
      // wstawia lub aktualizuje
      await connect_SQL.query(
        `INSERT INTO company_documents_actions (document_id, DATA_WYDANIA_AUTA)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE DATA_WYDANIA_AUTA = ?`,
        [doc.id_document, doc.DATA_WYDANIA, doc.DATA_WYDANIA]
      );
    }

    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateCarReleaseDates: ${error}`, "reqServerErrors.txt");
    return false;
  }
};

const updateSettlements = async () => {
  try {
    //     const queryMsSqlKRT = `
    // DECLARE @IS_BILANS BIT = 1;
    // DECLARE @IS_ROZLICZONY BIT = 0;
    // DECLARE @DATA_KONIEC DATETIME = GETDATE();

    // SELECT 
    //    T.OPIS,
    //  T.WARTOSC_SALDO,
    // CONVERT(VARCHAR(10),  T.DATA, 23) AS DATA_FV
    // FROM [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] T WITH(NOLOCK)
    // WHERE T.IS_BILANS = @IS_BILANS
    //  AND T.IS_ROZLICZONY = @IS_ROZLICZONY
    //  AND T.DATA <= @DATA_KONIEC
    //  AND T.WARTOSC_SALDO IS NOT NULL
    //  AND T.TERMIN IS NOT NULL
    //        `;

    //     const queryMsSqlKEM = `
    // DECLARE @IS_BILANS BIT = 1;
    // DECLARE @IS_ROZLICZONY BIT = 0;
    // DECLARE @DATA_KONIEC DATETIME = GETDATE();

    // SELECT 
    //    T.OPIS,
    //  T.WARTOSC_SALDO,
    // CONVERT(VARCHAR(10),  T.DATA, 23) AS DATA_FV
    // FROM [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[TRANSDOC] T WITH(NOLOCK)
    // WHERE T.IS_BILANS = @IS_BILANS
    //  AND T.IS_ROZLICZONY = @IS_ROZLICZONY
    //  AND T.DATA <= @DATA_KONIEC
    //  AND T.WARTOSC_SALDO IS NOT NULL
    //  AND T.TERMIN IS NOT NULL
    //        `;

    // const settlementsKRT = await msSqlQuery(updateSettlementsQuery('KRT'));

    // const settlementsKEM = await msSqlQuery(updateSettlementsQuery('KEM'));

    // const settlementsRAC = await msSqlQuery(updateSettlementsQuery('RAC'));

    // const filteredDataKRT = settlementsKRT.map(item => {
    //   const cleanDoc = item.OPIS.split(" ")[0];
    //   return {
    //     NUMER_FV: cleanDoc,
    //     DATA_FV: item.DATA_FV,
    //     DO_ROZLICZENIA: -(item.WARTOSC_SALDO),
    //     COMPANY: 'KRT'
    //   };
    // });

    // const checkDuplicateKRT = Object.values(
    //   filteredDataKRT.reduce((acc, item) => {
    //     if (acc[item.NUMER_FV]) {
    //       // Jeśli NUMER_FV już istnieje, dodaj wartość DO_ROZLICZENIA
    //       acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
    //     } else {
    //       // Jeśli NUMER_FV nie istnieje, dodaj nowy rekord z zachowaniem DATA_FV
    //       acc[item.NUMER_FV] = {
    //         NUMER_FV: item.NUMER_FV,
    //         DATA_FV: item.DATA_FV,
    //         DO_ROZLICZENIA: item.DO_ROZLICZENIA,
    //         COMPANY: item.COMPANY
    //       };
    //     }
    //     return acc;
    //   }, {})
    // );

    // const filteredDataKEM = settlementsKEM.map(item => {
    //   const cleanDoc = item.OPIS.split(" ")[0];
    //   return {
    //     NUMER_FV: cleanDoc,
    //     DATA_FV: item.DATA_FV,
    //     DO_ROZLICZENIA: -(item.WARTOSC_SALDO),
    //     COMPANY: 'KEM'
    //   };
    // });

    // const checkDuplicateKEM = Object.values(
    //   filteredDataKEM.reduce((acc, item) => {
    //     if (acc[item.NUMER_FV]) {
    //       // Jeśli NUMER_FV już istnieje, dodaj wartość DO_ROZLICZENIA
    //       acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
    //     } else {
    //       // Jeśli NUMER_FV nie istnieje, dodaj nowy rekord z zachowaniem DATA_FV
    //       acc[item.NUMER_FV] = {
    //         NUMER_FV: item.NUMER_FV,
    //         DATA_FV: item.DATA_FV,
    //         DO_ROZLICZENIA: item.DO_ROZLICZENIA,
    //         COMPANY: item.COMPANY
    //       };
    //     }
    //     return acc;
    //   }, {})
    // );


    // const filteredDataRAC = settlementsRAC.map(item => {
    //   const cleanDoc = item.OPIS.split(" ")[0];
    //   return {
    //     NUMER_FV: cleanDoc,
    //     DATA_FV: item.DATA_FV,
    //     DO_ROZLICZENIA: -(item.WARTOSC_SALDO),
    //     COMPANY: 'RAC'
    //   };
    // });

    // const checkDuplicateRAC = Object.values(
    //   filteredDataRAC.reduce((acc, item) => {
    //     if (acc[item.NUMER_FV]) {
    //       // Jeśli NUMER_FV już istnieje, dodaj wartość DO_ROZLICZENIA
    //       acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
    //     } else {
    //       // Jeśli NUMER_FV nie istnieje, dodaj nowy rekord z zachowaniem DATA_FV
    //       acc[item.NUMER_FV] = {
    //         NUMER_FV: item.NUMER_FV,
    //         DATA_FV: item.DATA_FV,
    //         DO_ROZLICZENIA: item.DO_ROZLICZENIA,
    //         COMPANY: item.COMPANY
    //       };
    //     }
    //     return acc;
    //   }, {})
    // );


    // const checkDuplicate = [...checkDuplicateKRT, ...checkDuplicateKEM, ...checkDuplicateRAC];

    const companies = ['KRT', 'KEM', 'RAC'];

    const settlementsData = await Promise.all(
      companies.map(async (company) => {
        const rows = await msSqlQuery(updateSettlementsQuery(company));

        const mapped = rows.map(item => ({
          NUMER_FV: item.OPIS.split(" ")[0],
          DATA_FV: item.DATA_FV,
          DO_ROZLICZENIA: -item.WARTOSC_SALDO,
          COMPANY: company
        }));

        const merged = Object.values(
          mapped.reduce((acc, item) => {
            if (acc[item.NUMER_FV]) {
              acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
            } else {
              acc[item.NUMER_FV] = { ...item };
            }
            return acc;
          }, {})
        );

        return merged;
      })
    );

    const checkDuplicate = settlementsData.flat();


    // Najpierw wyczyść tabelę settlements
    await connect_SQL.query("TRUNCATE TABLE company_settlements");

    // Teraz przygotuj dane do wstawienia
    const values = checkDuplicate.map(item => [
      item.NUMER_FV,
      item.DATA_FV,
      item.DO_ROZLICZENIA,
      item.COMPANY
    ]);

    const query = `
       INSERT IGNORE INTO company_settlements
         ( NUMER_FV, DATA_FV, NALEZNOSC, COMPANY) 
       VALUES 
         ${values.map(() => "(?, ?, ?, ?)").join(", ")}
     `;
    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    return true;
  }

  catch (error) {
    logEvents(`getDataFromMSSQL, uspdateSettlements: ${error}`, "reqServerErrors.txt");
    return false;
  }
};


// pobranie opisów rozrachunków dla KRT
const updateSettlementDescriptionCompany = async (company) => {
  // const queryMsSql = `SELECT 
  //    CASE 
  //         WHEN CHARINDEX(' ', tr.[OPIS]) > 0 THEN LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS]) - 1) 
  //         ELSE tr.[OPIS] 
  //     END AS NUMER_FV,
  // rozl.[OPIS] AS NUMER_OPIS,
  // CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
  // CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
  // rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI
  // FROM     [AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr 
  // LEFT JOIN    [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
  // WHERE rozl.[WARTOSC_SALDO] IS NOT NULL`;

  try {
    const settlementDescription = await msSqlQuery(updateSettlementDescriptionQuery(company));

    const updatedSettlements = Object.values(
      settlementDescription.reduce((acc, item) => {
        // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
        const formattedAmount = (typeof item.WARTOSC_OPERACJI === 'number' && !isNaN(item.WARTOSC_OPERACJI))
          ? item.WARTOSC_OPERACJI.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          })
          : 'brak danych';

        // Pomijanie wpisów, jeśli wszystkie dane są null lub brak danych
        if (item.DATA_OPERACJI === null && item.NUMER_OPIS === null && formattedAmount === 'brak danych') {
          return acc;
        }

        const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;
        const newDataRozliczenia = new Date(item.DATA_ROZLICZENIA);
        const DATA_OPERACJI = item.DATA_OPERACJI;

        if (!acc[item.NUMER_FV]) {
          // Jeśli jeszcze nie ma wpisu dla tego NUMER_FV, tworzymy nowy obiekt
          acc[item.NUMER_FV] = {
            NUMER_FV: item.NUMER_FV,
            DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
            OPIS_ROZRACHUNKU: [description],
            COMPANY: company
          };
        } else {
          // Jeśli już istnieje obiekt, dodajemy opis
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);

          // Porównujemy daty i aktualizujemy na najnowszą (najbliższą dzisiejszej)
          const currentDataRozliczenia = new Date(acc[item.NUMER_FV].DATA_ROZLICZENIA);
          if (new Date(DATA_OPERACJI) > newDataRozliczenia && !item.DATA_ROZLICZENIA) {
            acc[item.NUMER_FV].DATA_ROZLICZENIA = null;
          } else if (newDataRozliczenia > currentDataRozliczenia) {
            acc[item.NUMER_FV].DATA_ROZLICZENIA = item.DATA_ROZLICZENIA;
          }

          // Sortowanie opisów według daty
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.sort((a, b) => {
            const dateA = new Date(a.split(' - ')[0]);
            const dateB = new Date(b.split(' - ')[0]);
            return dateB - dateA;
          });
        }

        return acc;
      }, {})
    );
    return updatedSettlements;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateSettlementDescriptionKRT: ${error}`, "reqServerErrors.txt");
  }
};
// pobranie opisów rozrachunków dla KEM
// const updateSettlementDescriptionKEM = async () => {
//   const queryMsSql = `SELECT 
//      CASE 
//           WHEN CHARINDEX(' ', tr.[OPIS]) > 0 THEN LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS]) - 1) 
//           ELSE tr.[OPIS] 
//       END AS NUMER_FV,
//   rozl.[OPIS] AS NUMER_OPIS,
//   CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
//   CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
//   rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI
//   FROM     [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].TRANSDOC AS tr 
//   LEFT JOIN    [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
//   WHERE rozl.[WARTOSC_SALDO] IS NOT NULL`;

//   try {
//     const settlementDescription = await msSqlQuery(queryMsSql);

//     const updatedSettlements = Object.values(
//       settlementDescription.reduce((acc, item) => {
//         // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
//         const formattedAmount = (typeof item.WARTOSC_OPERACJI === 'number' && !isNaN(item.WARTOSC_OPERACJI))
//           ? item.WARTOSC_OPERACJI.toLocaleString('pl-PL', {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//             useGrouping: true
//           })
//           : 'brak danych';

//         // Pomijanie wpisów, jeśli wszystkie dane są null lub brak danych
//         if (item.DATA_OPERACJI === null && item.NUMER_OPIS === null && formattedAmount === 'brak danych') {
//           return acc;
//         }

//         const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;
//         const newDataRozliczenia = new Date(item.DATA_ROZLICZENIA);
//         const DATA_OPERACJI = item.DATA_OPERACJI;

//         if (!acc[item.NUMER_FV]) {
//           // Jeśli jeszcze nie ma wpisu dla tego NUMER_FV, tworzymy nowy obiekt
//           acc[item.NUMER_FV] = {
//             NUMER_FV: item.NUMER_FV,
//             DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
//             OPIS_ROZRACHUNKU: [description],
//             COMPANY: 'KEM'
//           };
//         } else {
//           // Jeśli już istnieje obiekt, dodajemy opis
//           acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);

//           // Porównujemy daty i aktualizujemy na najnowszą (najbliższą dzisiejszej)
//           const currentDataRozliczenia = new Date(acc[item.NUMER_FV].DATA_ROZLICZENIA);
//           if (new Date(DATA_OPERACJI) > newDataRozliczenia && !item.DATA_ROZLICZENIA) {
//             acc[item.NUMER_FV].DATA_ROZLICZENIA = null;
//           } else if (newDataRozliczenia > currentDataRozliczenia) {
//             acc[item.NUMER_FV].DATA_ROZLICZENIA = item.DATA_ROZLICZENIA;
//           }

//           // Sortowanie opisów według daty
//           acc[item.NUMER_FV].OPIS_ROZRACHUNKU.sort((a, b) => {
//             const dateA = new Date(a.split(' - ')[0]);
//             const dateB = new Date(b.split(' - ')[0]);
//             return dateB - dateA;
//           });
//         }

//         return acc;
//       }, {})
//     );
//     return updatedSettlements;
//   }
//   catch (error) {
//     logEvents(`getDataFromMSSQL, updateSettlementDescriptionKEM: ${error}`, "reqServerErrors.txt");
//   }
// };

// aktualizacja opisów rozrachunków
const updateSettlementDescription = async () => {
  const dataKRT = await updateSettlementDescriptionCompany('KRT');
  const dataKEM = await updateSettlementDescriptionCompany('KEM');
  const dataRAC = await updateSettlementDescriptionCompany('RAC');
  // const dataKEM = await updateSettlementDescriptionKEM();
  // const dataRAC = await updateSettlementDescriptionRAC();

  // Sprawdzenie czy dane zostały poprawnie zwrócone
  if (!dataKRT || !dataKEM || !dataRAC) {
    return false;
  }

  const updatedSettlements = [...dataKRT, ...dataKEM, ...dataRAC];
  try {
    //dodawanie do mysql dużych pakietów danych, podzielonych na części
    const batchInsert = async (connection, data, batchSize = 50000) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const values = batch.map(item => [
          item.COMPANY,
          item.NUMER_FV,
          JSON.stringify(item.OPIS_ROZRACHUNKU),
          item.DATA_ROZLICZENIA,
        ]);

        const query = `
          INSERT IGNORE INTO company_settlements_description 
            (COMPANY, NUMER, OPIS_ROZRACHUNKU, DATA_ROZL_AS) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?)").join(", ")}
        `;

        await connection.query(query, values.flat());
      }
    };

    try {
      await connect_SQL.query("TRUNCATE TABLE company_settlements_description");
      await batchInsert(connect_SQL, updatedSettlements);
    } catch (error) {
      logEvents(`getDataFromMSSQL, updateSettlementDescription, addMany settlements description: ${error}`, "reqServerErrors.txt");
    }
    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateSettlementDescription: ${error}`, "reqServerErrors.txt");
    return false;
  }
};



//uruchamiam po kolei aktualizację faktur dla KRT, KEM, RAC
const updateDocuments = async () => {
  try {
    const resultKRT = await addDocumentToDatabase("KRT");
    const resultKEM = await addDocumentToDatabase("KEM");
    const resultRAC = await addDocumentToDatabase("RAC");

    const success = resultKRT && resultKEM && resultRAC;

    connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        success ? "Zaktualizowano." : "Błąd aktualizacji",
        'Faktury'
      ]
    );
  } catch (error) {
    logEvents(`getDataFromMSSQL - updateCarReleaseDates (KRT/KEM): ${error}`, "reqServerErrors.txt");
  }
};



//wykonuje po kolei aktualizację danych i zapisuje daty i statusy
const updateData = async () => {

  try {
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT DATA_NAME, DATE, HOUR, UPDATE_SUCCESS FROM company_updates"
    );

    const filteredUpdatesData = getUpdatesData.filter(item => item.DATA_NAME !== 'Rubicon' && item.DATA_NAME !== 'BeCared' && item.DATA_NAME !== "Dokumenty Raportu FK - KRT" && item.DATA_NAME !== "Dokumenty Raportu FK - KEM");

    const updateProgress = filteredUpdatesData.map(item => {
      return {
        ...item,
        DATE: '',
        HOUR: '',
        UPDATE_SUCCESS: "Trwa aktualizacja ..."
      };
    });
    for (const item of updateProgress) {
      const queryUpdate = `
      UPDATE company_updates 
      SET 
      DATA_NAME = '${item.DATA_NAME}',
      DATE = '${item.DATE}',    
        HOUR = '${item.HOUR}', 
        UPDATE_SUCCESS = '${item.UPDATE_SUCCESS}'
      WHERE 
        DATA_NAME = '${item.DATA_NAME}'
    `;
      await connect_SQL.query(queryUpdate);
    }

    // dodanie faktur do DB
    updateDocuments();

    // updateDocuments().then((result) => {
    //   connect_SQL.query(
    //     "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
    //     [
    //       checkDate(new Date()),
    //       checkTime(new Date()),
    //       result ? "Zaktualizowano." : "Błąd aktualizacji",
    //       'Faktury'
    //     ]);
    // }).catch((error) => {
    //   logEvents(`getDataFromMSSQL - updateCarReleaseDates, getData: ${error}`, "reqServerErrors.txt");
    // });

    // dodanie fv zaliczkowych
    updateDocZal();

    // dodanie dat wydania samochodów 
    updateCarReleaseDates().then((result) => {
      connect_SQL.query(
        "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
        [
          checkDate(new Date()),
          checkTime(new Date()),
          result ? "Zaktualizowano." : "Błąd aktualizacji",
          'Wydania samochodów'
        ]);
    }).catch((error) => {
      logEvents(`getDataFromMSSQL - updateCarReleaseDates, getData: ${error}`, "reqServerErrors.txt");
    });


    // // aktualizacja rozrachunków
    updateSettlements().then((result) => {
      connect_SQL.query(
        "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
        [
          checkDate(new Date()),
          checkTime(new Date()),
          result ? "Zaktualizowano." : "Błąd aktualizacji",
          'Rozrachunki'
        ]);
    }).catch((error) => {
      logEvents(`getDataFromMSSQL - updateSettlements, getData: ${error}`, "reqServerErrors.txt");
    });

    // aktualizacja opisu rozrachunków
    updateSettlementDescription().then((result) => {
      connect_SQL.query(
        "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
        [
          checkDate(new Date()),
          checkTime(new Date()),
          result ? "Zaktualizowano." : "Błąd aktualizacji",
          'Opisy rozrachunków'
        ]);
    }).catch((error) => {
      logEvents(`getDataFromMSSQL - updateSettlementDescription, getData: ${error}`, "reqServerErrors.txt");
    });


  } catch (error) {
    logEvents(`getDataFromMSSQL , getData: ${error}`, "reqServerErrors.txt");
  }
};

// cron.schedule('27 12 * * *', allUpdate, {
//   timezone: "Europe/Warsaw"
// });
cron.schedule('40 06 * * *', updateData, {
  timezone: "Europe/Warsaw"
});


module.exports = {
  updateData,
  updateDocuments,
  updateSettlementDescription,
  addDocumentToDatabase,
  updateDocZal,
  updateCarReleaseDates,
  updateSettlements,
  updateSettlementDescriptionCompany
  // updateDocZal
};
