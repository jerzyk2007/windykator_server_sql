const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const cron = require('node-cron');
const { logEvents } = require("../middleware/logEvents");
const { addDepartment } = require('./manageDocumentAddition');
const { checkDate, checkTime } = require('./manageDocumentAddition');

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
  const query = `SELECT 
       fv.[NUMER],
	    CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA,
	CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23) AS DATA_ZAPLATA,
       fv.[KONTR_NAZWA],
       fv.[KONTR_NIP],
       SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
       SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
       fv.[NR_SZKODY],
       fv.[NR_AUTORYZACJI],
       fv.[UWAGI],
       fv.[KOREKTA_NUMER],
       zap.[NAZWA] AS TYP_PLATNOSCI,
       us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL,
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
	   CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23),
	   CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23),
           fv.[KONTR_NAZWA],
       fv.[KONTR_NIP],
       fv.[NR_SZKODY],
       fv.[NR_AUTORYZACJI],
       fv.[UWAGI],
       fv.[KOREKTA_NUMER],
       zap.[NAZWA],
       us.[NAZWA] + ' ' + us.[IMIE],
       auto.[REJESTRACJA],
       auto.[NR_NADWOZIA],
       tr.[WARTOSC_NAL];
`;

  try {
    const documents = await msSqlQuery(query);
    // dodaje nazwy działów
    const addDep = addDepartment(documents);

    addDep.forEach(row => {
      row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
      row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
    });

    for (const doc of addDep) {

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
          doc.PRZYGOTOWAL ? doc.PRZYGOTOWAL : "Brak danych",
          doc.REJESTRACJA,
          doc.NR_SZKODY || null,
          doc.UWAGI,
          doc.TYP_PLATNOSCI,
          doc.KONTR_NIP || null,
          doc.NR_NADWOZIA,
          doc.NR_AUTORYZACJI || null,
          doc.KOREKTA_NUMER
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

// pobieram fv zaliczkowe, nazwy i kwoty
const updateDocZal = async () => {
  try {
    const queryMsSql = `SELECT 
    fv.[NUMER] AS NUMER_FV,
	    CASE 
        WHEN pos.[NAZWA] LIKE '%FV/ZAL%' THEN 
            SUBSTRING(
                pos.[NAZWA], 
                CHARINDEX('FV/ZAL', pos.[NAZWA]), 
                CHARINDEX('''', pos.[NAZWA] + '''', CHARINDEX('FV/ZAL', pos.[NAZWA])) - CHARINDEX('FV/ZAL', pos.[NAZWA])
            )
        ELSE NULL
    END AS FV_ZALICZKOWA,
	    SUM(CASE WHEN pos.[NAZWA] LIKE '%Faktura zaliczkowa%' THEN -pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO
 --   pos.[NAZWA]
FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
WHERE fv.[NUMER] != 'POTEM' 
  AND pos.[NAZWA] LIKE '%FV/ZAL%'
GROUP BY 
    fv.[NUMER],
    pos.[NAZWA]`;

    const documents = await msSqlQuery(queryMsSql);

    await connect_SQL.query("TRUNCATE TABLE fv_zaliczkowe");

    //     // // Teraz przygotuj dane do wstawienia
    const values = documents.map(item => [
      item.NUMER_FV,
      item.FV_ZALICZKOWA,
      item.WARTOSC_BRUTTO
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
      INSERT IGNORE INTO fv_zaliczkowe 
        ( NUMER_FV, FV_ZALICZKOWA, KWOTA_BRUTTO) 
      VALUES 
        ${values.map(() => "(?, ?,  ?)").join(", ")}
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
    return false;
  }
};

const updateSettlements = async () => {
  try {

    //     const queryMsSql = `
    //     DECLARE @Termin DATETIME = '2012-11-29'; -- Przykładowe wartości
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
    const queryMsSql = `
DECLARE @IS_BILANS BIT = 1;
DECLARE @IS_ROZLICZONY BIT = 0;
DECLARE @DATA_KONIEC DATETIME = GETDATE();

SELECT 
   T.OPIS,
 T.WARTOSC_SALDO,
CONVERT(VARCHAR(10),  T.DATA, 23) AS DATA_FV
FROM [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] T WITH(NOLOCK)
WHERE T.IS_BILANS = @IS_BILANS
 AND T.IS_ROZLICZONY = @IS_ROZLICZONY
 AND T.DATA <= @DATA_KONIEC
 AND T.WARTOSC_SALDO IS NOT NULL
 AND T.TERMIN IS NOT NULL
       `;

    const settlementsValue = await msSqlQuery(queryMsSql);

    const filteredData = settlementsValue.map(item => {
      const cleanDoc = item.OPIS.split(" ")[0];
      return {
        NUMER_FV: cleanDoc,
        DATA_FV: item.DATA_FV,
        DO_ROZLICZENIA: -(item.WARTOSC_SALDO)
      };
    });

    const checkDuplicate = Object.values(
      filteredData.reduce((acc, item) => {
        if (acc[item.NUMER_FV]) {
          // Jeśli NUMER_FV już istnieje, dodaj wartość DO_ROZLICZENIA
          acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
        } else {
          // Jeśli NUMER_FV nie istnieje, dodaj nowy rekord z zachowaniem DATA_FV
          acc[item.NUMER_FV] = {
            NUMER_FV: item.NUMER_FV,
            DATA_FV: item.DATA_FV,
            DO_ROZLICZENIA: item.DO_ROZLICZENIA
          };
        }
        return acc;
      }, {})
    );

    // Najpierw wyczyść tabelę settlements_description
    await connect_SQL.query("TRUNCATE TABLE settlements");

    // Teraz przygotuj dane do wstawienia
    const values = checkDuplicate.map(item => [
      item.NUMER_FV,
      item.DATA_FV,
      item.DO_ROZLICZENIA
    ]);

    const query = `
     INSERT IGNORE INTO settlements
       ( NUMER_FV, DATA_FV, NALEZNOSC) 
     VALUES 
       ${values.map(() => "(?, ?, ?)").join(", ")}
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

// aktualizacja opisów rozrachunków
const updateSettlementDescription = async () => {
  const queryMsSql = `SELECT 
     CASE 
          WHEN CHARINDEX(' ', tr.[OPIS]) > 0 THEN LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS]) - 1) 
          ELSE tr.[OPIS] 
      END AS NUMER_FV,
  rozl.[OPIS] AS NUMER_OPIS,
  CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
  CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
  rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI
  FROM     [AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr 
  LEFT JOIN    [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
  WHERE rozl.[WARTOSC_SALDO] IS NOT NULL`;

  try {
    const settlementDescription = await msSqlQuery(queryMsSql);

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
            OPIS_ROZRACHUNKU: [description]
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
            return dateA - dateB;
          });
        }

        return acc;
      }, {})
    );

    //dodawanie do mysql dużych pakietów danych, podzielonych na części
    const batchInsert = async (connection, data, batchSize = 50000) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const values = batch.map(item => [
          item.NUMER_FV,
          JSON.stringify(item.OPIS_ROZRACHUNKU),
          item.DATA_ROZLICZENIA
        ]);

        const query = `
          INSERT IGNORE INTO settlements_description 
            (NUMER, OPIS_ROZRACHUNKU, DATA_ROZL_AS) 
          VALUES 
            ${values.map(() => "(?, ?, ?)").join(", ")}
        `;

        await connection.query(query, values.flat());
      }
    };

    try {
      await connect_SQL.query("TRUNCATE TABLE settlements_description");
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

//wykonuje po kolei aktualizację danych i zapisuje daty i statusy
const updateData = async () => {
  try {
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT data_name, date,  hour, update_success FROM updates"
    );

    const filteredUpdatesData = getUpdatesData.filter(item => item.data_name !== 'Rubicon' && item.data_name !== 'BeCared' && item.data_name !== "Dokumenty Raportu FK");


    const updateProgress = filteredUpdatesData.map(item => {
      return {
        ...item,
        date: '',
        hour: '',
        update_success: "Trwa aktualizacja ..."
      };

    });

    for (const item of updateProgress) {
      const queryUpdate = `
      UPDATE updates 
      SET 
      data_name = '${item.data_name}',
      date = '${item.date}',    
        hour = '${item.hour}', 
        update_success = '${item.update_success}'
      WHERE 
        data_name = '${item.data_name}'
    `;
      await connect_SQL.query(queryUpdate);
    }

    // dodanie faktur do DB
    addDocumentToDatabase().then((result) => {
      connect_SQL.query(
        "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
        [
          checkDate(new Date()),
          checkTime(new Date()),
          result ? "Zaktualizowano." : "Błąd aktualizacji",
          'Faktury'
        ]
      );
    }).catch((error) => {
      logEvents(`getDataFromMSSQL - updateCarReleaseDates, getData: ${error}`, "reqServerErrors.txt");
    });

    //dodawanie fv zaliczkowych
    updateDocZal();

    // dodanie dat wydania samochodów 
    updateCarReleaseDates().then((result) => {
      connect_SQL.query(
        "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
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
        "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
        [
          checkDate(new Date()),
          checkTime(new Date()),
          result ? "Zaktualizowano." : "Błąd aktualizacji",
          'Rozrachunki'
        ]);
    }).catch((error) => {
      logEvents(`getDataFromMSSQL - updateSettlements, getData: ${error}`, "reqServerErrors.txt");
    });

    // // aktualizacja opisu rozrachunków
    updateSettlementDescription().then((result) => {
      connect_SQL.query(
        "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
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

cron.schedule('05 07 * * *', updateData, {
  timezone: "Europe/Warsaw"
});


module.exports = {
  updateData,
  updateSettlementDescription,
  updateDocZal,
  updateCarReleaseDates
};
