const Document = require("../model/Document");
const User = require("../model/User");
const UpdateDB = require("../model/UpdateDB");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

//pobiera faktury wg upranień uzytkownika z uwględnienień actual/archive/all
const getDataDocuments = async (_id, info) => {
  let filteredData = [];
  try {
    const findUser = await connect_SQL.query(
      "SELECT  permissions, username, usersurname, departments FROM users WHERE _id = ?",
      [_id]
    );
    // console.log(findUser[0][0]);
    // const userlogin = "jerzy.komorowski@krotoski.com";
    // const findUser = await User.find({ userlogin });
    // const { permissions, username, usersurname, departments } = findUser[0];
    const { permissions, username, usersurname, departments } = findUser[0][0];

    const truePermissions = Object.keys(permissions).filter(
      (permission) => permissions[permission]
    );
    const trueDepartments = Object.keys(departments).filter(
      (department) => departments[department]
    );

    // const trueDepartments = Array.from(departments.entries())
    //   .filter(([department, value]) => value)
    //   .map(([department]) => department);

    const DORADCA = `${usersurname} ${username}`;
    // lean oczyszcza dane mongo
    const result = await Document.find({}).lean();
    // const result = await Document.find({});
    if (info === "actual") {
      filteredData = result.filter((item) => item.DO_ROZLICZENIA !== 0);
    } else if (info === "archive") {
      filteredData = result.filter((item) => item.DO_ROZLICZENIA === 0);
    } else if (info === "all") {
      filteredData = result;
    }

    const newKeys = filteredData.map((item) => {
      const date = new Date();
      const lastDate = new Date(item.TERMIN);
      const timeDifference = date - lastDate;
      const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
      const ILE_DNI_PO_TERMINIE = daysDifference;
      let CZY_PRZETERMINOWANE = "";
      if (daysDifference > 0) {
        CZY_PRZETERMINOWANE = "P";
      } else {
        CZY_PRZETERMINOWANE = "N";
      }
      const fullVAT = (item.BRUTTO - item.NETTO).toFixed(2);
      const halfVAT = ((item.BRUTTO - item.NETTO) / 2).toFixed(2);

      return {
        ...item,
        ILE_DNI_PO_TERMINIE: ILE_DNI_PO_TERMINIE,
        CZY_PRZETERMINOWANE: CZY_PRZETERMINOWANE,
        "100_VAT": Number(fullVAT),
        "50_VAT": Number(halfVAT),
      };
    });

    let dataToExport = [];
    if (truePermissions[0] === "Basic") {
      dataToExport = newKeys.filter((item) => item.DORADCA === DORADCA);
    } else if (truePermissions[0] === "Standard") {
      dataToExport = newKeys.filter((item) =>
        trueDepartments.includes(item.DZIAL)
      );
    }

    return { data: dataToExport, permission: truePermissions[0] };
  } catch (error) {
    logEvents(
      `documentsController, getDataDocuments: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
    // res.status(500).json({ error: "Server error" });
  }
};

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getAllDocuments = async (req, res) => {
  const { info, _id } = req.params;
  try {
    const result = await getDataDocuments(_id, info);

    res.json(result.data);
  } catch (error) {
    logEvents(
      `documentsController, getAllDocuments: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
    res.status(500).json({ error: "Server error" });
  }
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

// funkcja która dodaje dane z becared
const becaredFile = async (rows, res) => {
  if (
    !("Numery Faktur" in rows[0]) ||
    !("Etap Sprawy" in rows[0]) ||
    !("Ostatni komentarz" in rows[0]) ||
    !("Data ostatniego komentarza" in rows[0]) ||
    !("Numer sprawy" in rows[0]) ||
    !("Suma roszczeń" in rows[0])
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }

  try {
    const allDocuments = await Document.find({});

    for (const doc of allDocuments) {
      const found = rows.find((row) => row["Numery Faktur"] === doc.NUMER_FV);

      if (found) {
        const checkDate = isExcelDate(found["Data ostatniego komentarza"]);
        try {
          await Document.updateOne(
            { NUMER_FV: doc.NUMER_FV },
            {
              $set: {
                STATUS_SPRAWY_KANCELARIA: found["Etap Sprawy"]
                  ? found["Etap Sprawy"]
                  : "-",
                KOMENTARZ_KANCELARIA_BECARED: found["Ostatni komentarz"]
                  ? found["Ostatni komentarz"]
                  : "-",
                DATA_KOMENTARZA_BECARED: checkDate
                  ? excelDateToISODate(
                      found["Data ostatniego komentarza"]
                    ).toString()
                  : "-",
                NUMER_SPRAWY_BECARED: found["Numer sprawy"]
                  ? found["Numer sprawy"]
                  : "-",
                KWOTA_WINDYKOWANA_BECARED: found["Suma roszczeń"],
              },
            }
          );
        } catch (error) {
          console.error("Error while updating the document", error);
        }
      }
    }

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    logEvents(
      `documentsController, becaredFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja która dodaje dane z z pliku dokumenty autostacja
const ASFile = async (documents, res) => {
  if (
    !("NUMER" in documents[0]) ||
    !("WYSTAWIONO" in documents[0]) ||
    !("W. BRUTTO" in documents[0]) ||
    !("W. NETTO" in documents[0]) ||
    !("NR REJESTRACYJNY" in documents[0]) ||
    !("KONTRAHENT" in documents[0]) ||
    !("PRZYGOTOWAŁ" in documents[0]) ||
    !("NR SZKODY" in documents[0]) ||
    !("UWAGI" in documents[0])
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    const allDocuments = await Document.find({});
    const allSettlements = await UpdateDB.find({}, { settlements: 1 });
    const settlements = allSettlements[0].settlements;

    const dzialMap = {
      D8: "D08",
      D38: "D38",
      D48: "D48/D58",
      D58: "D48/D58",
      D68: "D68/D78",
      D78: "D68/D78",
      D88: "D88",
      D98: "D98",
      D118: "D118/D148",
      D148: "D118/D148",
      D168: "D118/D148",
      D308: "D308/D318",
      D318: "D308/D318",
    };

    const checkDocuments = documents.map((document) => {
      const indexD = document.NUMER.lastIndexOf("D");
      const DZIAL_NR = document.NUMER.substring(indexD);

      const DZIAL = dzialMap[DZIAL_NR] || "BRAK";

      return {
        ...document,
        DZIAL: DZIAL,
      };
    });

    // const checkDocuments = documents.map((document) => {
    //   const indexD = document.NUMER.lastIndexOf("D");
    //   const DZIAL_NR = document.NUMER.substring(indexD);

    //   let DZIAL = "";

    //   if (DZIAL_NR === "D8") {
    //     DZIAL = "D08";
    //   } else if (DZIAL_NR === "D38") {
    //     DZIAL = "D38";
    //   } else if (DZIAL_NR === "D48" || DZIAL_NR === "D58") {
    //     DZIAL = "D48/D58";
    //   } else if (DZIAL_NR === "D68" || DZIAL_NR === "D78") {
    //     DZIAL = "D68/D78";
    //   } else if (DZIAL_NR === "D88") {
    //     DZIAL = "D88";
    //   } else if (DZIAL_NR === "D98") {
    //     DZIAL = "D98";
    //   } else if (
    //     DZIAL_NR === "D118" ||
    //     DZIAL_NR === "D148" ||
    //     DZIAL_NR === "D168"
    //   ) {
    //     DZIAL = "D118/D148";
    //   } else if (DZIAL_NR === "D308" || DZIAL_NR === "D318") {
    //     DZIAL = "D308/D318";
    //   } else {
    //     DZIAL = "BRAK";
    //   }
    //   return {
    //     ...document,
    //     DZIAL: DZIAL,
    //   };
    // });

    // const filteredDocumentsBL = checkDocuments.filter(
    //   (item) => item.DZIAL !== "BRAK"
    // );

    // szukam brakujących faktur w bazie danych i uswam te które mają DZIAL=BRAK
    const filteredDocuments = [];
    for (const document of checkDocuments) {
      const found = allDocuments.find((doc) => doc.NUMER_FV === document.NUMER);

      if (!found && document.DZIAL !== "BRAK") {
        filteredDocuments.push(document);
      }
    }

    // ta funkcja usuwa faktury których nie ma w bazie danych bo sa rozliczone, zmienić po otrzymaniu docelowego pliku, obecnie będzie trudno ze względu na brak informacji o terminie płatności
    const newDocumentsToDB = [];
    for (const document of filteredDocuments) {
      const found = settlements.find(
        (settlement) => settlement.NUMER_FV === document.NUMER
      );
      if (found) {
        const newDocument = {
          NUMER_FV: document["NUMER"],
          DZIAL: document.DZIAL,
          DATA_FV: document["WYSTAWIONO"]
            ? excelDateToISODate(document["WYSTAWIONO"]).toString()
            : "",
          TERMIN: found["TERMIN"] ? found["TERMIN"] : "",
          BRUTTO: document["W. BRUTTO"].toFixed(2),
          BRUTTO: document["W. BRUTTO"].toFixed(2),
          NETTO: document["W. NETTO"].toFixed(2),
          DO_ROZLICZENIA: found["DO_ROZLICZENIA"].toFixed(2),
          // "100_VAT": document["W. BRUTTO"] - document["W. NETTO"],
          // "50_VAT": (document["W. BRUTTO"] - document["W. NETTO"]) / 2,
          NR_REJESTRACYJNY: document["NR REJESTRACYJNY"]
            ? document["NR REJESTRACYJNY"]
            : "",
          KONTRAHENT: document["KONTRAHENT"] ? document["KONTRAHENT"] : "",
          // ASYSTENTKA,
          DORADCA: document["PRZYGOTOWAŁ"] ? document["PRZYGOTOWAŁ"] : "",
          NR_SZKODY: document["NR SZKODY"] ? document["NR SZKODY"] : "",
          UWAGI_ASYSTENT: [],
          UWAGI_Z_FAKTURY: document["UWAGI"] ? document["UWAGI"] : "",
          STATUS_SPRAWY_WINDYKACJA: "",
          DZIALANIA: "BRAK",
          JAKA_KANCELARIA: "BRAK",
          STATUS_SPRAWY_KANCELARIA: "",
          KOMENTARZ_KANCELARIA_BECARED: "",
          DATA_KOMENTARZA_BECARED: "",
          NUMER_SPRAWY_BECARED: "",
          KWOTA_WINDYKOWANA_BECARED: "",
          BLAD_DORADCY: "NIE",
          // BLAD_W_DOKUMENTACJI: "NIE",
          POBRANO_VAT: "Nie dotyczy",
          ZAZNACZ_KONTRAHENTA: "Nie",
          CZY_PRZETERMINOWANE: "",
        };
        newDocumentsToDB.push(newDocument);
      }
    }

    await Document.insertMany(newDocumentsToDB);

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    logEvents(`documentsController, ASFile: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};
// const ASFile = async (documents, res) => {
//   if (
//     !("NUMER" in documents[0]) ||
//     !("WYSTAWIONO" in documents[0]) ||
//     !("W. BRUTTO" in documents[0]) ||
//     !("W. NETTO" in documents[0]) ||
//     !("NR REJESTRACYJNY" in documents[0]) ||
//     !("KONTRAHENT" in documents[0]) ||
//     !("PRZYGOTOWAŁ" in documents[0]) ||
//     !("NR SZKODY" in documents[0]) ||
//     !("UWAGI" in documents[0])
//   ) {
//     return res.status(500).json({ error: "Invalid file" });
//   }

//   try {
//     const allDocuments = await Document.find({});
//     const allSettlements = await UpdateDB.find({}, { settlements: 1 });
//     const settlements = allSettlements[0].settlements;

//     let DZIAL = "";
//     let ASYSTENTKA = "";
//     // szukam brakujących faktur w bazie danych
//     const filteredDocuments = [];
//     for (const document of documents) {
//       const found = allDocuments.find((doc) => doc.NUMER_FV === document.NUMER);

//       if (!found) {
//         const indexD = document.NUMER.lastIndexOf("D");
//         const DZIAL_NR = document.NUMER.substring(indexD);

//         if (DZIAL_NR === "D8") {
//           DZIAL = "D08";
//         }
//         if (DZIAL_NR === "D38") {
//           DZIAL = "D38";
//         }
//         if (DZIAL_NR === "D48" || DZIAL_NR === "D58") {
//           DZIAL = "D48/D58";
//         }
//         if (DZIAL_NR === "D68" || DZIAL_NR === "D78") {
//           DZIAL = "D68/D78";
//         }
//         if (DZIAL_NR === "D88") {
//           DZIAL = "D88";
//         }
//         if (DZIAL_NR === "D98") {
//           DZIAL = "D98";
//         }
//         if (DZIAL_NR === "D118" || DZIAL_NR === "D148" || DZIAL_NR === "D168") {
//           DZIAL = "D118/D148";
//         }
//         if (DZIAL_NR === "D308" || DZIAL_NR === "D318") {
//           DZIAL = "D308/D318";
//         }

//         filteredDocuments.push(document);
//       }
//     }

//     // ta funkcja usuwa faktury których nie ma w bazie danych bo sa rozliczone, zmienić po otrzymaniu docelowego pliku, obecnie będzie trudno ze względu na brak informacji o terminie płatności
//     const newDocumentsToDB = [];
//     for (const document of filteredDocuments) {
//       const found = settlements.find(
//         (settlement) => settlement.NUMER_FV === document.NUMER
//       );
//       if (found) {
//         const newDocument = {
//           NUMER_FV: document["NUMER"],
//           DZIAL,
//           DATA_FV: document["WYSTAWIONO"]
//             ? excelDateToISODate(document["WYSTAWIONO"]).toString()
//             : "",
//           TERMIN: found["TERMIN"] ? found["TERMIN"] : "",
//           BRUTTO: document["W. BRUTTO"].toFixed(2),
//           BRUTTO: document["W. BRUTTO"].toFixed(2),
//           NETTO: document["W. NETTO"].toFixed(2),
//           DO_ROZLICZENIA: found["DO_ROZLICZENIA"].toFixed(2),
//           // "100_VAT": document["W. BRUTTO"] - document["W. NETTO"],
//           // "50_VAT": (document["W. BRUTTO"] - document["W. NETTO"]) / 2,
//           NR_REJESTRACYJNY: document["NR REJESTRACYJNY"]
//             ? document["NR REJESTRACYJNY"]
//             : "",
//           KONTRAHENT: document["KONTRAHENT"] ? document["KONTRAHENT"] : "",
//           // ASYSTENTKA,
//           DORADCA: document["PRZYGOTOWAŁ"] ? document["PRZYGOTOWAŁ"] : "",
//           NR_SZKODY: document["NR SZKODY"] ? document["NR SZKODY"] : "",
//           UWAGI_ASYSTENT: [],
//           UWAGI_Z_FAKTURY: document["UWAGI"] ? document["UWAGI"] : "",
//           STATUS_SPRAWY_WINDYKACJA: "",
//           DZIALANIA: "BRAK",
//           JAKA_KANCELARIA: "BRAK",
//           STATUS_SPRAWY_KANCELARIA: "",
//           KOMENTARZ_KANCELARIA_BECARED: "",
//           DATA_KOMENTARZA_BECARED: "",
//           NUMER_SPRAWY_BECARED: "",
//           KWOTA_WINDYKOWANA_BECARED: "",
//           BLAD_DORADCY: "NIE",
//           // BLAD_W_DOKUMENTACJI: "NIE",
//           POBRANO_VAT: "Nie dotyczy",
//           ZAZNACZ_KONTRAHENTA: "Nie",
//           CZY_PRZETERMINOWANE: "",
//         };
//         newDocumentsToDB.push(newDocument);
//       }
//     }
//     await Document.insertMany(newDocumentsToDB);

//     res.status(201).json({ message: "Documents are updated" });
//   } catch (error) {
//     logEvents(`documentsController, ASFile: ${error}`, "reqServerErrors.txt");
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// funkcja która dodaje dane z Rozrachunków do bazy danych i nanosi nowe należności na wszytskie faktury w DB
const settlementsFile = async (rows, res) => {
  if (
    !("TYTUŁ" in rows[0]) ||
    !("TERMIN" in rows[0]) ||
    !("NALEŻNOŚĆ" in rows[0]) ||
    !("WPROWADZONO" in rows[0]) ||
    !("ZOBOWIĄZANIE" in rows[0])
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }

  const cleanDocument = rows.map((row) => {
    const cleanDoc = row["TYTUŁ"].split(" ")[0];
    let termin_fv = "";
    let data_fv = "";
    if (
      row["TERMIN"] &&
      isExcelDate(row["TERMIN"]) &&
      row["WPROWADZONO"] &&
      isExcelDate(row["WPROWADZONO"])
    ) {
      termin_fv = excelDateToISODate(row["TERMIN"]).toString();
      data_fv = excelDateToISODate(row["WPROWADZONO"]).toString();
    } else {
      termin_fv = row["TERMIN"] ? row["TERMIN"] : "";
      data_fv = row["WPROWADZONO"] ? row["WPROWADZONO"] : "";
    }

    // Zabezpieczenie: Sprawdzenie, czy wartość "NALEŻNOŚĆ" może być przekonwertowana na liczbę
    // Jeśli nie, zastąpienie ją zerem, w przeciwnym razie, użycie metody toFixed(2)
    const do_rozliczenia = row["NALEŻNOŚĆ"]
      ? isNaN(parseFloat(row["NALEŻNOŚĆ"]))
        ? 0
        : parseFloat(row["NALEŻNOŚĆ"]).toFixed(2)
      : 0;

    // Analogicznie dla "ZOBOWIĄZANIE"
    const zobowiazania =
      row["ZOBOWIĄZANIE"] && row["ZOBOWIĄZANIE"] !== 0
        ? isNaN(parseFloat(row["ZOBOWIĄZANIE"]))
          ? 0
          : parseFloat(row["ZOBOWIĄZANIE"]).toFixed(2)
        : 0;

    return {
      NUMER_FV: cleanDoc,
      TERMIN: termin_fv,
      DATA_WYSTAWIENIA_FV: data_fv,
      DO_ROZLICZENIA: do_rozliczenia,
      ZOBOWIAZANIA: zobowiazania,
    };
  });

  const actualDate = new Date();

  let noDoubleDocuments = [];

  cleanDocument.forEach((doc) => {
    // Zabezpieczenie: Sprawdzenie, czy wartość "DO_ROZLICZENIA" może być przekonwertowana na liczbę
    const do_rozliczenia = isNaN(parseFloat(doc.DO_ROZLICZENIA))
      ? 0
      : parseFloat(doc.DO_ROZLICZENIA);

    let existingDocIndex = noDoubleDocuments.findIndex(
      (tempDoc) => tempDoc.NUMER_FV === doc.NUMER_FV
    );
    if (existingDocIndex === -1) {
      // Jeśli nie istnieje, dodaj nowy obiekt
      noDoubleDocuments.push({ ...doc, DO_ROZLICZENIA: do_rozliczenia });
    } else {
      // Jeśli istnieje, sprawdź, czy data DATA_WYSTAWIENIA_FV nowego dokumentu jest mniejsza
      const existingDocDate = new Date(
        noDoubleDocuments[existingDocIndex].DATA_WYSTAWIENIA_FV
      );
      const newDocDate = new Date(doc.DATA_WYSTAWIENIA_FV);

      if (newDocDate < existingDocDate) {
        noDoubleDocuments[existingDocIndex].DATA_WYSTAWIENIA_FV =
          doc.DATA_WYSTAWIENIA_FV;
      }

      // Zaktualizuj wartość DO_ROZLICZENIA
      noDoubleDocuments[existingDocIndex].DO_ROZLICZENIA += do_rozliczenia;
    }
  });

  try {
    const allDocuments = await Document.find({});

    // sprawdzenie czy w rozrachunkach znajduje się faktura z DB
    for (const doc of allDocuments) {
      const found = noDoubleDocuments.find(
        (double) => double.NUMER_FV === doc.NUMER_FV
      );

      if (found) {
        try {
          // Próba przekonwertowania found.DO_ROZLICZENIA na liczbę, jeśli niepowodzenie, wartość zostanie zastąpiona zerem
          const newValue = parseFloat(found.DO_ROZLICZENIA) || 0;
          await Document.updateOne(
            { NUMER_FV: doc.NUMER_FV },
            { $set: { DO_ROZLICZENIA: newValue } }
          );
        } catch (error) {
          console.error("Error while updating the document", error);
        }
      } else {
        try {
          await Document.updateOne(
            { NUMER_FV: doc.NUMER_FV },
            { $set: { DO_ROZLICZENIA: 0 } }
          );
        } catch (error) {
          console.error("Error while updating the document", error);
        }
      }
    }

    await UpdateDB.updateOne(
      {},
      { $set: { date: actualDate, settlements: noDoubleDocuments } },
      { upsert: true }
    );

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    logEvents(
      `documentsController, settlementsFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//chwilowa funckja do naprawienia danych w DB
const repairFile = async (rows, res) => {
  const allUsers = await User.find({});

  try {
    // Modyfikowanie każdego użytkownika
    for (const user of allUsers) {
      if (user.roles) {
        user.roles.Start = 1;
      }
      // Zapisanie zmienionego użytkownika do bazy danych
      // await user.save();
    }
    // const result = await Document.updateOne(
    //   { NUMER_FV: doc.NUMER_FV },
    //   {
    //     $set: {
    //       NUMER_SPRAWY_BECARED: doc.NUMER_SPRAWY_BECARED
    //         ? doc.NUMER_SPRAWY_BECARED
    //         : "-",
    //     },
    //   }
    // );
    // const result = await Document.deleteOne(
    //     { NUMER_FV: doc.NUMER_FV },
    // );
  } catch (error) {
    logEvents(
      `documentsController, repairFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error("Error while updating the document", error);
  }

  res.end();
};

// dodawnie danych do bazy z pliku excel
const documentsFromFile = async (req, res) => {
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

    if (type === "becared") {
      return becaredFile(rows, res);
    } else if (type === "AS") {
      return ASFile(rows, res);
    } else if (type === "settlements") {
      return settlementsFile(rows, res);
    } else if (type === "test") {
      return repairFile(rows, res);
    }
  } catch (error) {
    logEvents(
      `documentsController, documentsFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera wszystkie klucze z pierwszego documentu żeby mozna było nazwy, filtry i ustawienia kolumn edytować, głównie chodzi o nowo dodane kolumny
const getColumns = async (req, res) => {
  try {
    const firstDocument = await Document.findOne();
    if (firstDocument) {
      // Pobierz klucze z pierwszego dokumentu i umieść je w tablicy
      const keysArray = Object.keys(firstDocument.toObject());
      const newArray = keysArray.filter(
        (item) => item !== "_id" && item !== "__v"
      );
      res.json(newArray);
    } else {
      return res.status(400).json({ error: "Empty collection." });
    }
  } catch (error) {
    logEvents(
      `documentsController, getColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// zmienia tylko pojedyńczy dokument, w tabeli BL po edycji wiersza
const changeSingleDocument = async (req, res) => {
  const { _id, documentItem } = req.body;
  try {
    // const fieldToUpdate = Object.keys(documentItem)[0]; // Pobierz nazwę pola do aktualizacji
    // const updatedFieldValue = documentItem[fieldToUpdate];
    const result = await Document.updateOne({ _id }, documentItem);
    res.end();
  } catch (error) {
    logEvents(
      `documentsController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobieram dane do tabeli, ustawienia tabeli(order, visiblility itd), kolumny
const getDataTable = async (req, res) => {
  const { _id, info } = req.params;
  if (!_id || !info) {
    return res.status(400).json({ message: "Id and info are required." });
  }
  try {
    // console.log(_id, info);

    const result = await getDataDocuments(_id, info);

    const findUser = await connect_SQL.query(
      "SELECT  tableSettings, columns  FROM users WHERE _id = ?",
      [_id]
    );

    const tableSettings = findUser[0][0].tableSettings
      ? findUser[0][0].tableSettings
      : {};
    const columns = findUser[0][0].columns ? findUser[0][0].columns : [];

    res.json({ dataTable: result.data, tableSettings, columns });
  } catch (error) {
    logEvents(
      `documentsController, getDataTable: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera pojedyńczy dokument
const getSingleDocument = async (req, res) => {
  const { _id } = req.params;
  try {
    const result = await Document.findOne({ _id });
    res.json(result);
  } catch (error) {
    logEvents(
      `documentsController, getSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getAllDocuments,
  documentsFromFile,
  getColumns,
  changeSingleDocument,
  getDataTable,
  getDataDocuments,
  getSingleDocument,
};
// const Document = require("../model/Document");
// const User = require("../model/User");
// const UpdateDB = require("../model/UpdateDB");
// const { read, utils } = require("xlsx");
// const { logEvents } = require("../middleware/logEvents");
// const { connect_SQL } = require("../config/dbConn");

// //pobiera faktury wg upranień uzytkownika z uwględnienień actual/archive/all
// const getDataDocuments = async (_id, info) => {
//   let filteredData = [];
//   try {
//     const findUser = await connect_SQL.query(
//       "SELECT  * FROM users WHERE _id = ?",
//       [_id]
//     );
//     // const findUser = await User.find({ _id });
//     const { permissions, username, usersurname, departments } = findUser[0][0];

//     const truePermissions = Object.keys(permissions).filter(
//       (permission) => permissions[permission]
//     );
//     const trueDepartments = Array.from(departments.entries())
//       .filter(([department, value]) => value)
//       .map(([department]) => department);

//     const DORADCA = `${usersurname} ${username}`;

//     // lean oczyszcza dane mongo
//     const result = await Document.find({}).lean();
//     // const result = await Document.find({});
//     if (info === "actual") {
//       filteredData = result.filter((item) => item.DO_ROZLICZENIA !== 0);
//     } else if (info === "archive") {
//       filteredData = result.filter((item) => item.DO_ROZLICZENIA === 0);
//     } else if (info === "all") {
//       filteredData = result;
//     }

//     const newKeys = filteredData.map((item) => {
//       const date = new Date();
//       const lastDate = new Date(item.TERMIN);
//       const timeDifference = date - lastDate;
//       const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
//       const ILE_DNI_PO_TERMINIE = daysDifference;
//       let CZY_PRZETERMINOWANE = "";
//       if (daysDifference > 0) {
//         CZY_PRZETERMINOWANE = "P";
//       } else {
//         CZY_PRZETERMINOWANE = "N";
//       }
//       const fullVAT = (item.BRUTTO - item.NETTO).toFixed(2);
//       const halfVAT = ((item.BRUTTO - item.NETTO) / 2).toFixed(2);

//       return {
//         ...item,
//         ILE_DNI_PO_TERMINIE: ILE_DNI_PO_TERMINIE,
//         CZY_PRZETERMINOWANE: CZY_PRZETERMINOWANE,
//         "100_VAT": Number(fullVAT),
//         "50_VAT": Number(halfVAT),
//       };
//     });

//     let dataToExport = [];
//     if (truePermissions[0] === "Basic") {
//       dataToExport = newKeys.filter((item) => item.DORADCA === DORADCA);
//     } else if (truePermissions[0] === "Standard") {
//       dataToExport = newKeys.filter((item) =>
//         trueDepartments.includes(item.DZIAL)
//       );
//     }
//     console.log(dataToExport, truePermissions[0]);
//     return { data: dataToExport, permission: truePermissions[0] };
//   } catch (error) {
//     logEvents(
//       `documentsController, getDataDocuments: ${error}`,
//       "reqServerErrors.txt"
//     );
//     // console.error(error);
//     // res.status(500).json({ error: "Server error" });
//   }
// };

// // pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
// const getAllDocuments = async (req, res) => {
//   const { info, _id } = req.params;
//   console.log(info, _id);
//   try {
//     const result = await getDataDocuments(_id, info);

//     res.json(result.data);
//   } catch (error) {
//     logEvents(
//       `documentsController, getAllDocuments: ${error}`,
//       "reqServerErrors.txt"
//     );
//     // console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
// const excelDateToISODate = (excelDate) => {
//   // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
//   const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
//   return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
// };

// // funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
// const isExcelDate = (value) => {
//   // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
//   if (typeof value === "number" && value > 0) {
//     // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
//     return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
//   }

//   return false;
// };

// // weryfikacja czy plik excel jest prawidłowy (czy nie jest podmienione rozszerzenie)
// const isExcelFile = (data) => {
//   const excelSignature = [0x50, 0x4b, 0x03, 0x04];
//   for (let i = 0; i < excelSignature.length; i++) {
//     if (data[i] !== excelSignature[i]) {
//       return false;
//     }
//   }
//   return true;
// };

// // funkcja która dodaje dane z becared
// const becaredFile = async (rows, res) => {
//   if (
//     !("Numery Faktur" in rows[0]) ||
//     !("Etap Sprawy" in rows[0]) ||
//     !("Ostatni komentarz" in rows[0]) ||
//     !("Data ostatniego komentarza" in rows[0]) ||
//     !("Numer sprawy" in rows[0]) ||
//     !("Suma roszczeń" in rows[0])
//   ) {
//     return res.status(500).json({ error: "Invalid file" });
//   }

//   try {
//     const allDocuments = await Document.find({});

//     for (const doc of allDocuments) {
//       const found = rows.find((row) => row["Numery Faktur"] === doc.NUMER_FV);

//       if (found) {
//         const checkDate = isExcelDate(found["Data ostatniego komentarza"]);
//         try {
//           await Document.updateOne(
//             { NUMER_FV: doc.NUMER_FV },
//             {
//               $set: {
//                 STATUS_SPRAWY_KANCELARIA: found["Etap Sprawy"]
//                   ? found["Etap Sprawy"]
//                   : "-",
//                 KOMENTARZ_KANCELARIA_BECARED: found["Ostatni komentarz"]
//                   ? found["Ostatni komentarz"]
//                   : "-",
//                 DATA_KOMENTARZA_BECARED: checkDate
//                   ? excelDateToISODate(
//                       found["Data ostatniego komentarza"]
//                     ).toString()
//                   : "-",
//                 NUMER_SPRAWY_BECARED: found["Numer sprawy"]
//                   ? found["Numer sprawy"]
//                   : "-",
//                 KWOTA_WINDYKOWANA_BECARED: found["Suma roszczeń"],
//               },
//             }
//           );
//         } catch (error) {
//           console.error("Error while updating the document", error);
//         }
//       }
//     }

//     res.status(201).json({ message: "Documents are updated" });
//   } catch (error) {
//     logEvents(
//       `documentsController, becaredFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // funkcja która dodaje dane z z pliku dokumenty autostacja
// const ASFile = async (documents, res) => {
//   if (
//     !("NUMER" in documents[0]) ||
//     !("WYSTAWIONO" in documents[0]) ||
//     !("W. BRUTTO" in documents[0]) ||
//     !("W. NETTO" in documents[0]) ||
//     !("NR REJESTRACYJNY" in documents[0]) ||
//     !("KONTRAHENT" in documents[0]) ||
//     !("PRZYGOTOWAŁ" in documents[0]) ||
//     !("NR SZKODY" in documents[0]) ||
//     !("UWAGI" in documents[0])
//   ) {
//     return res.status(500).json({ error: "Invalid file" });
//   }
//   try {
//     const allDocuments = await Document.find({});
//     const allSettlements = await UpdateDB.find({}, { settlements: 1 });
//     const settlements = allSettlements[0].settlements;

//     const dzialMap = {
//       D8: "D08",
//       D38: "D38",
//       D48: "D48/D58",
//       D58: "D48/D58",
//       D68: "D68/D78",
//       D78: "D68/D78",
//       D88: "D88",
//       D98: "D98",
//       D118: "D118/D148",
//       D148: "D118/D148",
//       D168: "D118/D148",
//       D308: "D308/D318",
//       D318: "D308/D318",
//     };

//     const checkDocuments = documents.map((document) => {
//       const indexD = document.NUMER.lastIndexOf("D");
//       const DZIAL_NR = document.NUMER.substring(indexD);

//       const DZIAL = dzialMap[DZIAL_NR] || "BRAK";

//       return {
//         ...document,
//         DZIAL: DZIAL,
//       };
//     });

//     // const checkDocuments = documents.map((document) => {
//     //   const indexD = document.NUMER.lastIndexOf("D");
//     //   const DZIAL_NR = document.NUMER.substring(indexD);

//     //   let DZIAL = "";

//     //   if (DZIAL_NR === "D8") {
//     //     DZIAL = "D08";
//     //   } else if (DZIAL_NR === "D38") {
//     //     DZIAL = "D38";
//     //   } else if (DZIAL_NR === "D48" || DZIAL_NR === "D58") {
//     //     DZIAL = "D48/D58";
//     //   } else if (DZIAL_NR === "D68" || DZIAL_NR === "D78") {
//     //     DZIAL = "D68/D78";
//     //   } else if (DZIAL_NR === "D88") {
//     //     DZIAL = "D88";
//     //   } else if (DZIAL_NR === "D98") {
//     //     DZIAL = "D98";
//     //   } else if (
//     //     DZIAL_NR === "D118" ||
//     //     DZIAL_NR === "D148" ||
//     //     DZIAL_NR === "D168"
//     //   ) {
//     //     DZIAL = "D118/D148";
//     //   } else if (DZIAL_NR === "D308" || DZIAL_NR === "D318") {
//     //     DZIAL = "D308/D318";
//     //   } else {
//     //     DZIAL = "BRAK";
//     //   }
//     //   return {
//     //     ...document,
//     //     DZIAL: DZIAL,
//     //   };
//     // });

//     // const filteredDocumentsBL = checkDocuments.filter(
//     //   (item) => item.DZIAL !== "BRAK"
//     // );

//     // szukam brakujących faktur w bazie danych i uswam te które mają DZIAL=BRAK
//     const filteredDocuments = [];
//     for (const document of checkDocuments) {
//       const found = allDocuments.find((doc) => doc.NUMER_FV === document.NUMER);

//       if (!found && document.DZIAL !== "BRAK") {
//         filteredDocuments.push(document);
//       }
//     }

//     // ta funkcja usuwa faktury których nie ma w bazie danych bo sa rozliczone, zmienić po otrzymaniu docelowego pliku, obecnie będzie trudno ze względu na brak informacji o terminie płatności
//     const newDocumentsToDB = [];
//     for (const document of filteredDocuments) {
//       const found = settlements.find(
//         (settlement) => settlement.NUMER_FV === document.NUMER
//       );
//       if (found) {
//         const newDocument = {
//           NUMER_FV: document["NUMER"],
//           DZIAL: document.DZIAL,
//           DATA_FV: document["WYSTAWIONO"]
//             ? excelDateToISODate(document["WYSTAWIONO"]).toString()
//             : "",
//           TERMIN: found["TERMIN"] ? found["TERMIN"] : "",
//           BRUTTO: document["W. BRUTTO"].toFixed(2),
//           BRUTTO: document["W. BRUTTO"].toFixed(2),
//           NETTO: document["W. NETTO"].toFixed(2),
//           DO_ROZLICZENIA: found["DO_ROZLICZENIA"].toFixed(2),
//           // "100_VAT": document["W. BRUTTO"] - document["W. NETTO"],
//           // "50_VAT": (document["W. BRUTTO"] - document["W. NETTO"]) / 2,
//           NR_REJESTRACYJNY: document["NR REJESTRACYJNY"]
//             ? document["NR REJESTRACYJNY"]
//             : "",
//           KONTRAHENT: document["KONTRAHENT"] ? document["KONTRAHENT"] : "",
//           // ASYSTENTKA,
//           DORADCA: document["PRZYGOTOWAŁ"] ? document["PRZYGOTOWAŁ"] : "",
//           NR_SZKODY: document["NR SZKODY"] ? document["NR SZKODY"] : "",
//           UWAGI_ASYSTENT: [],
//           UWAGI_Z_FAKTURY: document["UWAGI"] ? document["UWAGI"] : "",
//           STATUS_SPRAWY_WINDYKACJA: "",
//           DZIALANIA: "BRAK",
//           JAKA_KANCELARIA: "BRAK",
//           STATUS_SPRAWY_KANCELARIA: "",
//           KOMENTARZ_KANCELARIA_BECARED: "",
//           DATA_KOMENTARZA_BECARED: "",
//           NUMER_SPRAWY_BECARED: "",
//           KWOTA_WINDYKOWANA_BECARED: "",
//           BLAD_DORADCY: "NIE",
//           // BLAD_W_DOKUMENTACJI: "NIE",
//           POBRANO_VAT: "Nie dotyczy",
//           ZAZNACZ_KONTRAHENTA: "Nie",
//           CZY_PRZETERMINOWANE: "",
//         };
//         newDocumentsToDB.push(newDocument);
//       }
//     }

//     await Document.insertMany(newDocumentsToDB);

//     res.status(201).json({ message: "Documents are updated" });
//   } catch (error) {
//     logEvents(`documentsController, ASFile: ${error}`, "reqServerErrors.txt");
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };
// // const ASFile = async (documents, res) => {
// //   if (
// //     !("NUMER" in documents[0]) ||
// //     !("WYSTAWIONO" in documents[0]) ||
// //     !("W. BRUTTO" in documents[0]) ||
// //     !("W. NETTO" in documents[0]) ||
// //     !("NR REJESTRACYJNY" in documents[0]) ||
// //     !("KONTRAHENT" in documents[0]) ||
// //     !("PRZYGOTOWAŁ" in documents[0]) ||
// //     !("NR SZKODY" in documents[0]) ||
// //     !("UWAGI" in documents[0])
// //   ) {
// //     return res.status(500).json({ error: "Invalid file" });
// //   }

// //   try {
// //     const allDocuments = await Document.find({});
// //     const allSettlements = await UpdateDB.find({}, { settlements: 1 });
// //     const settlements = allSettlements[0].settlements;

// //     let DZIAL = "";
// //     let ASYSTENTKA = "";
// //     // szukam brakujących faktur w bazie danych
// //     const filteredDocuments = [];
// //     for (const document of documents) {
// //       const found = allDocuments.find((doc) => doc.NUMER_FV === document.NUMER);

// //       if (!found) {
// //         const indexD = document.NUMER.lastIndexOf("D");
// //         const DZIAL_NR = document.NUMER.substring(indexD);

// //         if (DZIAL_NR === "D8") {
// //           DZIAL = "D08";
// //         }
// //         if (DZIAL_NR === "D38") {
// //           DZIAL = "D38";
// //         }
// //         if (DZIAL_NR === "D48" || DZIAL_NR === "D58") {
// //           DZIAL = "D48/D58";
// //         }
// //         if (DZIAL_NR === "D68" || DZIAL_NR === "D78") {
// //           DZIAL = "D68/D78";
// //         }
// //         if (DZIAL_NR === "D88") {
// //           DZIAL = "D88";
// //         }
// //         if (DZIAL_NR === "D98") {
// //           DZIAL = "D98";
// //         }
// //         if (DZIAL_NR === "D118" || DZIAL_NR === "D148" || DZIAL_NR === "D168") {
// //           DZIAL = "D118/D148";
// //         }
// //         if (DZIAL_NR === "D308" || DZIAL_NR === "D318") {
// //           DZIAL = "D308/D318";
// //         }

// //         filteredDocuments.push(document);
// //       }
// //     }

// //     // ta funkcja usuwa faktury których nie ma w bazie danych bo sa rozliczone, zmienić po otrzymaniu docelowego pliku, obecnie będzie trudno ze względu na brak informacji o terminie płatności
// //     const newDocumentsToDB = [];
// //     for (const document of filteredDocuments) {
// //       const found = settlements.find(
// //         (settlement) => settlement.NUMER_FV === document.NUMER
// //       );
// //       if (found) {
// //         const newDocument = {
// //           NUMER_FV: document["NUMER"],
// //           DZIAL,
// //           DATA_FV: document["WYSTAWIONO"]
// //             ? excelDateToISODate(document["WYSTAWIONO"]).toString()
// //             : "",
// //           TERMIN: found["TERMIN"] ? found["TERMIN"] : "",
// //           BRUTTO: document["W. BRUTTO"].toFixed(2),
// //           BRUTTO: document["W. BRUTTO"].toFixed(2),
// //           NETTO: document["W. NETTO"].toFixed(2),
// //           DO_ROZLICZENIA: found["DO_ROZLICZENIA"].toFixed(2),
// //           // "100_VAT": document["W. BRUTTO"] - document["W. NETTO"],
// //           // "50_VAT": (document["W. BRUTTO"] - document["W. NETTO"]) / 2,
// //           NR_REJESTRACYJNY: document["NR REJESTRACYJNY"]
// //             ? document["NR REJESTRACYJNY"]
// //             : "",
// //           KONTRAHENT: document["KONTRAHENT"] ? document["KONTRAHENT"] : "",
// //           // ASYSTENTKA,
// //           DORADCA: document["PRZYGOTOWAŁ"] ? document["PRZYGOTOWAŁ"] : "",
// //           NR_SZKODY: document["NR SZKODY"] ? document["NR SZKODY"] : "",
// //           UWAGI_ASYSTENT: [],
// //           UWAGI_Z_FAKTURY: document["UWAGI"] ? document["UWAGI"] : "",
// //           STATUS_SPRAWY_WINDYKACJA: "",
// //           DZIALANIA: "BRAK",
// //           JAKA_KANCELARIA: "BRAK",
// //           STATUS_SPRAWY_KANCELARIA: "",
// //           KOMENTARZ_KANCELARIA_BECARED: "",
// //           DATA_KOMENTARZA_BECARED: "",
// //           NUMER_SPRAWY_BECARED: "",
// //           KWOTA_WINDYKOWANA_BECARED: "",
// //           BLAD_DORADCY: "NIE",
// //           // BLAD_W_DOKUMENTACJI: "NIE",
// //           POBRANO_VAT: "Nie dotyczy",
// //           ZAZNACZ_KONTRAHENTA: "Nie",
// //           CZY_PRZETERMINOWANE: "",
// //         };
// //         newDocumentsToDB.push(newDocument);
// //       }
// //     }
// //     await Document.insertMany(newDocumentsToDB);

// //     res.status(201).json({ message: "Documents are updated" });
// //   } catch (error) {
// //     logEvents(`documentsController, ASFile: ${error}`, "reqServerErrors.txt");
// //     console.error(error);
// //     res.status(500).json({ error: "Server error" });
// //   }
// // };

// // funkcja która dodaje dane z Rozrachunków do bazy danych i nanosi nowe należności na wszytskie faktury w DB
// const settlementsFile = async (rows, res) => {
//   if (
//     !("TYTUŁ" in rows[0]) ||
//     !("TERMIN" in rows[0]) ||
//     !("NALEŻNOŚĆ" in rows[0]) ||
//     !("WPROWADZONO" in rows[0]) ||
//     !("ZOBOWIĄZANIE" in rows[0])
//   ) {
//     return res.status(500).json({ error: "Invalid file" });
//   }

//   const cleanDocument = rows.map((row) => {
//     const cleanDoc = row["TYTUŁ"].split(" ")[0];
//     let termin_fv = "";
//     let data_fv = "";
//     if (
//       row["TERMIN"] &&
//       isExcelDate(row["TERMIN"]) &&
//       row["WPROWADZONO"] &&
//       isExcelDate(row["WPROWADZONO"])
//     ) {
//       termin_fv = excelDateToISODate(row["TERMIN"]).toString();
//       data_fv = excelDateToISODate(row["WPROWADZONO"]).toString();
//     } else {
//       termin_fv = row["TERMIN"] ? row["TERMIN"] : "";
//       data_fv = row["WPROWADZONO"] ? row["WPROWADZONO"] : "";
//     }

//     // Zabezpieczenie: Sprawdzenie, czy wartość "NALEŻNOŚĆ" może być przekonwertowana na liczbę
//     // Jeśli nie, zastąpienie ją zerem, w przeciwnym razie, użycie metody toFixed(2)
//     const do_rozliczenia = row["NALEŻNOŚĆ"]
//       ? isNaN(parseFloat(row["NALEŻNOŚĆ"]))
//         ? 0
//         : parseFloat(row["NALEŻNOŚĆ"]).toFixed(2)
//       : 0;

//     // Analogicznie dla "ZOBOWIĄZANIE"
//     const zobowiazania =
//       row["ZOBOWIĄZANIE"] && row["ZOBOWIĄZANIE"] !== 0
//         ? isNaN(parseFloat(row["ZOBOWIĄZANIE"]))
//           ? 0
//           : parseFloat(row["ZOBOWIĄZANIE"]).toFixed(2)
//         : 0;

//     return {
//       NUMER_FV: cleanDoc,
//       TERMIN: termin_fv,
//       DATA_WYSTAWIENIA_FV: data_fv,
//       DO_ROZLICZENIA: do_rozliczenia,
//       ZOBOWIAZANIA: zobowiazania,
//     };
//   });

//   const actualDate = new Date();

//   let noDoubleDocuments = [];

//   cleanDocument.forEach((doc) => {
//     // Zabezpieczenie: Sprawdzenie, czy wartość "DO_ROZLICZENIA" może być przekonwertowana na liczbę
//     const do_rozliczenia = isNaN(parseFloat(doc.DO_ROZLICZENIA))
//       ? 0
//       : parseFloat(doc.DO_ROZLICZENIA);

//     let existingDocIndex = noDoubleDocuments.findIndex(
//       (tempDoc) => tempDoc.NUMER_FV === doc.NUMER_FV
//     );
//     if (existingDocIndex === -1) {
//       // Jeśli nie istnieje, dodaj nowy obiekt
//       noDoubleDocuments.push({ ...doc, DO_ROZLICZENIA: do_rozliczenia });
//     } else {
//       // Jeśli istnieje, sprawdź, czy data DATA_WYSTAWIENIA_FV nowego dokumentu jest mniejsza
//       const existingDocDate = new Date(
//         noDoubleDocuments[existingDocIndex].DATA_WYSTAWIENIA_FV
//       );
//       const newDocDate = new Date(doc.DATA_WYSTAWIENIA_FV);

//       if (newDocDate < existingDocDate) {
//         noDoubleDocuments[existingDocIndex].DATA_WYSTAWIENIA_FV =
//           doc.DATA_WYSTAWIENIA_FV;
//       }

//       // Zaktualizuj wartość DO_ROZLICZENIA
//       noDoubleDocuments[existingDocIndex].DO_ROZLICZENIA += do_rozliczenia;
//     }
//   });

//   try {
//     const allDocuments = await Document.find({});

//     // sprawdzenie czy w rozrachunkach znajduje się faktura z DB
//     for (const doc of allDocuments) {
//       const found = noDoubleDocuments.find(
//         (double) => double.NUMER_FV === doc.NUMER_FV
//       );

//       if (found) {
//         try {
//           // Próba przekonwertowania found.DO_ROZLICZENIA na liczbę, jeśli niepowodzenie, wartość zostanie zastąpiona zerem
//           const newValue = parseFloat(found.DO_ROZLICZENIA) || 0;
//           await Document.updateOne(
//             { NUMER_FV: doc.NUMER_FV },
//             { $set: { DO_ROZLICZENIA: newValue } }
//           );
//         } catch (error) {
//           console.error("Error while updating the document", error);
//         }
//       } else {
//         try {
//           await Document.updateOne(
//             { NUMER_FV: doc.NUMER_FV },
//             { $set: { DO_ROZLICZENIA: 0 } }
//           );
//         } catch (error) {
//           console.error("Error while updating the document", error);
//         }
//       }
//     }

//     await UpdateDB.updateOne(
//       {},
//       { $set: { date: actualDate, settlements: noDoubleDocuments } },
//       { upsert: true }
//     );

//     res.status(201).json({ message: "Documents are updated" });
//   } catch (error) {
//     logEvents(
//       `documentsController, settlementsFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// //chwilowa funckja do naprawienia danych w DB
// const repairFile = async (rows, res) => {
//   const allUsers = await User.find({});

//   try {
//     // Modyfikowanie każdego użytkownika
//     for (const user of allUsers) {
//       if (user.roles) {
//         user.roles.Start = 1;
//       }
//       // Zapisanie zmienionego użytkownika do bazy danych
//       // await user.save();
//     }
//     // const result = await Document.updateOne(
//     //   { NUMER_FV: doc.NUMER_FV },
//     //   {
//     //     $set: {
//     //       NUMER_SPRAWY_BECARED: doc.NUMER_SPRAWY_BECARED
//     //         ? doc.NUMER_SPRAWY_BECARED
//     //         : "-",
//     //     },
//     //   }
//     // );
//     // const result = await Document.deleteOne(
//     //     { NUMER_FV: doc.NUMER_FV },
//     // );
//   } catch (error) {
//     logEvents(
//       `documentsController, repairFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error("Error while updating the document", error);
//   }

//   res.end();
// };

// // dodawnie danych do bazy z pliku excel
// const documentsFromFile = async (req, res) => {
//   const { type } = req.params;
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

//     if (type === "becared") {
//       return becaredFile(rows, res);
//     } else if (type === "AS") {
//       return ASFile(rows, res);
//     } else if (type === "settlements") {
//       return settlementsFile(rows, res);
//     } else if (type === "test") {
//       return repairFile(rows, res);
//     }
//   } catch (error) {
//     logEvents(
//       `documentsController, documentsFromFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // pobiera wszystkie klucze z pierwszego documentu żeby mozna było nazwy, filtry i ustawienia kolumn edytować, głównie chodzi o nowo dodane kolumny
// const getColumns = async (req, res) => {
//   try {
//     const firstDocument = await Document.findOne();
//     if (firstDocument) {
//       // Pobierz klucze z pierwszego dokumentu i umieść je w tablicy
//       const keysArray = Object.keys(firstDocument.toObject());
//       const newArray = keysArray.filter(
//         (item) => item !== "_id" && item !== "__v"
//       );
//       res.json(newArray);
//     } else {
//       return res.status(400).json({ error: "Empty collection." });
//     }
//   } catch (error) {
//     logEvents(
//       `documentsController, getColumns: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // zmienia tylko pojedyńczy dokument, w tabeli BL po edycji wiersza
// const changeSingleDocument = async (req, res) => {
//   const { _id, documentItem } = req.body;
//   try {
//     // const fieldToUpdate = Object.keys(documentItem)[0]; // Pobierz nazwę pola do aktualizacji
//     // const updatedFieldValue = documentItem[fieldToUpdate];
//     const result = await Document.updateOne({ _id }, documentItem);
//     res.end();
//   } catch (error) {
//     logEvents(
//       `documentsController, changeSingleDocument: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // pobieram dane do tabeli, ustawienia tabeli(order, visiblility itd), kolumny
// const getDataTable = async (req, res) => {
//   const { _id, info } = req.params;
//   if (!_id || !info) {
//     return res.status(400).json({ message: "Id and info are required." });
//   }
//   try {
//     const result = await getDataDocuments(_id, info);

//     let tableSettings = {};
//     let columns = [];
//     const findUser = await User.findOne({ _id }).exec();
//     if (findUser) {
//       tableSettings = findUser.tableSettings;
//       columns = findUser.columns;
//     } else {
//       return res.status(404).json({ message: "User not found." });
//     }

//     res.json({ dataTable: result.data, tableSettings, columns });
//   } catch (error) {
//     logEvents(
//       `documentsController, getDataTable: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// // pobiera pojedyńczy dokument
// const getSingleDocument = async (req, res) => {
//   const { _id } = req.params;
//   try {
//     const result = await Document.findOne({ _id });
//     res.json(result);
//   } catch (error) {
//     logEvents(
//       `documentsController, getSingleDocument: ${error}`,
//       "reqServerErrors.txt"
//     );
//     console.error(error);
//     res.status(500).json({ error: "Server error" });
//   }
// };

// module.exports = {
//   getAllDocuments,
//   documentsFromFile,
//   getColumns,
//   changeSingleDocument,
//   getDataTable,
//   getDataDocuments,
//   getSingleDocument,
// };
