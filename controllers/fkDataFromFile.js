const { FKRaport } = require("../model/FKRaport");
const UpdateDB = require("../model/UpdateDB");
const Document = require("../model/Document");

// const FKSettlementsTitle = require("../model/FKSettlementsTitle");

const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

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

// Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
const excelDateToISODate = (excelDate) => {
  // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
};

// funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
const isExcelDate = (value) => {
  // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
  if (typeof value === "number" && value > 0) {
    // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
    return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
  }
  return false;
};

// // funkcja wyciągajaca nr działu z nr faktury, np D148, i nadaje TYP_DOKUMENTU np Korekta
// const deprtmentsGenerate = (rows) => {
//   const generate = rows.map((row) => {
//     const indexD = row["Nr. dokumentu"].lastIndexOf("D");
//     let DZIAL_NR = "";
//     if (
//       indexD === -1 ||
//       indexD === row["Nr. dokumentu"].length - 1 ||
//       isNaN(parseInt(row["Nr. dokumentu"][indexD + 1]))
//     ) {
//       DZIAL_NR = "KSIĘGOWOŚĆ";
//     } else {
//       DZIAL_NR = row["Nr. dokumentu"].substring(indexD);
//       if (DZIAL_NR.includes("/")) {
//         // Jeśli tak, to usuwamy znak '/' i wszystko co po nim
//         DZIAL_NR = DZIAL_NR.split("/")[0];
//       }
//     }

//     //zmieniam długość nazwy działu na 4 znakowy, np D8 na D008
//     let newNumber;

//     if (DZIAL_NR && DZIAL_NR.startsWith("D") && DZIAL_NR.length < 4) {
//       let number = DZIAL_NR.substring(1); // Pobieramy cyfry po literze 'D'

//       // Sprawdzamy długość numeru i wstawiamy odpowiednią liczbę zer
//       if (number.length === 1) {
//         newNumber = "00" + number;
//       } else if (number.length === 2) {
//         newNumber = "0" + number;
//       }

//       // Zmieniamy wartość klucza 'DZIAL' na nową wartość z dodanymi zerami
//       if (newNumber) {
//         DZIAL_NR = "D" + newNumber;
//       }
//     }

//     let NR_KLIENTA = 0;
//     if (!isNaN(row["Nr kontrahenta"])) {
//       NR_KLIENTA = Number(row["Nr kontrahenta"]);
//     }
//     let TYP_DOKUMENTU = "";

//     if (row["Nr. dokumentu"].includes("KF/ZAL")) {
//       TYP_DOKUMENTU = "Korekta zaliczki";
//     } else if (row["Nr. dokumentu"].includes("KF/")) {
//       TYP_DOKUMENTU = "Korekta";
//     } else if (row["Nr. dokumentu"].includes("KP/")) {
//       TYP_DOKUMENTU = "KP";
//     } else if (row["Nr. dokumentu"].includes("NO/")) {
//       TYP_DOKUMENTU = "Nota";
//     } else if (row["Nr. dokumentu"].includes("PP/")) {
//       TYP_DOKUMENTU = "Paragon";
//     } else if (row["Nr. dokumentu"].includes("PK")) {
//       TYP_DOKUMENTU = "PK";
//     } else if (row["Nr. dokumentu"].includes("IP/")) {
//       TYP_DOKUMENTU = "Karta Płatnicza";
//     } else if (row["Nr. dokumentu"].includes("FV/ZAL")) {
//       TYP_DOKUMENTU = "Faktura zaliczkowa";
//     } else if (row["Nr. dokumentu"].includes("FV/")) {
//       TYP_DOKUMENTU = "Faktura";
//     } else {
//       TYP_DOKUMENTU = "Inne";
//     }

//     return {
//       NR_DOKUMENTU: row["Nr. dokumentu"],
//       DZIAL: DZIAL_NR,
//       KONTRAHENT: row["Kontrahent"],
//       KWOTA_DO_ROZLICZENIA_FK: Number(row["Płatność"]),
//       TERMIN_PLATNOSCI_FV: excelDateToISODate(row["Data płatn."]),
//       RODZAJ_KONTA: Number(row["Synt."]),
//       TYP_DOKUMENTU: "",
//       NR_KLIENTA: NR_KLIENTA,
//       OPIS_ROZRACHUNKU: [],
//       JAKA_KANCELARIA: "",
//       KWOTA_WPS: 0,
//       DATA_ROZLICZENIA_AS: "",
//       TYP_DOKUMENTU,
//     };
//   });
//   return generate;
// };

// tutaj będzie zapis danych z pliku z księgowości
const accountancyData = async (rows, res) => {
  if (
    !rows[0]["Nr. dokumentu"] &&
    !rows[0]["Kontrahent"] &&
    !rows[0]["Płatność"] &&
    !rows[0]["Data płatn."] &&
    !rows[0]["Nr kontrahenta"] &&
    !rows[0]["Synt."]
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i poiekunów
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedItems = [...resultItems[0].preparedItems];

    // pobieram dane wiekowania
    // const resultAging = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);

    // const preparedAging = [...resultAging[0].aging];

    // jeśli nie będzie możliwe dopasowanie ownerów, lokalizacji to wyskoczy bład we froncie
    let errorDepartments = [];

    const generateDocuments = rows.map((row) => {
      const indexD = row["Nr. dokumentu"].lastIndexOf("D");
      let DZIAL_NR = "";
      if (
        indexD === -1 ||
        indexD === row["Nr. dokumentu"].length - 1 ||
        isNaN(parseInt(row["Nr. dokumentu"][indexD + 1]))
      ) {
        DZIAL_NR = "KSIĘGOWOŚĆ";
      } else {
        DZIAL_NR = row["Nr. dokumentu"].substring(indexD);
        if (DZIAL_NR.includes("/")) {
          // Jeśli tak, to usuwamy znak '/' i wszystko co po nim
          DZIAL_NR = DZIAL_NR.split("/")[0];
        }
      }

      //zmieniam długość nazwy działu na 4 znakowy, np D8 na D008
      let newNumber;

      if (DZIAL_NR && DZIAL_NR.startsWith("D") && DZIAL_NR.length < 4) {
        let number = DZIAL_NR.substring(1); // Pobieramy cyfry po literze 'D'

        // Sprawdzamy długość numeru i wstawiamy odpowiednią liczbę zer
        if (number.length === 1) {
          newNumber = "00" + number;
        } else if (number.length === 2) {
          newNumber = "0" + number;
        }

        // Zmieniamy wartość klucza 'DZIAL' na nową wartość z dodanymi zerami
        if (newNumber) {
          DZIAL_NR = "D" + newNumber;
        }
      }

      let NR_KLIENTA = 0;
      if (!isNaN(row["Nr kontrahenta"])) {
        NR_KLIENTA = Number(row["Nr kontrahenta"]);
      }

      // nadaję typ dokumentu np korekta
      let TYP_DOKUMENTU = "";
      if (row["Nr. dokumentu"].includes("KF/ZAL")) {
        TYP_DOKUMENTU = "Korekta zaliczki";
      } else if (row["Nr. dokumentu"].includes("KF/")) {
        TYP_DOKUMENTU = "Korekta";
      } else if (row["Nr. dokumentu"].includes("KP/")) {
        TYP_DOKUMENTU = "KP";
      } else if (row["Nr. dokumentu"].includes("NO/")) {
        TYP_DOKUMENTU = "Nota";
      } else if (row["Nr. dokumentu"].includes("PP/")) {
        TYP_DOKUMENTU = "Paragon";
      } else if (row["Nr. dokumentu"].includes("PK")) {
        TYP_DOKUMENTU = "PK";
      } else if (row["Nr. dokumentu"].includes("IP/")) {
        TYP_DOKUMENTU = "Karta Płatnicza";
      } else if (row["Nr. dokumentu"].includes("FV/ZAL")) {
        TYP_DOKUMENTU = "Faktura zaliczkowa";
      } else if (row["Nr. dokumentu"].includes("FV/")) {
        TYP_DOKUMENTU = "Faktura";
      } else {
        TYP_DOKUMENTU = "Inne";
      }

      // dopasowanie ownerów, lokalizacji itp
      const matchingDepItem = preparedItems.find(
        (preparedItem) => preparedItem.department === DZIAL_NR
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
        return errorDepartments.push(DZIAL_NR);
      }

      return {
        CZY_SAMOCHOD_WYDANY_AS: "-",
        CZY_W_KANCELARI: "NIE",
        DATA_ROZLICZENIA_AS: "-",
        DATA_WYDANIA_AUTA: "-",
        DATA_WYSTAWIENIA_FV: "2000-01-01",
        DO_ROZLICZENIA_AS: 0,
        DZIAL: DZIAL_NR,
        ETAP_SPRAWY: "BRAK",
        ILE_DNI_NA_PLATNOSC_FV: 0,
        JAKA_KANCELARIA: "-",
        KONTRAHENT: row["Kontrahent"],
        KWOTA_DO_ROZLICZENIA_FK: Number(row["Płatność"]),
        KWOTA_WPS: 0,
        LOKALIZACJA,
        NR_DOKUMENTU: row["Nr. dokumentu"],
        NR_KLIENTA,
        OBSZAR,
        OPIEKUN_OBSZARU_CENTRALI,
        OPIS_ROZRACHUNKU: [],
        OWNER,
        PRZEDZIAL_WIEKOWANIE: "-",
        PRZETER_NIEPRZETER: "NIE",
        RODZAJ_KONTA: Number(row["Synt."]),
        ROZNICA: 0,
        TERMIN_PLATNOSCI_FV: excelDateToISODate(row["Data płatn."]),
        TYP_DOKUMENTU,
      };
    });

    if (errorDepartments.length) {
      return res.json({ data: errorDepartments, error: true });
    }

    await FKRaport.findOneAndUpdate(
      {},
      {
        $set: {
          preparedRaportData: generateDocuments,
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    const dateObj = new Date();
    // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;
    const updateCounter = generateDocuments.length;

    const updateDate = {
      date: actualDate,
      counter: updateCounter,
    };

    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "updateDate.accountancy": updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );

    res.end();

    // const update = rows.map((row) => {
    //   const indexD = row["Nr. dokumentu"].lastIndexOf("D");
    //   let DZIAL_NR = "";
    //   if (
    //     indexD === -1 ||
    //     indexD === row["Nr. dokumentu"].length - 1 ||
    //     isNaN(parseInt(row["Nr. dokumentu"][indexD + 1]))
    //   ) {
    //     DZIAL_NR = "KSIĘGOWOŚĆ";
    //   } else {
    //     DZIAL_NR = row["Nr. dokumentu"].substring(indexD);
    //     if (DZIAL_NR.includes("/")) {
    //       // Jeśli tak, to usuwamy znak '/' i wszystko co po nim
    //       DZIAL_NR = DZIAL_NR.split("/")[0];
    //     }
    //   }
    //   let NR_KLIENTA = 0;
    //   if (!isNaN(row["Nr kontrahenta"])) {
    //     NR_KLIENTA = Number(row["Nr kontrahenta"]);
    //   }
    //   return {
    //     NR_DOKUMENTU: row["Nr. dokumentu"],
    //     DZIAL: DZIAL_NR,
    //     KONTRAHENT: row["Kontrahent"],
    //     KWOTA_DO_ROZLICZENIA_FK: Number(row["Płatność"]),
    //     TERMIN_PLATNOSCI_FV: excelDateToISODate(row["Data płatn."]),
    //     RODZAJ_KONTA: Number(row["Synt."]),
    //     TYP_DOKUMENTU: "",
    //     NR_KLIENTA: NR_KLIENTA,
    //     OPIS_ROZRACHUNKU: [],
    //     JAKA_KANCELARIA: " ",
    //     KWOTA_WPS: 0,
    //     DATA_ROZLICZENIA_AS: "",
    //   };
    // });

    // nadaje nazwę działu na podstawie końcowej nazwy faktury, w przypdaku nietypowych nazw nadaje nazwę KSIĘGOWOŚĆ

    // update.forEach((obiekt) => {
    //   if (
    //     obiekt.DZIAL &&
    //     obiekt.DZIAL.startsWith("D") &&
    //     obiekt.DZIAL.length < 4
    //   ) {
    //     let number = obiekt.DZIAL.substring(1); // Pobieramy cyfry po literze 'D'
    //     let newNumber;

    //     // Sprawdzamy długość numeru i wstawiamy odpowiednią liczbę zer
    //     if (number.length === 1) {
    //       newNumber = "00" + number;
    //     } else if (number.length === 2) {
    //       newNumber = "0" + number;
    //     }

    //     // Zmieniamy wartość klucza 'DZIAL' na nową wartość z dodanymi zerami
    //     if (newNumber) {
    //       obiekt.DZIAL = "D" + newNumber;
    //     }
    //   }
    // });

    // // przypisuje typ dokumentu na podstawie nazwy dokumentu
    // for (const item of update) {
    //   if (item.NR_DOKUMENTU.includes("KF/ZAL")) {
    //     item.TYP_DOKUMENTU = "Korekta zaliczki";
    //   } else if (item.NR_DOKUMENTU.includes("KF/")) {
    //     item.TYP_DOKUMENTU = "Korekta";
    //   } else if (item.NR_DOKUMENTU.includes("KP/")) {
    //     item.TYP_DOKUMENTU = "KP";
    //   } else if (item.NR_DOKUMENTU.includes("NO/")) {
    //     item.TYP_DOKUMENTU = "Nota";
    //   } else if (item.NR_DOKUMENTU.includes("PP/")) {
    //     item.TYP_DOKUMENTU = "Paragon";
    //   } else if (item.NR_DOKUMENTU.includes("PK")) {
    //     item.TYP_DOKUMENTU = "PK";
    //   } else if (item.NR_DOKUMENTU.includes("IP/")) {
    //     item.TYP_DOKUMENTU = "Karta Płatnicza";
    //   } else if (item.NR_DOKUMENTU.includes("FV/ZAL")) {
    //     item.TYP_DOKUMENTU = "Faktura zaliczkowa";
    //   } else if (item.NR_DOKUMENTU.includes("FV/")) {
    //     item.TYP_DOKUMENTU = "Faktura";
    //   } else {
    //     item.TYP_DOKUMENTU = "Inne";
    //   }
    // }
    // // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i poiekunów
    // const resultItems = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);
    // const preparedItems = [...resultItems[0].preparedItems];

    // let errorDepartments = [];
    // // do danych z pliku księgowego przypisuję wcześniej przygotowane dane działów
    // const preparedDataDep = update.map((item) => {
    //   const matchingDepItem = preparedItems.find(
    //     (preparedItem) => preparedItem.department === item.DZIAL
    //   );
    //   if (matchingDepItem) {
    //     const { _id, ...rest } = item;
    //     return {
    //       ...rest,
    //       OWNER: matchingDepItem.owner,
    //       LOKALIZACJA: matchingDepItem.localization,
    //       OBSZAR: matchingDepItem.area,
    //       OPIEKUN_OBSZARU_CENTRALI: matchingDepItem.guardian,
    //     };
    //   } else {
    //     return errorDepartments.push(item.DZIAL);
    //   }
    // });

    // if (errorDepartments.length) {
    //   return res.json({ data: errorDepartments, error: true });
    // }

    // // pobieram dane z rozrachunków
    // const allSettlements = await UpdateDB.find({}, { settlements: 1 });

    // const settlementItems = [...allSettlements[0].settlements];

    // const preparedDataSettlements = preparedDataDep.map((item) => {
    //   const matchingSettlement = settlementItems.find(
    //     (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
    //   );
    //   if (matchingSettlement) {
    //     return {
    //       ...item,
    //       DATA_WYSTAWIENIA_FV: matchingSettlement.DATA_WYSTAWIENIA_FV,
    //       DO_ROZLICZENIA_AS:
    //         item.TYP_DOKUMENTU === "Korekta zaliczki" ||
    //         item.TYP_DOKUMENTU === "Korekta"
    //           ? matchingSettlement.ZOBOWIAZANIA === 0
    //             ? 0
    //             : -matchingSettlement.ZOBOWIAZANIA
    //           : matchingSettlement.DO_ROZLICZENIA,
    //       ROZNICA:
    //         item.TYP_DOKUMENTU === "Korekta zaliczki" ||
    //         item.TYP_DOKUMENTU === "Korekta"
    //           ? -matchingSettlement.ZOBOWIAZANIA - item.KWOTA_DO_ROZLICZENIA_FK
    //           : matchingSettlement.DO_ROZLICZENIA -
    //             item.KWOTA_DO_ROZLICZENIA_FK,
    //     };
    //   } else {
    //     return {
    //       ...item,
    //       DATA_WYSTAWIENIA_FV: "1900-01-01",
    //       DO_ROZLICZENIA_AS: 0,
    //       ROZNICA: item.KWOTA_DO_ROZLICZENIA_FK,
    //       // item.DZIAL !== "KSIĘGOWOŚĆ" ? 0 : item.KWOTA_DO_ROZLICZENIA_FK,
    //     };
    //   }
    // });

    // // console.log(preparedDataSettlements[0]);
    // const resultAging = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);

    // const preparedAging = [...resultAging[0].aging];

    // // dodaję wiekowanie wg wcześniej przygotowanych opcji
    // const preparedDataAging = preparedDataSettlements.map((item) => {
    //   const todayDate = new Date();
    //   const documentDate = new Date(item.DATA_WYSTAWIENIA_FV);
    //   const documentDatePayment = new Date(item.TERMIN_PLATNOSCI_FV);
    //   // Różnica w milisekundach
    //   const differenceInMilliseconds =
    //     todayDate.getTime() - documentDatePayment.getTime();

    //   // Konwersja różnicy na dni
    //   const differenceInDays = (
    //     differenceInMilliseconds /
    //     (1000 * 60 * 60 * 24)
    //   ).toFixed();

    //   const differenceInMillisecondsDocument =
    //     documentDatePayment.getTime() - documentDate.getTime();

    //   const differenceInDaysDocument = Math.floor(
    //     differenceInMillisecondsDocument / (1000 * 60 * 60 * 24)
    //   );

    //   let title = "";

    //   for (const age of preparedAging) {
    //     if (
    //       age.type === "first" &&
    //       Number(age.firstValue) >= differenceInDays
    //     ) {
    //       title = age.title;
    //       foundMatchingAging = true;
    //       break;
    //     } else if (
    //       age.type === "last" &&
    //       Number(age.secondValue) <= differenceInDays
    //     ) {
    //       title = age.title;
    //       foundMatchingAging = true;
    //       break;
    //     } else if (
    //       age.type === "some" &&
    //       Number(age.firstValue) <= differenceInDays &&
    //       Number(age.secondValue) >= differenceInDays
    //     ) {
    //       title = age.title;
    //       foundMatchingAging = true;
    //       break;
    //     }
    //   }

    //   if (!foundMatchingAging) {
    //   }
    //   return {
    //     ...item,
    //     PRZEDZIAL_WIEKOWANIE: title,
    //     PRZETER_NIEPRZETER:
    //       differenceInDays > 0 ? "Przeterminowane" : "Nieprzeterminowane",
    //     ILE_DNI_NA_PLATNOSC_FV: Number(differenceInDaysDocument),
    //   };
    // });

    // await FKRaport.findOneAndUpdate(
    //   {},
    //   {
    //     $set: {
    //       preparedRaportData: preparedDataAging,
    //     },
    //   },
    //   {
    //     returnOriginal: false,
    //     upsert: true,
    //   }
    // );

    // const dateObj = new Date();
    // // Pobieramy poszczególne elementy daty i czasu
    // const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    // const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    // const year = dateObj.getFullYear(); // Rok

    // // Formatujemy datę i czas według wymagań
    // const actualDate = `${day}-${month}-${year}`;
    // const updateCounter = update.length;

    // const updateDate = {
    //   date: actualDate,
    //   counter: updateCounter,
    // };

    // await FKRaport.findOneAndUpdate(
    //   {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
    //   {
    //     $set: {
    //       "updateDate.accountancy": updateDate,
    //     },
    //   }, // Nowe dane, które mają zostać ustawione
    //   {
    //     upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
    //     returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
    //   }
    // );
    // return res.json({ data: preparedDataAging, error: false });
    // return res.json({ data: errorDepartments, error: true });
  } catch (error) {
    logEvents(
      `fkDataFromFile, accountancyData: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// tutaj będzie zapis danych z pliku z auta wydane
const carsReleased = async (rows, res) => {
  if (!rows[0]["NR FAKTURY"] && !rows[0]["WYDANO"]) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    // pobieram wcześniej przygotowane dane z raportData
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];

    //liczba znalezionych rekordów
    let counter = 0;
    const preparedDataReleasedCars = preparedData.map((item) => {
      const matchingItems = rows.find(
        (preparedItem) => preparedItem["NR FAKTURY"] === item.NR_DOKUMENTU
      );
      if (
        matchingItems &&
        (item.OBSZAR === "SAMOCHODY NOWE" ||
          item.OBSZAR === "SAMOCHODY UŻYWANE")
      ) {
        const checkDate = isExcelDate(matchingItems["WYDANO"]);
        counter++;
        return {
          ...item,
          DATA_WYDANIA_AUTA: checkDate
            ? excelDateToISODate(matchingItems["WYDANO"]).toString()
            : "-",
          CZY_SAMOCHOD_WYDANY_AS: matchingItems["WYDANO"] ? "TAK" : "NIE",
        };
      } else if (
        !matchingItems &&
        (item.OBSZAR === "SAMOCHODY NOWE" ||
          item.OBSZAR === "SAMOCHODY UŻYWANE")
      ) {
        return {
          ...item,
          DATA_WYDANIA_AUTA: "-",
          CZY_SAMOCHOD_WYDANY_AS: "NIE",
        };
      } else {
        return {
          ...item,
          DATA_WYDANIA_AUTA: "-",
          CZY_SAMOCHOD_WYDANY_AS: "-",
        };
      }
    });

    // zapis do DB po zmianach
    await FKRaport.findOneAndUpdate(
      {},
      {
        $set: {
          preparedRaportData: preparedDataReleasedCars,
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    // await FKRaport.updateMany(
    //   {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
    //   {
    //     $unset: {
    //       raportData: 1,
    //     },
    //   }, // Nowe dane, które mają zostać usunięte
    //   {
    //     upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
    //   }
    // );

    const dateObj = new Date();
    // // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter,
    };
    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "updateDate.carReleased": updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );
    // return res.json(preparedDataReleasedCars);
    return res.end();
  } catch (error) {
    logEvents(`fkDataFromFile, carsReleased: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// tutaj będzie zapis danych z pliku rubicon i z bazy raportu BLEU :)
const caseStatus = async (rows, res) => {
  if (
    !rows[0]["Faktura nr"] &&
    !rows[0]["Status aktualny"] &&
    !rows[0]["Firma zewnętrzna"] &&
    !rows[0]["Data faktury"]
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    // pobieram wcześniej przygotowane dane z raportData
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];

    //licznik ile spraw zostało przypisanych do raportu
    let counter = 0;

    const preparedCaseStatus = preparedData.map((item) => {
      const matchingSettlemnt = rows.find(
        (preparedItem) => preparedItem["Faktura nr"] === item.NR_DOKUMENTU
      );

      if (matchingSettlemnt && item.OBSZAR !== "BLACHARNIA") {
        counter++;

        const status =
          matchingSettlemnt["Status aktualny"] !== "Brak działań" &&
          matchingSettlemnt["Status aktualny"] !== "Rozliczona" &&
          matchingSettlemnt["Status aktualny"] !== "sms/mail +3" &&
          matchingSettlemnt["Status aktualny"] !== "sms/mail -2" &&
          matchingSettlemnt["Status aktualny"] !== "Zablokowana" &&
          matchingSettlemnt["Status aktualny"] !== "Zablokowana BL" &&
          matchingSettlemnt["Status aktualny"] !== "Zablokowana KF" &&
          matchingSettlemnt["Status aktualny"] !== "Zablokowana KF BL"
            ? matchingSettlemnt["Status aktualny"]
            : "BRAK";

        return {
          ...item,
          ETAP_SPRAWY: status,
          KWOTA_WPS:
            item.DO_ROZLICZENIA_AS &&
            status !== "BRAK" &&
            item.DO_ROZLICZENIA_AS
              ? Number(item.DO_ROZLICZENIA_AS)
              : 0,
          JAKA_KANCELARIA:
            status !== "BRAK" ? matchingSettlemnt["Firma zewnętrzna"] : "-",
          CZY_W_KANCELARI: status !== "BRAK" ? "TAK" : "NIE",
          DATA_WYSTAWIENIA_FV: matchingSettlemnt["Data faktury"]
            ? matchingSettlemnt["Data faktury"]
            : "2000-01-01",
          // DATA_WYSTAWIENIA_FV:
          //   item.DATA_WYSTAWIENIA_FV === "1900-01-01"
          //     ? matchingSettlemnt["Data faktury"]
          //     : item.DATA_WYSTAWIENIA_FV,
        };
      } else return item;
    });

    // pobieran dane z BLEU żeby sprawdzić kancelarie, WPS itp dla działów blacharni
    const resultDocuments = await Document.find({});

    const preparedCaseStatusBL = preparedCaseStatus.map((item) => {
      const matchingSettlemnt = resultDocuments.find(
        (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
      );
      if (matchingSettlemnt && item.OBSZAR === "BLACHARNIA") {
        return {
          ...item,
          ETAP_SPRAWY: matchingSettlemnt.STATUS_SPRAWY_KANCELARIA
            ? matchingSettlemnt.STATUS_SPRAWY_KANCELARIA
            : "BRAK",
          JAKA_KANCELARIA:
            matchingSettlemnt.JAKA_KANCELARIA !== "BRAK"
              ? matchingSettlemnt.JAKA_KANCELARIA
              : "-",
          CZY_W_KANCELARI:
            matchingSettlemnt.JAKA_KANCELARIA !== "BRAK" ? "TAK" : "NIE",
          KWOTA_WPS:
            matchingSettlemnt.KWOTA_WINDYKOWANA_BECARED &&
            matchingSettlemnt.JAKA_KANCELARIA !== "BRAK"
              ? Number(matchingSettlemnt.KWOTA_WINDYKOWANA_BECARED)
              : 0,
          DATA_WYSTAWIENIA_FV: matchingSettlemnt.DATA_FV
            ? matchingSettlemnt.DATA_FV
            : "2000-01-01",
        };
      } else {
        return item;
      }
    });

    // zapis do DB po zmianach
    await FKRaport.findOneAndUpdate(
      {},
      {
        $set: {
          preparedRaportData: preparedCaseStatusBL,
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    const dateObj = new Date();
    // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter,
    };
    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "updateDate.caseStatus": updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );
    res.end();

    // console.log(resultDocuments[0]);

    // const preparedCaseStatus = preparedData.map((item) => {
    //   const matchingSettlemnt = rows.find(
    //     (preparedItem) => preparedItem["Faktura nr"] === item.NR_DOKUMENTU
    //   );

    //   if (matchingSettlemnt && item.OBSZAR !== "BLACHARNIA") {
    //     counter++;

    //     const status =
    //       matchingSettlemnt["Status aktualny"] !== "Brak działań" &&
    //       matchingSettlemnt["Status aktualny"] !== "Rozliczona" &&
    //       matchingSettlemnt["Status aktualny"] !== "sms/mail +3" &&
    //       matchingSettlemnt["Status aktualny"] !== "sms/mail -2" &&
    //       matchingSettlemnt["Status aktualny"] !== "Zablokowana" &&
    //       matchingSettlemnt["Status aktualny"] !== "Zablokowana BL" &&
    //       matchingSettlemnt["Status aktualny"] !== "Zablokowana KF" &&
    //       matchingSettlemnt["Status aktualny"] !== "Zablokowana KF BL"
    //         ? matchingSettlemnt["Status aktualny"]
    //         : "BRAK";

    //     return {
    //       ...item,
    //       ETAP_SPRAWY: status,
    //       KWOTA_WPS:
    //         item.DO_ROZLICZENIA_AS && status !== "BRAK"
    //           ? item.DO_ROZLICZENIA_AS
    //           : 0,
    //       JAKA_KANCELARIA:
    //         status !== "BRAK" ? matchingSettlemnt["Firma zewnętrzna"] : " ",
    //       CZY_W_KANCELARI: status !== "BRAK" ? "TAK" : "NIE",
    //       DATA_WYSTAWIENIA_FV: matchingSettlemnt["Data faktury"]
    //         ? matchingSettlemnt["Data faktury"]
    //         : "",
    //       // DATA_WYSTAWIENIA_FV:
    //       //   item.DATA_WYSTAWIENIA_FV === "1900-01-01"
    //       //     ? matchingSettlemnt["Data faktury"]
    //       //     : item.DATA_WYSTAWIENIA_FV,
    //     };
    //   } else if (matchingSettlemnt && item.OBSZAR === "BLACHARNIA") {
    //     return {
    //       ...item,
    //       ETAP_SPRAWY: "",
    //       KWOTA_WPS: item.DO_ROZLICZENIA_AS ? item.DO_ROZLICZENIA_AS : 0,
    //       JAKA_KANCELARIA: " ",
    //       CZY_W_KANCELARI: "NIE",
    //       DATA_WYSTAWIENIA_FV:
    //         item.DATA_WYSTAWIENIA_FV === "1900-01-01"
    //           ? matchingSettlemnt["Data faktury"]
    //           : item.DATA_WYSTAWIENIA_FV,
    //     };
    //   } else {
    //     return {
    //       ...item,
    //       ETAP_SPRAWY: "",
    //       KWOTA_WPS: 0,
    //       JAKA_KANCELARIA: " ",
    //       CZY_W_KANCELARI: "NIE",
    //     };
    //   }
    // });

    // console.log(preparedCaseStatus);

    // pobieran dane z BLEU żeby sprawdzić kancelarie, WPS itp dla działów blacharni
    // const resultDocuments = await Document.find({});

    // const preparedCaseStatusBL = preparedCaseStatus.map((item) => {
    //   const matchingSettlemnt = resultDocuments.find(
    //     (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
    //   );
    //   if (matchingSettlemnt && item.OBSZAR === "BLACHARNIA") {
    //     counter++;
    //     return {
    //       ...item,
    //       ETAP_SPRAWY: matchingSettlemnt.STATUS_SPRAWY_KANCELARIA
    //         ? matchingSettlemnt.STATUS_SPRAWY_KANCELARIA
    //         : "BRAK",
    //       JAKA_KANCELARIA:
    //         matchingSettlemnt.JAKA_KANCELARIA !== "BRAK"
    //           ? matchingSettlemnt.JAKA_KANCELARIA
    //             ? matchingSettlemnt.JAKA_KANCELARIA
    //             : " "
    //           : " ",
    //       CZY_W_KANCELARI:
    //         matchingSettlemnt.JAKA_KANCELARIA !== "BRAK" ? "TAK" : "NIE",
    //       KWOTA_WPS: matchingSettlemnt.KWOTA_WINDYKOWANA_BECARED
    //         ? matchingSettlemnt.KWOTA_WINDYKOWANA_BECARED
    //         : 0,
    //     };
    //   } else {
    //     return item;
    //   }
    // });

    // // zapis do DB po zmianach
    // await FKRaport.findOneAndUpdate(
    //   {},
    //   {
    //     $set: {
    //       preparedRaportData: preparedCaseStatusBL,
    //     },
    //   },
    //   {
    //     returnOriginal: false,
    //     upsert: true,
    //   }
    // );

    // const dateObj = new Date();
    // // Pobieramy poszczególne elementy daty i czasu
    // const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    // const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    // const year = dateObj.getFullYear(); // Rok

    // // Formatujemy datę i czas według wymagań
    // const actualDate = `${day}-${month}-${year}`;

    // const updateDate = {
    //   date: actualDate,
    //   counter,
    // };
    // await FKRaport.findOneAndUpdate(
    //   {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
    //   {
    //     $set: {
    //       "updateDate.caseStatus": updateDate,
    //     },
    //   }, // Nowe dane, które mają zostać ustawione
    //   {
    //     upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
    //     returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
    //   }
    // );

    // res.json(preparedCaseStatusBL);
    // res.end();
  } catch (error) {
    logEvents(`fkDataFromFile, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const settlementNames = async (rows, res) => {
  if (!rows[0]["NUMER"] && !rows[0]["OPIS"] && !rows[0]["DataRozlAutostacja"]) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    // pobieram wcześniej przygotowane dane z raportData
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];

    let counter = 0;

    // const preparedSettlementName = preparedData.map((item) => {
    //   let dateAndName = [];
    //   let dateSettlement = "";
    //   rows.forEach((preparedItem) => {
    //     if (
    //       preparedItem.NUMER === item.NR_DOKUMENTU &&
    //       preparedItem.OPIS !== "NULL"
    //     ) {
    //       const checkDate = isExcelDate(preparedItem.DataRozlAutostacja);
    //       const date =
    //         preparedItem.DataRozlAutostacja === "NULL"
    //           ? "BRAK"
    //           : checkDate
    //           ? excelDateToISODate(preparedItem.DataRozlAutostacja)
    //           : "BRAK";

    //       if (date !== "BRAK" && /\d{4}-\d{2}-\d{2}/.test(date)) {
    //         // Jeśli dateSettlement jest puste lub data jest większa niż dateSettlement
    //         if (
    //           dateSettlement === "" ||
    //           new Date(date) > new Date(dateSettlement)
    //         ) {
    //           dateSettlement = date; // Aktualizacja dateSettlement
    //         }
    //       }

    //       const name =
    //         preparedItem.OPIS === "NULL" ? "BRAK" : preparedItem.OPIS;

    //       dateAndName.push(`${date} - ${name}`); // Dodajemy do tablicy dateAndName
    //     }
    //   });
    //   if (dateAndName.length > 0) {
    //     counter++;
    //     // Jeśli tablica nie jest pusta, przypisujemy ją do OPIS_ROZRACHUNKU
    //     return {
    //       ...item,
    //       OPIS_ROZRACHUNKU: item.ROZNICA !== 0 ? dateAndName : "NULL",
    //       DATA_ROZLICZENIA_AS: item.ROZNICA !== 0 ? dateSettlement : "",
    //     };
    //   } else {
    //     // Jeśli tablica jest pusta, przypisujemy pustą tablicę do OPIS_ROZRACHUNKU
    //     return {
    //       ...item,
    //       OPIS_ROZRACHUNKU: "NULL",
    //     };
    //   }
    // });

    //ta działa
    const preparedSettlementName = preparedData.map((item) => {
      let dateAndName = [];
      let dateSettlement = "";
      rows = rows.filter((preparedItem) => {
        // Użycie metody filter()
        if (
          preparedItem.NUMER === item.NR_DOKUMENTU &&
          preparedItem.OPIS !== "NULL"
        ) {
          const checkDate = isExcelDate(preparedItem.DataRozlAutostacja);
          const date =
            preparedItem.DataRozlAutostacja === "NULL"
              ? "BRAK"
              : checkDate
              ? excelDateToISODate(preparedItem.DataRozlAutostacja)
              : "BRAK";

          if (date !== "BRAK" && /\d{4}-\d{2}-\d{2}/.test(date)) {
            // Jeśli dateSettlement jest puste lub data jest większa niż dateSettlement
            if (
              dateSettlement === "" ||
              new Date(date) > new Date(dateSettlement)
            ) {
              dateSettlement = date; // Aktualizacja dateSettlement
            }
          }

          const name =
            preparedItem.OPIS === "NULL" ? "BRAK" : preparedItem.OPIS;

          dateAndName.push(`${date} - ${name}`); // Dodajemy do tablicy dateAndName
          return false; // Usunięcie obiektu preparedItem z tablicy rows
        }
        return true; // Zachowaj obiekt preparedItem w tablicy rows
      });

      if (dateAndName.length > 0) {
        // console.log(dateAndName);
        // console.log(item.NR_DOKUMENTU);
        counter++;
        // Jeśli tablica nie jest pusta, przypisujemy ją do OPIS_ROZRACHUNKU
        return {
          ...item,
          OPIS_ROZRACHUNKU: dateAndName,
          DATA_ROZLICZENIA_AS: dateSettlement ? dateSettlement : "-",
          // OPIS_ROZRACHUNKU: item.ROZNICA !== 0 ? dateAndName : "NULL",
          // DATA_ROZLICZENIA_AS: item.ROZNICA !== 0 ? dateSettlement : "-",
        };
      } else {
        // Jeśli tablica jest pusta, przypisujemy pustą tablicę do OPIS_ROZRACHUNKU
        return {
          ...item,
          OPIS_ROZRACHUNKU: ["NULL"],
        };
      }
    });

    // const test = preparedSettlementName.map((item) => {
    //   if (item.NR_DOKUMENTU === "FV/UB/21/24/X/D79") {
    //     console.log(item);
    //   }
    // });

    await FKRaport.findOneAndUpdate(
      {},
      {
        $set: {
          preparedRaportData: preparedSettlementName,
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    const dateObj = new Date();
    // // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter,
    };
    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "updateDate.settlementNames": updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );
    // res.json(preparedSettlementName);
    res.end();
  } catch (error) {
    logEvents(
      `fkDataFromFile, settlementNames: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const addDataFromFile = async (req, res) => {
  const { type } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: "Not delivered file" });
  }
  try {
    const buffer = req.file.buffer;
    const data = new Uint8Array(buffer);

    if (!isExcelFile(data)) {
      return res.status(500).json({ error: "Invalid file" });
    }
    const workbook = read(buffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

    if (type === "accountancy") {
      await accountancyData(rows, res);
    }

    if (type === "car") {
      await carsReleased(rows, res);
    }

    if (type === "rubicon") {
      await caseStatus(rows, res);
    }

    if (type === "settlement") {
      await settlementNames(rows, res);
    }
  } catch (error) {
    logEvents(
      `fkDataFromFile, addDataFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  addDataFromFile,
};
