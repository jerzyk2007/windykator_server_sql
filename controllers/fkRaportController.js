// const FKRaport = require("../model/FKRaport");
// const { FKRaport, FKDataRaport } = require("../model/FKRaport");
const { connect_SQL } = require("../config/dbConn");
const { checkDate } = require('./manageDocumentAddition');

// const FKDataRaport = require("../model/FKRaportData");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

// do usunięcia
// Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
const excelDateToISODate = (excelDate) => {
  // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
};

//do usunięcia
// funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
const isExcelDate = (value) => {
  // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
  if (typeof value === "number" && value > 0) {
    // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
    return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
  }

  return false;
  s;
};

//do usunięcia
// weryfikacja czy plik excel jest prawidłowy (czy nie jest podmienione rozszerzenie)
const isExcelFile = (data) => {
  const excelSignature = [0x50, 0x4b, 0x03, 0x04];
  for (let i = 0; i < excelSignature.length; i++) {
    if (data[i] !== excelSignature[i]) {
      return false;
    }
  }
  return true;
};

//do usunięcia
// funkcja która przesyła na server już gotowe dane z przygotowanego raportu
// const documentsFromFile = async (req, res) => {
//   if (!req.file) {
//     return res.status(400).json({ error: "Not delivered file" });
//   }
//   try {
//     const buffer = req.file.buffer;
//     const data = new Uint8Array(buffer);

//     if (!isExcelFile(data)) {
//       return res.status(500).json({ error: "Invalid file" });
//     }
//     const workbook = read(buffer, { type: "buffer" });
//     const workSheetName = workbook.SheetNames[0];
//     const workSheet = workbook.Sheets[workSheetName];
//     const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

//     if (
//       !rows[0]["TYP DOK."] &&
//       !rows[0]["NUMER DOKUMENTU"] &&
//       !rows[0]["DZIAŁ"] &&
//       !rows[0]["KONTRAHENT"] &&
//       !rows[0]["RODZAJ KONTA"] &&
//       !rows[0][" KWOTA DO ROZLICZENIA FK "] &&
//       !rows[0]["   DO ROZLICZENIA AS3 (2024-03-12)  "] &&
//       !rows[0][" UWAGI DAWID-  "]
//     ) {
//       return res.status(500).json({ error: "Invalid file" });
//     }

//     const updateRows = rows.map((row) => {
//       return {
//         TYP_DOK: row["TYP DOK."],
//         NR_DOKUMENTU: row["NUMER DOKUMENTU"],
//         DZIAL: row["DZIAŁ"],
//         KONTRAHENT: row["KONTRAHENT"],
//         RODZAJ_KONTA: row["RODZAJ KONTA"],
//         KWOTA_DO_ROZLICZENIA_FK: row[" KWOTA DO ROZLICZENIA FK "],
//         DO_ROZLICZENIA_AS: row["   DO ROZLICZENIA AS3 (2024-03-12)  "],
//         ROZNICA:
//           row[" KWOTA DO ROZLICZENIA FK "] -
//           row["   DO ROZLICZENIA AS3 (2024-03-12)  "],
//         DATA_ROZLICZENIA_AS:
//           row["  DATA ROZLICZENIA W AS3  "] &&
//           row["  DATA ROZLICZENIA W AS3  "] !== "BRAK"
//             ? excelDateToISODate(
//                 row["  DATA ROZLICZENIA W AS3  "],
//                 row["NUMER DOKUMENTU"]
//               )
//             : "",
//         UWAGI_DAWID: row[" UWAGI DAWID-  "],
//         DATA_WYSTAWIENIA_FV:
//           row["DATA WYSTAWIENIA FV"] && row["DATA WYSTAWIENIA FV"] !== "BRAK"
//             ? excelDateToISODate(row["DATA WYSTAWIENIA FV"])
//             : "",
//         TERMIN_PLATNOSCI_FV:
//           row["TERMIN PŁATNOŚCI"] && row["TERMIN PŁATNOŚCI"] !== "BRAK"
//             ? excelDateToISODate(row["TERMIN PŁATNOŚCI"])
//             : "",
//         ILE_DNI_NA_PLATNOSC_FV: row["ILOŚĆ DNI NA PŁATNOŚĆ"],
//         PRZETER_NIEPRZETER: row["PRZETERMINOWANE/NIEPRZETERMINOWANE"],
//         PRZEDZIAL_WIEKOWANIE: row["PRZEDZIAŁ"],
//         NR_KLIENTA: row["Nr klienta"],
//         JAKA_KANCELARIA: row["JAKA KANCELARIA"],
//         ETAP_SPRAWY: row["ETAP SPRAWY"],
//         KWOTA_WPS: row[" Kwota WPS "],
//         CZY_W_KANCELARI: row["CZY KANCELARIA\r\nTAK/ NIE"],
//         OBSZAR: row[" OBSZAR "],
//         CZY_SAMOCHOD_WYDANY_AS: row["CZY SAMOCHÓD WYDANY (dane As3)"],
//         OWNER: row["OWNER"],
//         OPIENKUN_OBSZARU_CENTRALI: row["OPIEKUN OBSZARU Z CENTRALI"],
//         KONTRAHENT_CZARNA_LISTA: row["CZY KONTRAHNET NA CZARNEJ LIŚCIE"],
//       };
//     });

//     const update = await FKRaport.updateOne(
//       {},
//       {
//         $set: { "data.FKData": updateRows }, // Ustaw nowe dane dla pola data.FKData, nadpisując stare dane
//       },
//       { upsert: true }
//     );

//     res.json("Updated data");
//   } catch (error) {
//     logEvents(
//       `fkRaportController, documentsFromFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika
const getData = async (req, res) => {

  try {

    const [dataRaport] = await connect_SQL.query('SELECT * FROM fk_raport');

    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });

    // const accountArray = [
    //   ...new Set(
    //     dataRaport
    //       .filter((item) => item.RODZAJ_KONTA)
    //       .map((item) => item.OBSZAR)
    //   ),
    // ].sort();

    // const updatedDataRaport = dataRaport.map(item => {
    //   // Iterujemy po kluczach obiektu
    //   for (let key in item) {
    //     if (item[key] === null) {
    //       item[key] = "NULL";  // Zamieniamy null na string "NULL"
    //     }
    //   }
    //   return item;
    // });

    // const resultArray = accountArray.reduce((acc, area) => {
    //   // Filtrujemy obiekty, które mają odpowiedni OBSZAR
    //   const filteredData = updatedDataRaport.filter(item => item.OBSZAR === area);

    //   // Jeśli są dane, dodajemy obiekt do wynikowej tablicy
    //   if (filteredData.length > 0) {
    //     // acc.push({ [area]: filteredData });
    //     acc.push({ name: area, data: filteredData });
    //   }

    //   return acc;
    // }, []);


    // // Dodajemy obiekt RAPORT na początku tablicy
    // const finalResult = [{ name: 'RAPORT', data: dataRaport }, ...resultArray];

    // console.log(finalResult);

    // const orderColumns = Object.keys(dataRaport[0]);


    res.json(dataRaport);

    // const result = await FKRaport.find({});

    // const result = await FKDataRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       data: "$FKDataRaports", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);

    // const preparedDataWithoutId = result[0].data.map(
    //   ({ _id, ...rest }) => rest
    // );
    // let dataRaport = [...preparedDataWithoutId];

    // if (filter.business !== "201203") {
    //   dataRaport = dataRaport.filter(
    //     (item) => item.RODZAJ_KONTA === Number(filter.business)
    //   );
    // }

    // if (filter.payment !== "Wszystko") {
    //   if (
    //     filter.payment === "Przeterminowane" ||
    //     filter.payment === "Przeterminowane > 8"
    //   ) {

    //     dataRaport = dataRaport.filter(
    //       (item) => item.PRZETER_NIEPRZETER === "Przeterminowane"

    //     );

    //   } else if (filter.payment === "Nieprzeterminowane") {
    //     dataRaport = dataRaport.filter(
    //       (item) => item.PRZETER_NIEPRZETER === "Nieprzeterminowane"
    //     );
    //   }
    // }

    // if (filter.actions !== "All") {
    //   if (filter.actions === "Tak") {
    //     dataRaport = dataRaport.filter(
    //       (item) => item.CZY_W_KANCELARI === "TAK"
    //     );
    //   }

    //   if (filter.actions === "Nie") {
    //     dataRaport = dataRaport.filter(
    //       (item) => item.CZY_W_KANCELARI === "NIE"
    //     );
    //   }
    // } else if (filter.actions === "All" && filter.raport === "lawyerRaport") {
    //   dataRaport = dataRaport.filter((item) => item.CZY_W_KANCELARI === "TAK");
    // }
    // res.json(dataRaport);
    // res.end();
  } catch (error) {
    logEvents(`fkRaportController, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera wszystkie klucze z pierwszego documentu żeby mozna było nazwy, filtry i ustawienia kolumn edytować, głównie chodzi o nowo dodane kolumny
// const getNewColumns = async (req, res) => {
//   try {
//     // // const result = await FKRaport.findOne();
//     // const result = await FKDataRaport.aggregate([
//     //   {
//     //     $project: {
//     //       _id: 0, // Wyłączamy pole _id z wyniku
//     //       FKDataRaports: "$FKDataRaports", // Wybieramy tylko pole FKData z pola data
//     //     },
//     //   },
//     // ]);

//     // const firstDocument = result[0].FKDataRaports[0];

//     // if (firstDocument) {
//     //   // Pobierz klucze z pierwszego dokumentu i umieść je w tablicy
//     //   const keysArray = Object.keys(firstDocument);

//     //   const newArray = keysArray.filter(
//     //     (item) => item !== "_id" && item !== "__v"
//     //   );

//     //   res.json(newArray);
//     // } else {
//     //   return res.status(400).json({ error: "Empty collection." });
//     // }
//     res.end();
//   } catch (error) {
//     logEvents(
//       `fkRaportController, getNewColumns: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny
// const changeColumns = async (req, res) => {
//   const { columns } = req.body;
//   const updateColumns = { tableColumns: columns };
//   try {
//     // await FKRaport.updateOne(
//     //   {},
//     //   { $set: updateColumns },
//     //   { new: true, upsert: true }
//     // );

//     res.end();
//   } catch (error) {
//     logEvents(
//       `fkRaportController, changeColumns: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

//funkcja która pobiera kolumny które już zostały zapisane i zmodyfikowane
const getColumns = async (req, res) => {
  try {
    // const result = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       columns: "$tableColumns", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);

    // res.json(result[0].columns);
    res.end();
  } catch (error) {
    logEvents(
      `fkRaportController, getColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobieram daty  aktualizacji plików excel dla raportu FK !!!
const getDateCounter = async (req, res) => {
  try {
    const [result] = await connect_SQL.query('SELECT title, date, counter FROM fk_updates_date');

    const jsonObject = result.reduce((acc, item) => {
      acc[item.title] = {
        date: item.date,    // Przypisanie `date` jako `hour`
        counter: item.counter
      };
      return acc;
    }, {});

    // console.log(jsonObject);
    res.json({ updateData: jsonObject });
  } catch (error) {
    logEvents(
      `fkRaportController, getDateCounter: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funckja kasuje przygotwane dane do raportu, czas dodania pliki i ilość danych
const deleteDataRaport = async (req, res) => {
  try {
    await connect_SQL.query('TRUNCATE fk_updates_date');
    await connect_SQL.query('TRUNCATE raportFK_accountancy');

    res.json({ result: "delete" });
  } catch (error) {
    logEvents(
      `fkRaportController, deleteDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const generateRaport = async (req, res) => {
  try {
    // const [getData] = await connect_SQL.query('SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS FROM raportFK_accountancy AS RA LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN rubicon AS R ON RA.NUMER_FV = R.NUMER_FV LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER WHERE RA.TERMIN_FV < DATE_SUB(CURDATE(), INTERVAL 7 DAY)');
    const [getData] = await connect_SQL.query('SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS FROM raportFK_accountancy AS RA LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN rubicon AS R ON RA.NUMER_FV = R.NUMER_FV LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER ');

    const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');
    // console.log(getAging);

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split('T')[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      return differenceInDays;
    };

    // sprawdza czy fv jest przeterminowana czy nieprzeterminowana
    const isOlderThanToday = (TERMIN_FV) => {
      // Konwersja TERMIN_FV na obiekt Date
      const terminDate = new Date(TERMIN_FV);
      // Pobranie dzisiejszej daty bez czasu (tylko yyyy-mm-dd)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerowanie godziny, minuty, sekundy, milisekundy
      return terminDate < today;
    };

    // przypisywanie przedziału wiekowania

    const checkAging = (TERMIN_FV) => {
      const date1 = new Date();
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date1 - date2;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      let title = "";

      for (const age of getAging) {
        if (age.type === "first" && Number(age.firstValue) >= differenceInDays) {
          title = age.title;
          break;
        } else if (
          age.type === "last" &&
          Number(age.secondValue) <= differenceInDays
        ) {
          title = age.title;
          break;
        } else if (
          age.type === "some" &&
          Number(age.firstValue) <= differenceInDays &&
          Number(age.secondValue) >= differenceInDays
        ) {
          title = age.title;
          break;
        }
      }
      return title;
    };

    const filteredData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU ? doc.JAKA_KANCELARIA_TU : null;
      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS = doc.area === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU ? doc.KWOTA_WINDYKOWANA_BECARED : null;


      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        ILE_DNI_NA_PLATNOSC_FV,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.localization,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.area,
        OPIEKUN_OBSZARU_CENTRALI: doc.guardian,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OWNER: doc.owner,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,

      };
    });

    await connect_SQL.query("TRUNCATE TABLE fk_raport");


    // Teraz przygotuj dane do wstawienia
    const values = filteredData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DZIAL ?? null,
      item.ETAP_SPRAWY ?? null,
      item.ILE_DNI_NA_PLATNOSC_FV ?? null,
      item.JAKA_KANCELARIA ?? null,
      item.KONTRAHENT ?? null,
      item.KWOTA_DO_ROZLICZENIA_FK ?? null,
      item.KWOTA_WPS ?? null,
      item.LOKALIZACJA ?? null,
      item.NR_DOKUMENTU ?? null,
      item.NR_KLIENTA ?? null,
      item.OBSZAR ?? null,
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI) ?? null,
      JSON.stringify(item.OPIS_ROZRACHUNKU) ?? null,
      JSON.stringify(item.OWNER) ?? null,
      item.PRZEDZIAL_WIEKOWANIE ?? null,
      item.PRZETER_NIEPRZETER ?? null,
      item.RODZAJ_KONTA ?? null,
      item.ROZNICA ?? null,
      item.TERMIN_PLATNOSCI_FV ?? null,
      item.TYP_DOKUMENTU ?? null,
    ]);



    const query = `
       INSERT IGNORE INTO fk_raport
         (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, ILE_DNI_NA_PLATNOSC_FV, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU) 
       VALUES 
         ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
     `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport'`);

    if (checkRaportDate[0]?.title) {
      await connect_SQL.query(`UPDATE fk_updates_date SET  date = ?, counter = ? WHERE title = ?`,
        [checkDate(new Date()), getData.length || 0, 'raport']
      );
    } else {
      const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
      const params = ["raport", checkDate(new Date()), getData.length || 0];
      await connect_SQL.query(sql, params);
    }

    res.json(filteredData);
    // res.end();
  }
  catch (error) {
    console.error(error);
    logEvents(
      `fkRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }

};

// // zapis ustawień tabeli raportu FK
// const saveTableSettings = async (req, res) => {
//   try {
//     const { tableSettings } = req.body;
//     // await FKRaport.updateOne(
//     //   {},
//     //   { $set: { tableSettings } },
//     //   { new: true, upsert: true }
//     // );

//     res.end();
//   } catch (error) {
//     logEvents(
//       `fkRaportController, saveTableSettings: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// pobieram wcześniejsze ustawienia tabeli FK
// const getTableSettings = async (req, res) => {
//   try {
//     // const result = await FKRaport.aggregate([
//     //   {
//     //     $project: {
//     //       _id: 0, // Wyłączamy pole _id z wyniku
//     //       tableSettings: "$tableSettings", // Wybieramy tylko pole FKData z pola data
//     //     },
//     //   },
//     // ]);
//     // res.json(result[0].tableSettings);
//     res.end();
//   } catch (error) {
//     logEvents(
//       `fkRaportController, getTableSettings: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// funkcja zapisująca kolejnosc kolumn wyświetlanych w tabeli FK i raportach EXCEL
// const getColumnsOrder = async (req, res) => {
//   try {
//     // const resultTableSettings = await FKRaport.aggregate([
//     //   {
//     //     $project: {
//     //       _id: 0, // Wyłączamy pole _id z wyniku
//     //       tableSettings: "$tableSettings", // Wybieramy tylko pole FKData z pola data
//     //     },
//     //   },
//     // ]);

//     // const resultColumnsSettings = await FKRaport.aggregate([
//     //   {
//     //     $project: {
//     //       _id: 0, // Wyłączamy pole _id z wyniku
//     //       tableColumns: "$tableColumns", // Wybieramy tylko pole FKData z pola data
//     //     },
//     //   },
//     // ]);
//     // const tableColumns = [...resultColumnsSettings[0].tableColumns];
//     // const modifiedTableColumns = tableColumns.map(
//     //   ({ accessorKey, header }) => ({ accessorKey, header })
//     // );
//     // const tableOrder = [...resultTableSettings[0].tableSettings.order];

//     // const order = tableOrder.map((item) => {
//     //   const matching = modifiedTableColumns.find(
//     //     (match) => match.accessorKey === item
//     //   );
//     //   if (matching) {
//     //     return matching.header;
//     //   }
//     //   return item;
//     // });

//     // res.json({ order, columns: modifiedTableColumns });
//     res.end();
//   } catch (error) {
//     logEvents(
//       `fkRaportController, getColumnsOrder: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

const getDataItems = async (req, res) => {
  try {
    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });

    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });

    const [aging] = await connect_SQL.query(
      "SELECT firstValue, secondValue, title, type from aging_items"
    );

    res.json({
      data: {
        departments,
        localizations,
        areas,
        owners,
        guardians,
        aging,
      },
    });
  } catch (error) {
    logEvents(`fkRaportController, getDataItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
const getFKSettingsItems = async (req, res) => {
  try {
    const [uniqeDepFromJI] = await connect_SQL.query(
      "SELECT distinct department FROM join_items"
    );

    const uniqueDepartments = uniqeDepFromJI.map((dep) => {
      return dep.department;
    });

    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });

    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });
    res.json({
      uniqueDepartments,
      departments,
      areas,
      localizations,
      owners,
      guardians,
    });
    // res.json({
    //   departments: result[0].data.departments,
    //   areas: result[0].data.areas,
    //   localizations: result[0].data.localizations,
    //   owners: result[0].data.owners,
    //   guardians: result[0].data.guardians,
    // });
  } catch (error) {
    logEvents(
      `fkRaportController, getFKSettingsItems: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funckja zapisujaca działy, ownerów, lokalizacje
const saveItemsData = async (req, res) => {
  const { info } = req.params;
  const { departments, localizations, areas, owners, guardians, aging } =
    req.body;

  // Mapowanie nazw na odpowiadające im klucze
  const dataMap = {
    departments,
    localizations,
    areas,
    owners,
    guardians,
    aging,
  };
  const type = info.slice(0, -1);
  try {
    if (info !== "aging") {
      await connect_SQL.query(`TRUNCATE TABLE ${type}_items`);
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT ${type} FROM ${type}_items WHERE ${type} = ?`,
          [item]
        );
        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            `INSERT IGNORE INTO ${type}_items (${type}) VALUES (?)`,
            [item]
          );
        }
      }
    } else {
      await connect_SQL.query("TRUNCATE TABLE aging_items");
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT title FROM aging_items WHERE title = ?`,
          [item.title]
        );

        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            "INSERT IGNORE INTO aging_items (firstValue, secondValue, title, type ) VALUES (?, ?, ?, ?)",
            [item.firstValue, item.secondValue, item.title, item.type]
          );
        }
      }
      // await FKRaport.updateOne(
      //   {},
      //   { $set: { "items.aging": aging } },
      //   { new: true, upsert: true }
      // );
    }

    res.end();
  } catch (error) {
    logEvents(`fkRaportController, saveItemsData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobierająca kpl owner, dział, lokalizacja dla "Dopasuj dane"
const getPreparedItems = async (req, res) => {
  try {
    // const result = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedItemsData: 1, // Włączamy tylko pole preparedItemsData
    //     },
    //   },
    // ]);

    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );

    // console.log(preparedItems);
    res.json(preparedItems);
    // res.json(result);
  } catch (error) {
    logEvents(`fkRaportController, savePrepareItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
const savePreparedItems = async (req, res) => {
  const { department, localization, area, owner, guardian } = req.body;
  try {
    const [duplicate] = await connect_SQL.query(
      "SELECT department FROM join_items WHERE department = ?",
      [department]
    );
    if (duplicate[0]?.department) {
      await connect_SQL.query(
        "UPDATE join_items SET localization = ?, area = ?, owner = ?, guardian = ? WHERE department = ?",
        [
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
          department,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO join_items (department, localization, area, owner, guardian) VALUES (?, ?, ?, ?, ?)",
        [
          department,
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
        ]
      );
    }
    // await FKRaport.updateOne(
    //   {},
    //   { $set: { preparedItemsData: dataItems } },
    //   { new: true, upsert: true }
    // );
    res.end();
  } catch (error) {
    logEvents(`fkRaportController, savePrepareItems: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera unikalne nazwy działów z pliku księgowego
const getDepfromDocuments = async (req, res) => {
  try {
    const [getDepartments] = await connect_SQL.query(
      "SELECT distinct DZIAL from documents ORDER BY DZIAL"
    );

    const departments = getDepartments.map((dep) => {
      return dep.DZIAL;
    });
    res.json(departments);
  } catch (error) {
    logEvents(
      `fkRaportController, getDepfromAccountancy: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  // documentsFromFile,
  getData,
  // getNewColumns,
  // changeColumns,
  getColumns,
  getDateCounter,
  deleteDataRaport,
  // saveTableSettings,
  // getTableSettings,
  // getColumnsOrder,
  generateRaport,
  getDataItems,
  getFKSettingsItems,
  saveItemsData,
  savePreparedItems,
  getPreparedItems,
  getDepfromDocuments
};
