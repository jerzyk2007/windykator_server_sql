const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const cron = require('node-cron');
const { logEvents } = require("../middleware/logEvents");
const { dzialMap } = require('./manageDocumentAddition');


// const query = `SELECT fv.[NUMER], fv.[KOREKTA_NUMER], fv.[DATA_WYSTAWIENIA], fv.[DATA_ZAPLATA], fv.[KONTR_NAZWA], fv.[KONTR_NIP], fv.[WARTOSC_NETTO], fv.[WARTOSC_BRUTTO], fv.[NR_SZKODY], fv.[NR_AUTORYZACJI], fv.[UWAGI],fv.[DATA_WYDANIA], u.[NAZWA], u.[IMIE] FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS u ON fv.[MYUSER_PRZYGOTOWAL_ID] = u.[MYUSER_ID] WHERE fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' AND fv.[NUMER]!='POTEM' `;

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


const addDocumentToDatabase = async () => {
  //   const query = `SELECT
  //        fv.[NUMER]
  //    	, CONVERT(date, fv.[DATA_WYSTAWIENIA]) AS DATA_WYSTAWIENIA
  // 	, CONVERT(date, fv.[DATA_ZAPLATA]) AS DATA_ZAPLATA
  //      , fv.[KONTR_NAZWA]
  //      , fv.[KONTR_NIP]
  //      , fv.[WARTOSC_NETTO]
  //      , fv.[WARTOSC_BRUTTO]
  //      , fv.[NR_SZKODY]
  //      , fv.[NR_AUTORYZACJI]
  //      , fv.[UWAGI]
  // 	 , fv.[KOREKTA_NUMER]
  // 	 , fv.[DATA_WYDANIA]
  // 	 , zap.[NAZWA] as TYP_PLATNOSCI
  // 	 , us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL
  // 	 , auto.[REJESTRACJA]
  // 	 , auto.[NR_NADWOZIA]
  //    , tr.[WARTOSC_NAL]
  // FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[AUTO] as auto ON fv.AUTO_ID = auto.AUTO_ID WHERE fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' AND fv.[NUMER]!='POTEM' `;
  const query = `SELECT 
       fv.[NUMER],
       CONVERT(VARCHAR(10), fv.[DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA, 
       CONVERT(VARCHAR(10), fv.[DATA_ZAPLATA], 23) AS DATA_ZAPLATA, 
 	   	        fv.[KONTR_NAZWA],
       fv.[KONTR_NIP],
             SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
			 SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
            fv.[NR_SZKODY],
       fv.[NR_AUTORYZACJI],
       fv.[UWAGI],
       fv.[KOREKTA_NUMER],
          zap.[NAZWA] AS TYP_PLATNOSCI,
       us.[IMIE] + ' ' + us.[NAZWA] AS PRZYGOTOWAL,
       auto.[REJESTRACJA],
       auto.[NR_NADWOZIA],
       tr.[WARTOSC_NAL]
FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
WHERE fv.[NUMER] != 'POTEM' 
  AND fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' 
GROUP BY 
       fv.[NUMER],
       fv.[DATA_WYSTAWIENIA],
       fv.[DATA_ZAPLATA],
       fv.[KONTR_NAZWA],
       fv.[KONTR_NIP],
       fv.[WARTOSC_NETTO],
       fv.[WARTOSC_BRUTTO],
       fv.[NR_SZKODY],
       fv.[NR_AUTORYZACJI],
       fv.[UWAGI],
       fv.[KOREKTA_NUMER],
             zap.[NAZWA],
       us.[IMIE] + ' ' + us.[NAZWA],
       auto.[REJESTRACJA],
       auto.[NR_NADWOZIA],
       tr.[WARTOSC_NAL]`;

  try {
    const documents = await msSqlQuery(query);

    const addDepartment = documents
      .map((document) => {
        const match = document.NUMER?.match(/D(\d+)/);
        if (match) {
          const dzialNumber = match[1].padStart(3, "0"); // Wypełnia do trzech cyfr
          return {
            ...document,
            DZIAL: dzialMap[`D${dzialNumber}`]
              ? dzialMap[`D${dzialNumber}`]
              : `D${dzialNumber}`, // Tworzy nową wartość z "D" i trzema cyframi
          };
        }
      })
      .filter(Boolean);


    addDepartment.forEach(row => {
      row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
      row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
    });

    for (const doc of addDepartment) {
      const NIP = doc?.KONTR_NIP ? doc.KONTR_NIP : null;
      const NR_AUTORYZACJI = doc?.NR_AUTORYZACJI ? doc.NR_AUTORYZACJI : null;
      const NR_SZKODY = doc?.NR_SZKODY ? doc.NR_SZKODY : null;

      await connect_SQL.query(
        "INSERT IGNORE INTO documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.NUMER,
          doc.WARTOSC_BRUTTO,
          doc.WARTOSC_NETTO,
          doc.DZIAL,
          doc.WARTOSC_NAL || 0,
          doc.DATA_WYSTAWIENIA,
          doc.DATA_ZAPLATA,
          doc.KONTR_NAZWA,
          doc.PRZYGOTOWAL,
          doc.REJESTRACJA,
          NR_SZKODY,
          doc.UWAGI,
          doc.TYP_PLATNOSCI,
          NIP,
          doc.NR_NADWOZIA,
          NR_AUTORYZACJI,
          doc.KOREKTA_NUMER
        ]
      );

    }
    return true;
  }
  catch (error) {
    // console.error(error);
    logEvents(`getDataFromMSSQL, addDocumentToDatabase: ${error}`, "reqServerErrors.txt");
    return false;
  }
};

const updateCarReleaseDates = async () => {
  const twoDaysAgo = '2024-01-01';
  const queryMsSql = `
  SELECT 
      [NUMER], 
      CONVERT(VARCHAR(10), [DATA_WYDANIA], 23) AS DATA_WYDANIA 
  FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] 
  WHERE [DATA_WYDANIA] IS NOT NULL 
    AND [DATA_WYSTAWIENIA] > '${twoDaysAgo}' 
    AND [NUMER] != 'POTEM'
`;
  try {

    const carReleaseDates = await msSqlQuery(queryMsSql);

    const queryMySql = `SELECT fv.id_document, fv.NUMER_FV  FROM documents as fv LEFT JOIN documents_actions as da ON fv.id_document = da.document_id LEFT JOIN join_items as ji ON fv.DZIAL = ji.department WHERE da.DATA_WYDANIA_AUTA IS  NULL AND (ji.area='SAMOCHODY NOWE' OR ji.area='SAMOCHODY UŻYWANE') AND fv.NUMER_FV LIKE '%FV%'`;

    const [findDoc] = await connect_SQL.query(queryMySql);

    const filteredFindDoc = findDoc
      .filter(doc => carReleaseDates.some(car => car.NUMER === doc.NUMER_FV))
      .map(doc => {
        const carDate = carReleaseDates.find(car => car.NUMER === doc.NUMER_FV);
        return {
          ...doc,
          DATA_WYDANIA: carDate?.DATA_WYDANIA ? formatDate(carDate.DATA_WYDANIA) : null
        };
      });

    for (const doc of filteredFindDoc) {
      // wstawia lub aktualizuje
      await connect_SQL.query(
        `INSERT INTO documents_actions (document_id, DATA_WYDANIA_AUTA)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE DATA_WYDANIA_AUTA = ?`,
        [doc.id_document, doc.DATA_WYDANIA, doc.DATA_WYDANIA]
      );
    }
    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateCarReleaseDates: ${error}`, "reqServerErrors.txt");
    // console.error(error);
    return false;
  }
};

const updateSettlements = async () => {
  try {
    // const query = `SELECT 
    // fv.[NUMER],
    // tr.[WARTOSC_NAL] AS DO_ROZLICZENIA
    // FROM     [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
    // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr 
    // ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
    // WHERE
    // tr.WARTOSC_NAL !=0 AND tr.WARTOSC_NAL IS NOT NULL
    // AND tr.[IS_ROZLICZONY] != 1`;

    //     const query = `SELECT TOP (1000)
    //     [NUMER],
    //     SUM([WARTOSC_BRUTTO] - [ZAPLATA_ROZLICZNIE]) AS DO_ROZLICZENIA
    // FROM 
    //     [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC]
    // WHERE 
    //     [WARTOSC_BRUTTO] - [ZAPLATA_ROZLICZNIE] != 0
    // GROUP BY 
    //     [NUMER]
    // `;


    // const settlements = await msSqlQuery(query);

    // await connect_SQL.query(
    //   "UPDATE documents SET DO_ROZLICZENIA = 0"
    // );

    // for (const item of settlements) {
    //   await connect_SQL.query(
    //     "UPDATE documents SET DO_ROZLICZENIA = ? WHERE NUMER_FV = ?",
    //     [
    //       item.DO_ROZLICZENIA,
    //       item.NUMER
    //     ]
    //   );
    // }

    return false;
  }

  catch (error) {
    logEvents(`getDataFromMSSQL, uspdateSettlements: ${error}`, "reqServerErrors.txt");
    // console.error(error);
    return false;
  }
};

const updateSettlementDescription = async () => {

  const queryMsSql = '  SELECT  fv.[NUMER] AS NUMER_FV, rozl.[OPIS] AS NUMER_OPIS,	CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI  FROM     [AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr LEFT JOIN     [AS3_KROTOSKI_PRACA].[dbo].FAKTDOC AS fv    ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID] LEFT JOIN    [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] WHERE fv.[NUMER] IS NOT NULL';

  const queryMySQL = 'SELECT id_document, NUMER_FV FROM documents';
  try {
    const settlementDescription = await msSqlQuery(queryMsSql);


    const [documents] = await connect_SQL.query(queryMySQL);
    console.log(documents.length);

    const filteredSettlements = settlementDescription
      .filter(item => {
        // Filtrujemy tylko te obiekty, które mają pasujący NUMER_FV w documents
        return documents.some(data => data.NUMER_FV === item.NUMER_FV);
      })
      .map(item => {
        // Teraz już mamy tylko pasujące elementy, więc dodajemy id_document
        const matchingDocument = documents.find(data => data.NUMER_FV === item.NUMER_FV);

        // Jeśli znaleziono pasujący dokument, dodaj id_document do obiektu w settlementDescription
        if (matchingDocument) {
          return { ...item, id_document: matchingDocument.id_document };
        }

        return item;
      });

    const updatedSettlements = Object.values(
      filteredSettlements.reduce((acc, item) => {
        // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
        const formattedAmount = (typeof item.WARTOSC_OPERACJI === 'number' && !isNaN(item.WARTOSC_OPERACJI))
          ? item.WARTOSC_OPERACJI.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          })
          : 'brak danych';

        const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;

        if (!acc[item.NUMER_FV]) {
          // Tworzymy nowy obiekt, jeśli nie istnieje jeszcze dla tego NUMER_FV
          acc[item.NUMER_FV] = {
            id_document: item.id_document,
            NUMER_FV: item.NUMER_FV,
            DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
            OPIS_ROZRACHUNKU: [description]
          };
        } else {
          // Jeśli obiekt z NUMER_FV już istnieje, dodajemy nowy opis
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);
        }

        return acc;
      }, {})
    );




    // Najpierw wyczyść tabelę settlements_description
    await connect_SQL.query("DELETE FROM settlements_description");

    // Teraz przygotuj dane do wstawienia
    const values = updatedSettlements.map(item => [
      item.id_document,
      item.NUMER_FV,
      JSON.stringify(item.OPIS_ROZRACHUNKU),
      item.DATA_ROZLICZENIA
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
      INSERT IGNORE INTO settlements_description 
        (document_id, NUMER, OPIS_ROZRACHUNKU, DATA_ROZL_AS) 
      VALUES 
        ${values.map(() => "(?, ?, ?, ?)").join(", ")}
    `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());


    return true;
  }
  catch (error) {
    logEvents(`getDataFromMSSQL, updateSettlementDescription: ${error}`, "reqServerErrors.txt");
    // console.error(error);
    return false;
  }
};


const updateData = async () => {
  const checkDate = (data) => {
    return data.toISOString().slice(0, 10);
  };
  const checkTime = (data) => {
    return data.toISOString().slice(11, 16);
  };
  try {


    // dodanie faktur do DB
    const documentsUpdate = await addDocumentToDatabase();
    console.log(documentsUpdate);

    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        documentsUpdate ? 'Zaktualizowano' : 'Błąd aktualizacji',
        'Faktury'
      ]
    );

    // dodanie dat wydania samochodów 
    const carDateUpdate = await updateCarReleaseDates();
    console.log(carDateUpdate);

    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        carDateUpdate ? 'Zaktualizowano' : 'Błąd aktualizacji',
        'Wydania samochodów'
      ]);

    // aktualizacja rozrachunków
    const settlementsUpdate = await updateSettlements();
    console.log(settlementsUpdate);
    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        settlementsUpdate ? 'Zaktualizowano' : 'Błąd aktualizacji',
        'Rozrachunki'
      ]);

    // aktualizacja opisu rozrachunków
    const settlementDescriptionUpdate = await updateSettlementDescription();
    console.log(settlementDescriptionUpdate);
    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        settlementDescriptionUpdate ? 'Zaktualizowano' : 'Błąd aktualizacji',
        'Opisy rozrachunków'
      ]);

    // console.log(new Date());
    console.log('finish');
  } catch (error) {
    logEvents(`getDataFromMSSQL, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
  }
};

// cykliczne wywoływanie funkcji o określonej godzinie
// W wyrażeniu cron.schedule('58 16 * * *', ...) każda część odpowiada określonemu elementowi daty i czasu. Oto pełne wyjaśnienie:
// Minuta – 58: Minuta, w której zadanie ma się uruchomić (tutaj: 58 minuta każdej godziny).
// Godzina – 16: Godzina, w której zadanie ma się uruchomić (tutaj: 16, czyli 16:58).
// Dzień miesiąca – *: Gwiazdka oznacza każdy dzień miesiąca (od 1 do 31).
// Miesiąc – *: Gwiazdka oznacza każdy miesiąc (od stycznia do grudnia).
// Dzień tygodnia – *: Gwiazdka oznacza każdy dzień tygodnia (od poniedziałku do niedzieli).
cron.schedule('17 09 * * *', updateData, {
  timezone: "Europe/Warsaw"
});

module.exports = {
  updateData,
};
