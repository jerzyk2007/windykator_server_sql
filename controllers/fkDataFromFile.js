// const { FKRaport, FKDataRaport } = require("../model/FKRaport");
// const UpdateDB = require("../model/UpdateDB");
// const Document = require("../model/Document");
const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { addDepartment } = require('./manageDocumentAddition');


const { logEvents } = require("../middleware/logEvents");

//pobieranie danych FK (wstępnie obrobionych przez dodawanie danych z kolejnych plików excel) do front żeby odciążyć
const getPreparedItems = async (req, res) => {
  try {
    // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i opiekunów
    // const resultItems = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedItems = [...resultItems[0].preparedItems];
    // res.json(preparedItems);
    res.json({});
  } catch (error) {
    logEvents(`dataFkFromFile, getPreparedItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// zapis danych FK do DB po zmianach 
const savePreparedData = async (docsData, type) => {

  try {
    // usunięcie danych
    await connect_SQL.query("TRUNCATE TABLE fk_raport");

    const values = docsData.map(item => [
      item.KONTRAHENT,
      item.NR_KONTRAHENTA,
      item.NUMER,
      item.DO_ROZLICZENIA_FK,
      item.DATA_PLATNOSCI,
      item.KONTO,
      item.DZIAL,
      item.TYP_DOKUMENTU,
      item.LOKALIZACJA,
      item.OBSZAR,
      JSON.stringify(item.OWNER),
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI),
      item.DATA_WYDANIA_AUTA,
      item.DATA_WYSTAWIENIA_FV,
      item.DATA_ROZLICZENIA,
      JSON.stringify(item.OPIS_ROZRACHUNKU),
    ]);

    const query = `
        INSERT IGNORE INTO fk_raport 
          (KONTRAHENT, NR_KLIENTA, NR_DOKUMENTU, KWOTA_DO_ROZLICZENIA_FK, TERMIN_PLATNOSCI_FV, RODZAJ_KONTA, DZIAL, TYP_DOKUMENTU, LOKALIZACJA, OBSZAR, OWNER, OPIEKUN_OBSZARU_CENTRALI, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DATA_ROZLICZENIA_AS, OPIS_ROZRACHUNKU) 
        VALUES 
          ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
      `;

    await connect_SQL.query(query, values.flat());

    // console.log(docsData.length);

    //zapis do db
    // await FKRaport.updateOne(
    //   {},
    //   { $set: { preparedRaportData: data } },
    //   { upsert: true }
    // );

    // zapis daty i ilości danych zapisanych do DB
    const dateObj = new Date();
    // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter: docsData.length ? docsData.length : 0,
    };

    // console.log(updateDate, type);
    return true;

  } catch (error) {
    logEvents(`dataFkFromFile, savePreparedData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return false;
  }
};

// funkcja pobiera  wcześniej przygotowane dane z raportData
const getPreparedData = async (req, res) => {
  try {
    // const resultItems = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedData = [...resultItems[0].preparedRaportData];
    // res.json(preparedData);
    res.json({});
  } catch (error) {
    logEvents(`dataFkFromFile, getPreparedData: ${error}`, "reqServerErrors.txt");

    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// pobiera wszytskie dane z raportu BL do dalszej obróbki dla raportu FK
const getDocumentsBL = async (req, res) => {
  try {
    // const result = await Document.find({});
    // res.json(result);
    res.json({});
  } catch (error) {
    logEvents(`dataFkFromFile, getPreparedData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// pobieram przygotowane dane, przygotowane wiekowania, ownerzy, rozrachunki do wygenerowania raportu
const dataToGenerateRaport = async (req, res) => {
  try {
    // pobieram przygotowane dane z plików excel
    // const resultItems = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedData = [...resultItems[0].preparedRaportData];
    // const preparedDataWithoutId = preparedData.map(({ _id, ...rest }) => rest);

    // //pobieram rozrachunki z raportu BL
    // const allSettlements = await UpdateDB.find({}, { settlements: 1 });
    // const settlementItems = [...allSettlements[0].settlements];
    // //usuwam zbędne rozrachunki nie występujące w raporcie FK
    // const filteredSettlements = settlementItems.filter((item) => {
    //   return preparedDataWithoutId.some(
    //     (data) => data.NR_DOKUMENTU === item.NUMER_FV
    //   );
    // });

    // // poberam dane wiekowanie
    // const resultAging = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedAging = [...resultAging[0].aging];

    // // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i poiekunów
    // const items = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedItems = [...items[0].preparedItems];

    // res.json({
    //   dataFK: preparedDataWithoutId,
    //   settlements: filteredSettlements,
    //   aging: preparedAging,
    //   items: preparedItems,
    // });
  } catch (error) {
    logEvents(`dataFkFromFile, dataToGenerateRaport: ${error}`, "reqServerErrors.txt");
    return res.status(500).json({ error: "Server error" });
  }
};

// const saveRaportFK = async (req, res) => {
//   try {
//     const { dataRaport } = req.body;

//     // zapis do DB po zmianach
//     // await FKDataRaport.findOneAndUpdate(
//     //   {},
//     //   {
//     //     $set: {
//     //       FKDataRaports: dataRaport,
//     //     },
//     //   },
//     //   {
//     //     returnOriginal: false,
//     //     upsert: true,
//     //   }
//     // );

//     // const dateObj = new Date();
//     // // Pobieramy poszczególne elementy daty i czasu
//     // const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
//     // const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
//     // const year = dateObj.getFullYear(); // Rok

//     // // Formatujemy datę i czas według wymagań
//     // const actualDate = `${day}-${month}-${year}`;

//     // const updateDate = {
//     //   date: actualDate,
//     //   counter: dataRaport.length,
//     // };

//     // await FKRaport.findOneAndUpdate(
//     //   {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
//     //   {
//     //     $set: {
//     //       "updateDate.genrateRaport": updateDate,
//     //     },
//     //   }, // Nowe dane, które mają zostać ustawione
//     //   {
//     //     upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
//     //     returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
//     //   }
//     // );
//     res.end();
//   } catch (error) {
//     logEvents(`dataFkFromFile, saveRaportFK: ${error}`, "reqServerErrors.txt");
//     console.error(error);
//     return res.status(500).json({ error: "Server error" });
//   }
// };

// dodawana jest nazwa działu na podstawie numeru faktury
const prepareDepartments = (data) => {
  try {
    const generateDep = addDepartment(data);
    return generateDep;

  }
  catch (error) {
    return false;
  }
};

// dodawana jest items: lokalizacja, obszar, owner itd, nr klienta, typ dokumentu
const generateItems = (itemsData, docsData) => {
  try {

    const errorDepartments = [];
    const generateData = docsData.map(doc => {
      // nadaję typ dokumentu np korekta
      let TYP_DOKUMENTU = "";
      if (doc.NUMER.includes("KF/ZAL")) {
        TYP_DOKUMENTU = "Korekta zaliczki";
      } else if (doc.NUMER.includes("KF/")) {
        TYP_DOKUMENTU = "Korekta";
      } else if (doc.NUMER.includes("KP/")) {
        TYP_DOKUMENTU = "KP";
      } else if (doc.NUMER.includes("NO/")) {
        TYP_DOKUMENTU = "Nota";
      } else if (doc.NUMER.includes("PP/")) {
        TYP_DOKUMENTU = "Paragon";
      } else if (doc.NUMER.includes("PK")) {
        TYP_DOKUMENTU = "PK";
      } else if (doc.NUMER.includes("IP/")) {
        TYP_DOKUMENTU = "Karta Płatnicza";
      } else if (doc.NUMER.includes("FV/ZAL")) {
        TYP_DOKUMENTU = "Faktura zaliczkowa";
      } else if (doc.NUMER.includes("FV/")) {
        TYP_DOKUMENTU = "Faktura";
      } else {
        TYP_DOKUMENTU = "Inne";
      }

      // dopasowanie ownerów, lokalizacji itp
      const matchingDepItem = itemsData.find(
        (preparedItem) => preparedItem.department === doc.DZIAL
      );

      let LOKALIZACJA = "";
      let OBSZAR = "";
      let OWNER = [];
      let OPIEKUN_OBSZARU_CENTRALI = [];

      if (matchingDepItem) {
        OWNER = matchingDepItem.owner;
        LOKALIZACJA = matchingDepItem.localization;
        OBSZAR = matchingDepItem.area;
        OPIEKUN_OBSZARU_CENTRALI = matchingDepItem.guardian;
      } else {
        if (!errorDepartments.includes(doc.DZIAL)) {
          errorDepartments.push(doc.DZIAL);
        }
      }
      return {
        ...doc,
        TYP_DOKUMENTU,
        LOKALIZACJA,
        OBSZAR,
        OWNER,
        OPIEKUN_OBSZARU_CENTRALI
      };

    });
    return { generateData, errorDepartments };
  }
  catch (error) {
    logEvents(`dataFkFromFile, generateItems: ${error}`, "reqServerErrors.txt");

    return false;
  }
};

const docDateUpdate = async (docsData) => {
  try {
    // Funkcja do pobierania daty z bazy

    const findDateDB = await msSqlQuery(`SELECT 
        CONVERT(VARCHAR(10), tr.[DATA], 23) AS DATA_WYST_FV,
        CONVERT(VARCHAR(10), tr.[TERMIN], 23) AS TERMIN_FV,
        CONVERT(VARCHAR(10), fv.[DATA_WYDANIA], 23) AS DATA_WYDANIA_AUTA,
		fv.[NUMER] AS NUMER_FV
          FROM [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr
    LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv 
        ON tr.[FAKTDOC_ID] = fv.[FAKTDOC_ID]
    WHERE tr.[DATA] IS NOT NULL AND fv.[NUMER] IS NOT NULL`);


    // dodaje daty wydania i wystawienia fv
    const updatedData = docsData.map(doc => {
      const findDate = findDateDB.find(
        (preparedItem) => preparedItem.NUMER_FV === doc.NUMER
      );
      const subtractDays = (dateString, days) => {
        // Tworzymy obiekt Date z daty w formacie 'YYYY-MM-DD'
        const date = new Date(dateString);

        // Odejmujemy określoną liczbę dni (w milisekundach)
        date.setDate(date.getDate() - days);

        // Konwertujemy datę z powrotem na string w formacie 'YYYY-MM-DD'
        return date.toISOString().split('T')[0];
      };

      // odejmuje od daty wystawienia fv 14 dni 
      const DATA_WYSTAWIENIA_FV_14 = subtractDays(doc.DATA_PLATNOSCI, 14);

      if (findDate) {
        return {
          ...doc,
          DATA_WYDANIA_AUTA: doc.OBSZAR === "SAMOCHODY NOWE" || doc.OBSZAR === "SAMOCHODY UŻYWANE" ? findDate.DATA_WYDANIA_AUTA : null,
          DATA_WYSTAWIENIA_FV: findDate.DATA_WYST_FV ? findDate.DATA_WYST_FV : DATA_WYSTAWIENIA_FV_14,
          BRAK_DATY_WYSTAWIENIA_FV: !findDate.DATA_WYST_FV ? "TAK" : null
        };

      } else {
        return {
          ...doc,
          DATA_WYDANIA_AUTA: null,
          DATA_WYSTAWIENIA_FV: DATA_WYSTAWIENIA_FV_14,
          BRAK_DATY_WYSTAWIENIA_FV: "TAK"
        };
      }
    });

    const findMissingDate = await msSqlQuery(`SELECT 
            CONVERT(VARCHAR(10), tr.[DATA], 23) AS DATA_WYST_FV,
            CONVERT(VARCHAR(10), tr.[TERMIN], 23) AS TERMIN_FV,
    LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS] + ' ') - 1) AS NUMER_FV
        FROM [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr
        LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv 
            ON tr.[FAKTDOC_ID] = fv.[FAKTDOC_ID]
        WHERE tr.[DATA] IS NOT NULL AND (tr.[OPIS] LIKE 'FV%' OR tr.[OPIS] LIKE 'KF%')`);

    // const filteredMissingDoc = findMissingDate
    //   .filter(item => {
    //     // Filtrujemy tylko te obiekty, które mają pasujący NUMER_FV w documents
    //     return updatedData.some(data => data.NUMER === item.NUMER_FV);
    //   });

    const updatedDataMissingDate = updatedData.map(doc => {
      const findDate = findMissingDate.find(
        (preparedItem) => preparedItem.NUMER_FV === doc.NUMER
      );


      if (findDate && doc.BRAK_DATY_WYSTAWIENIA_FV) {
        return {
          ...doc,
          DATA_WYSTAWIENIA_FV: findDate.DATA_WYST_FV ? findDate.DATA_WYST_FV : doc.DATA_WYSTAWIENIA_FV,
          BRAK_DATY_WYSTAWIENIA_FV: !findDate.DATA_WYST_FV ? "TAK" : null
        };

      } else {
        return {
          ...doc
        };
      }
    });



    // Zwracamy wynik po zakończeniu przetwarzania wszystkich danych
    return updatedData;


  } catch (error) {
    console.error(error);
    logEvents(`dataFkFromFile, carDateUpdate: ${error}`, "reqServerErrors.txt");

    return false;  // Zwracamy false w przypadku błędu
  }
};


const updateSettlementDescription = async (documents) => {
  // const queryMsSql = `SELECT TOP 100 fv.[NUMER] AS NUMER_FV, rozl.[OPIS] AS NUMER_OPIS, 
  // CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
  // CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
  // rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI  
  // FROM[AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr 
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].FAKTDOC AS fv    ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID] 
  // LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
  // WHERE  fv.[NUMER] = 'FV/UB/55/24/X/D9' OR fv.[NUMER] = 'FV/UB/56/24/X/D9' OR fv.[NUMER] = 'FV/UBL/124/24/V/D68' OR fv.[NUMER] = 'FV/UBL/341/24/V/D58' OR fv.[NUMER] = 'FV/UBL/81/24/S/D68'`;
  const queryMsSql = `SELECT  fv.[NUMER] AS NUMER_FV, rozl.[OPIS] AS NUMER_OPIS, 
  CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA], 
  CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI, 
  rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI  
  FROM[AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr 
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].FAKTDOC AS fv    ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID] 
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID] 
  WHERE fv.[NUMER] IS NOT NULL`;

  try {
    const settlementDescription = await msSqlQuery(queryMsSql);


    const filteredSettlements = settlementDescription
      .filter(item => {
        // Filtrujemy tylko te obiekty, które mają pasujący NUMER_FV w documents
        return documents.some(data => data.NUMER === item.NUMER_FV);
      });


    const generateSettlements = Object.values(
      filteredSettlements.reduce((acc, item) => {
        // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
        const formattedAmount = (typeof item.WARTOSC_OPERACJI === 'number' && !isNaN(item.WARTOSC_OPERACJI))
          ? item.WARTOSC_OPERACJI.toLocaleString('pl-PL', {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
            useGrouping: true
          })
          : 'brak danych';

        // Warunek, aby pominąć wpisy z wartościami null lub "brak danych"
        if (item.DATA_OPERACJI === null && item.NUMER_OPIS === null && formattedAmount === 'brak danych') {
          return acc; // Pomijamy dodawanie do acc
        }

        const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;

        if (!acc[item.NUMER_FV]) {
          // Tworzymy nowy obiekt, jeśli nie istnieje jeszcze dla tego NUMER_FV
          acc[item.NUMER_FV] = {
            NUMER: item.NUMER_FV,
            DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
            OPIS_ROZRACHUNKU: [description],
          };
        } else {
          // Jeśli obiekt z NUMER_FV już istnieje, dodajemy nowy opis
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);
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


    const updateDocuments = documents.map(doc => {
      const checkSett = generateSettlements.filter(item => item.NUMER === doc.NUMER);
      if (checkSett.length) {
        return {
          ...doc,
          DATA_ROZLICZENIA: checkSett[0].DATA_ROZLICZENIA,
          OPIS_ROZRACHUNKU: checkSett[0].OPIS_ROZRACHUNKU,
        };
      }
      else {
        return {
          ...doc,
          DATA_ROZLICZENIA: null,
          OPIS_ROZRACHUNKU: null,
        };
      }
    });

    return updateDocuments;
  }
  catch (error) {
    logEvents(`dataFkFromFile, updateSettlementDescription: ${error}`, "reqServerErrors.txt");
    return false;
  }
};

const dataFkAccocuntancyFromExcel = async (req, res) => {
  const { documents_data } = req.body;
  try {
    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );

    // dodaje wygenerowane na działy na podstawie nazwy documentu
    const resultDep = prepareDepartments(documents_data);

    if (!resultDep) {
      return res.status(500).json({ error: "Server error" });
    }
    // console.log(resultDep.length);

    const addItems = generateItems(preparedItems, resultDep);

    if (!addItems) {
      return res.status(500).json({ error: "Server error" });
    } else if (addItems.errorDepartments.length) {
      return res.json({ errorDepartments: addItems.errorDepartments });
    }

    // console.log(addItems.generateData.length);

    const addDocDate = await docDateUpdate(addItems.generateData);
    if (!addDocDate) {
      return res.status(500).json({ error: "Server error" });
    }

    // console.log(addDocDate.length);


    const updateSettlements = await updateSettlementDescription(addDocDate);
    if (!updateSettlements) {
      return res.status(500).json({ error: "Server error" });
    }
    // console.log(updateSettlements.length);

    await savePreparedData(updateSettlements, 'accountancy');

    res.end();
  }
  catch (error) {
    logEvents(
      `dataFkFromFile, dataFkFromExcel: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getPreparedItems,
  savePreparedData,
  getPreparedData,
  getDocumentsBL,
  dataToGenerateRaport,
  // saveRaportFK,
  dataFkAccocuntancyFromExcel
};
