// const Document = require("../model/Document");
// const User = require("../model/User");
// const UpdateDB = require("../model/UpdateDB");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");

//pobiera faktury wg upranień uzytkownika z uwględnienień actual/archive/all SQL
const getDataDocuments = async (id_user, info) => {
  let filteredData = [];
  try {
    const [findUser] = await connect_SQL.query(
      "SELECT  permissions, username, usersurname, departments FROM users WHERE id_user = ?",
      [id_user]
    );
    const { permissions, username, usersurname, departments } = findUser[0];

    const truePermissions = Object.keys(permissions).filter(
      (permission) => permissions[permission]
    );
    const trueDepartments = Object.keys(departments).filter(
      (department) => departments[department]
    );

    const DORADCA = `${usersurname} ${username}`;

    if (info === "actual") {
      // [filteredData] = await connect_SQL.query(
      //   "SELECT documents.*, documents_actions.*,   datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id  WHERE DO_ROZLICZENIA <> 0"
      // );
      [filteredData] = await connect_SQL.query(
        "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, DS.OPIS_ROZRACHUNKU, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM documents AS D LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN settlements_description AS DS ON D.NUMER_FV = DS.NUMER LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV WHERE IFNULL(S.NALEZNOSC, 0) <> 0"
      );

      // [filteredData] = await connect_SQL.query(
      //   "SELECT documents.*, documents_actions.*, DS.OPIS_ROZRACHUNKU,  datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id LEFT JOIN settlements_description AS DS ON documents.NUMER_FV = DS.NUMER WHERE DO_ROZLICZENIA <> 0"
      // );
    } else if (info === "archive") {
      // [filteredData] = await connect_SQL.query(
      //   "SELECT documents.*, documents_actions.*, datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id WHERE DO_ROZLICZENIA = 0"
      // );
      [filteredData] = await connect_SQL.query(
        "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, DS.OPIS_ROZRACHUNKU, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM documents AS D LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN settlements_description AS DS ON D.NUMER_FV = DS.NUMER LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV WHERE IFNULL(S.NALEZNOSC, 0) = 0"
      );
    } else if (info === "all") {
      // [filteredData] = await connect_SQL.query(
      //   "SELECT documents.*, documents_actions.*, datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id"
      // );
      [filteredData] = await connect_SQL.query(
        "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, DS.OPIS_ROZRACHUNKU, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM documents AS D LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN settlements_description AS DS ON D.NUMER_FV = DS.NUMER LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV "
      );
    }

    if (truePermissions[0] === "Basic") {
      filteredData = filteredData.filter((item) => item.DORADCA === DORADCA);
    } else if (truePermissions[0] === "Standard") {
      filteredData = filteredData.filter((item) =>
        trueDepartments.includes(item.DZIAL)
      );
    }
    return { data: filteredData, permission: truePermissions[0] };
  } catch (error) {
    logEvents(
      `documentsController, getDataDocuments: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getAllDocuments = async (req, res) => {
  const { info, id_user } = req.params;
  try {
    const result = await getDataDocuments(id_user, info);

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

// SQL funkcja która dodaje dane z becared
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
    for (const row of rows) {
      const [findDoc] = await connect_SQL.query(
        "SELECT id_document FROM documents WHERE NUMER_FV = ?",
        [row["Numery Faktur"]]
      );
      if (findDoc[0]?.id_document) {
        const [checkDoc] = await connect_SQL.query(
          "SELECT document_id FROM documents_actions WHERE document_id = ?",
          [findDoc[0].id_document]
        );
        if (checkDoc[0]?.document_id) {
          const STATUS_SPRAWY_KANCELARIA = row["Etap Sprawy"]
            ? row["Etap Sprawy"]
            : "-";
          const KOMENTARZ_KANCELARIA_BECARED = row["Ostatni komentarz"]
            ? row["Ostatni komentarz"]
            : "-";
          const DATA_KOMENTARZA_BECARED = isExcelDate(
            row["Data ostatniego komentarza"]
          )
            ? excelDateToISODate(row["Data ostatniego komentarza"])
            : "-";
          const NUMER_SPRAWY_BECARED = row["Numer sprawy"]
            ? row["Numer sprawy"]
            : "-";
          const KWOTA_WINDYKOWANA_BECARED = row["Suma roszczeń"]
            ? row["Suma roszczeń"]
            : 0;
          await connect_SQL.query(
            "UPDATE documents_actions SET STATUS_SPRAWY_KANCELARIA = ?, KOMENTARZ_KANCELARIA_BECARED = ?, NUMER_SPRAWY_BECARED = ?, KWOTA_WINDYKOWANA_BECARED = ?, DATA_KOMENTARZA_BECARED = ? WHERE document_id = ?",
            [
              STATUS_SPRAWY_KANCELARIA,
              KOMENTARZ_KANCELARIA_BECARED,
              NUMER_SPRAWY_BECARED,
              KWOTA_WINDYKOWANA_BECARED,
              DATA_KOMENTARZA_BECARED,
              checkDoc[0].document_id,
            ]
          );
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

// funkcja która dodaje dane z pliku excel - dokumenty autostacja
const ASFile = async (documents, res) => {
  if (
    !("WYSTAWIONO" in documents[0]) ||
    !("NUMER" in documents[0]) ||
    !("KOREKTA" in documents[0]) ||
    !("W. NETTO" in documents[0]) ||
    !("W. BRUTTO" in documents[0]) ||
    !("PŁATNOŚĆ" in documents[0]) ||
    !("NR KONTR." in documents[0]) ||
    !("KONTRAHENT" in documents[0]) ||
    !("UWAGI" in documents[0]) ||
    !("NIP" in documents[0]) ||
    !("PRZYGOTOWAŁ" in documents[0]) ||
    !("NR NADWOZIA" in documents[0]) ||
    !("NR REJESTRACYJNY" in documents[0]) ||
    !("NR SZKODY" in documents[0])
  ) {
    return res.status(500).json({ error: "Invalid file" });
  }
  try {
    const dzialMap = {
      D048: "D048/D058",
      D058: "D048/D058",
      D068: "D068/D078",
      D078: "D068/D078",
      D118: "D118/D148",
      D148: "D118/D148",
      D168: "D118/D148",
      D308: "D308/D318",
      D318: "D308/D318",
    };

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

    for (const doc of addDepartment) {
      const [duplicateFV] = await connect_SQL.query(
        "SELECT id_document FROM documents WHERE NUMER_FV = ?",
        [doc.NUMER]
      );
      // console.log(duplicate);
      const [settlement] = await connect_SQL.query(
        "SELECT TERMIN, NALEZNOSC FROM settlements WHERE NUMER_FV = ?",
        [doc.NUMER]
      );
      // console.log(settlement);

      if (!duplicateFV[0]?.id_document && settlement[0]?.TERMIN) {
        await connect_SQL.query(
          "INSERT INTO documents (NUMER_FV, DZIAL, DATA_FV, TERMIN, BRUTTO, NETTO, DO_ROZLICZENIA, NR_REJESTRACYJNY, KONTRAHENT, DORADCA, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NR_KLIENTA, NIP, VIN ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
          [
            doc["NUMER"],
            doc.DZIAL,
            excelDateToISODate(doc["WYSTAWIONO"]),
            settlement[0]["TERMIN"],
            doc["W. BRUTTO"],
            doc["W. NETTO"],
            settlement[0]["NALEZNOSC"],
            doc["NR REJESTRACYJNY"],
            doc["KONTRAHENT"],
            doc["PRZYGOTOWAŁ"],
            doc["NR SZKODY"],
            doc["UWAGI"],
            doc["PŁATNOŚĆ"],
            doc["NR KONTR."],
            doc["NIP"],
            doc["NR NADWOZIA"],
          ]
        );
      }
    }

    console.log("finish");

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    logEvents(`documentsController, ASFile: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//SQL funkcja która dodaje dane z Rozrachunków do bazy danych i nanosi nowe należności na wszytskie faktury w DB
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
  try {
    const processedData = rows.reduce((acc, curr) => {
      const cleanDoc = curr["TYTUŁ"].split(" ")[0];

      let termin_fv = "";
      let data_fv = "";
      if (
        curr["TERMIN"] &&
        isExcelDate(curr["TERMIN"]) &&
        curr["WPROWADZONO"] &&
        isExcelDate(curr["WPROWADZONO"])
      ) {
        termin_fv = excelDateToISODate(curr["TERMIN"]).toString();
        data_fv = excelDateToISODate(curr["WPROWADZONO"]).toString();
      } else {
        termin_fv = curr["TERMIN"] ? curr["TERMIN"] : null;
        data_fv = curr["WPROWADZONO"] ? curr["WPROWADZONO"] : null;
      }

      const do_rozliczenia = curr["NALEŻNOŚĆ"]
        ? isNaN(parseFloat(curr["NALEŻNOŚĆ"]))
          ? 0
          : parseFloat(curr["NALEŻNOŚĆ"])
        : 0;

      const zobowiazania =
        curr["ZOBOWIĄZANIE"] && curr["ZOBOWIĄZANIE"] !== 0
          ? isNaN(parseFloat(curr["ZOBOWIĄZANIE"]))
            ? 0
            : parseFloat(curr["ZOBOWIĄZANIE"])
          : 0;

      if (!acc[cleanDoc]) {
        // Jeśli numer faktury nie istnieje jeszcze w accumulatorze, dodajemy nowy obiekt
        acc[cleanDoc] = {
          NUMER_FV: cleanDoc,
          TERMIN: termin_fv,
          DATA_WYSTAWIENIA_FV: data_fv,
          DO_ROZLICZENIA: do_rozliczenia,
          ZOBOWIAZANIA: zobowiazania,
        };
      } else {
        // Jeśli numer faktury już istnieje, agregujemy dane:

        // Wybór najstarszej daty TERMIN
        if (isExcelDate(curr["TERMIN"])) {
          const currentTermDate = excelDateToISODate(curr["TERMIN"]);
          // const existingTermDate = excelDateToISODate(acc[cleanDoc].TERMIN);
          const existingTermDate = acc[cleanDoc].TERMIN;

          acc[cleanDoc].TERMIN =
            currentTermDate < existingTermDate
              ? currentTermDate
              : existingTermDate;
        }

        // Sumowanie wartości DO_ROZLICZENIA
        acc[cleanDoc].DO_ROZLICZENIA += do_rozliczenia;

        // Sumowanie wartości ZOBOWIAZANIA
        acc[cleanDoc].ZOBOWIAZANIA += zobowiazania;
      }

      return acc;
    }, {});

    // Zamiana obiektu na tablicę
    const result = Object.values(processedData);

    await connect_SQL.query(
      "UPDATE settlements SET NALEZNOSC = 0, ZOBOWIAZANIA = 0"
    );

    for (const doc of result) {
      const [checkDoc] = await connect_SQL.query(
        "SELECT id_settlement FROM settlements WHERE NUMER_FV = ?",
        [doc.NUMER_FV]
      );
      // console.log(checkDoc);

      if (checkDoc?.length) {
        await connect_SQL.query(
          "UPDATE settlements SET TERMIN = ?, NALEZNOSC = ?, ZOBOWIAZANIA = ? WHERE NUMER_FV = ?",
          [doc.TERMIN, doc.DO_ROZLICZENIA, doc.ZOBOWIAZANIA, doc.NUMER_FV]
        );
      } else {
        await connect_SQL.query(
          "INSERT INTO settlements (NUMER_FV, TERMIN, NALEZNOSC, ZOBOWIAZANIA) VALUES(?, ?, ?, ?)",
          [doc.NUMER_FV, doc.TERMIN, doc.DO_ROZLICZENIA, doc.ZOBOWIAZANIA]
        );
      }
    }

    await connect_SQL.query(
      "UPDATE updates SET settlements = CURRENT_TIMESTAMP WHERE id_update = 1"
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

// SQL dodaje opisy rozrachunków z pliku
const settlementsDescriptionFile = async (rows, res) => {
  try {
    if (
      !("NUMER" in rows[0]) ||
      !("OPIS" in rows[0]) ||
      !("DataRozlAutostacja" in rows[0]) ||
      !("DATA_WYSTAWIENIA" in rows[0]) ||
      !("DataOperacji" in rows[0])
    ) {
      return res.status(500).json({ error: "Error file" });
    }

    const processedData = rows.reduce((acc, curr) => {
      const { NUMER, DataOperacji, OPIS, DataRozlAutostacja } = curr;
      const dataISO = isExcelDate(DataOperacji)
        ? excelDateToISODate(DataOperacji)
        : "Brak daty"; // Przekształcenie daty operacji

      const opisEntry = `${dataISO} + ${OPIS}`; // Tworzenie wpisu DataOperacji + OPIS
      // const opisEntry = `${dataISO} + ${OPIS}`; // Tworzenie wpisu DataOperacji + OPIS

      // Przekształcenie DataRozlAutostacja (jeśli nie null)
      const rozlAutostacjaISO = isExcelDate(DataRozlAutostacja)
        ? excelDateToISODate(DataRozlAutostacja)
        : "";

      if (!acc[NUMER] && OPIS !== "NULL") {
        // Jeśli NUMER nie istnieje w acc, tworzony jest nowy obiekt
        acc[NUMER] = {
          NUMER,
          OPIS: [opisEntry],
          DataRozlAutostacja: rozlAutostacjaISO, // Zapisz datę, jeśli istnieje
        };
      } else {
        // Jeśli NUMER już istnieje, dodaj nowy wpis do tablicy OPIS
        if (OPIS !== "NULL") {
          acc[NUMER].OPIS.push(opisEntry);
        }

        // Sprawdź, która data jest nowsza
        if (
          rozlAutostacjaISO &&
          (!acc[NUMER].DataRozlAutostacja ||
            new Date(rozlAutostacjaISO) >
              new Date(acc[NUMER].DataRozlAutostacja))
        ) {
          acc[NUMER].DataRozlAutostacja = rozlAutostacjaISO; // Zapisz nowszą datę
        }
      }

      return acc;
    }, {});

    // Zamiana obiektu na tablicę
    const result = Object.values(processedData).map((item) => {
      // Sortowanie tablicy OPIS na podstawie daty
      item.OPIS.sort(
        (a, b) => new Date(a.split(" + ")[0]) - new Date(b.split(" + ")[0])
      );

      return item;
    });

    for (const item of result) {
      const [duplicate] = await connect_SQL.query(
        "SELECT NUMER FROM settlements_description WHERE NUMER = ?",
        [item.NUMER]
      );
      if (duplicate.length) {
        await connect_SQL.query(
          "UPDATE settlements_description SET OPIS_ROZRACHUNKU = ?, DATA_ROZL_AS = ? WHERE NUMER = ?",
          [
            JSON.stringify(item.OPIS),
            item.DataRozlAutostacja ? item.DataRozlAutostacja : null,
            item.NUMER,
          ]
        );
      } else {
        // console.log(item);
        await connect_SQL.query(
          "INSERT INTO settlements_description (NUMER, OPIS_ROZRACHUNKU, DATA_ROZL_AS) VALUES (?, ?, ?)",
          [
            item.NUMER,
            JSON.stringify(item.OPIS),
            item.DataRozlAutostacja ? item.DataRozlAutostacja : null,
          ]
        );
      }
    }

    res.end();
  } catch (error) {
    logEvents(
      `documentsController, settlementsDescriptionFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//chwilowa funckja do naprawienia danych w DB
const repairFile = async (rows, res) => {
  try {
    console.log("repair");
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
    } else if (type === "settlements_description") {
      return settlementsDescriptionFile(rows, res);
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

//SQL zmienia tylko pojedyńczy dokument, w tabeli BL po edycji wiersza
const changeSingleDocument = async (req, res) => {
  const { id_document, documentItem } = req.body;
  try {
    const [documentsExist] = await connect_SQL.query(
      "SELECT id_document from documents WHERE id_document = ?",
      [id_document]
    );

    if (documentsExist[0]?.id_document) {
      await connect_SQL.query(
        "UPDATE documents SET BRUTTO = ?, NETTO = ? WHERE id_document = ?",
        [documentItem.BRUTTO, documentItem.NETTO, id_document]
      );
    }

    const [documents_ActionsExist] = await connect_SQL.query(
      "SELECT id_action from documents_actions WHERE document_id = ?",
      [id_document]
    );
    if (documents_ActionsExist[0]?.id_action) {
      await connect_SQL.query(
        "UPDATE documents_actions SET DZIALANIA = ?, JAKA_KANCELARIA = ?, POBRANO_VAT = ?, ZAZNACZ_KONTRAHENTA = ?, UWAGI_ASYSTENT = ?, BLAD_DORADCY = ?  WHERE document_id = ?",
        [
          documentItem.DZIALANIA,
          documentItem.JAKA_KANCELARIA,
          documentItem.POBRANO_VAT,
          documentItem.ZAZNACZ_KONTRAHENTA,
          JSON.stringify(documentItem.UWAGI_ASYSTENT),
          documentItem.BLAD_DORADCY,
          id_document,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO documents_actions (document_id, DZIALANIA, JAKA_KANCELARIA, POBRANO_VAT, ZAZNACZ_KONTRAHENTA, UWAGI_ASYSTENT, BLAD_DORADCY) VALUES (?, ?, ?, ?, ?, ?, ?)",
        [
          id_document,
          documentItem.DZIALANIA,
          documentItem.JAKA_KANCELARIA,
          documentItem.POBRANO_VAT,
          documentItem.ZAZNACZ_KONTRAHENTA,
          JSON.stringify(documentItem.UWAGI_ASYSTENT),
          documentItem.BLAD_DORADCY,
        ]
      );
    }

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

// SQL pobieram dane do tabeli, ustawienia tabeli(order, visiblility itd), kolumny
const getDataTable = async (req, res) => {
  const { id_user, info } = req.params;
  if (!id_user || !info) {
    return res.status(400).json({ message: "Id and info are required." });
  }
  try {
    const result = await getDataDocuments(id_user, info);

    const findUser = await connect_SQL.query(
      "SELECT  tableSettings, columns  FROM users WHERE id_user = ?",
      [id_user]
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

// pobiera pojedyńczy dokument SQL
const getSingleDocument = async (req, res) => {
  const { id_document } = req.params;
  try {
    const [result] = await connect_SQL.query(
      "SELECT documents.*, documents_actions.* FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id WHERE documents.id_document = ?",
      [id_document]
    );
    res.json(result[0]);
  } catch (error) {
    logEvents(
      `documentsController, getSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// SQL pobieram nazwy kolumn do sutawień tabeli
const getColumnsName = async (req, res) => {
  try {
    // const [result] = await connect_SQL.query(
    //   "SELECT documents.*, documents_actions.*,   datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id  LIMIT 1"
    // );
    const [result] = await connect_SQL.query(
      "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, DS.OPIS_ROZRACHUNKU, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM documents AS D LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN settlements_description AS DS ON D.NUMER_FV = DS.NUMER LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV LIMIT 1"
    );
    // const [result] = await connect_SQL.query(
    //   "SELECT documents.*, documents_actions.*, DS.*,  datediff(NOW(), TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((BRUTTO - NETTO), 2) AS '100_VAT', ROUND(((BRUTTO - NETTO) / 2), 2) AS '50_VAT', IF(TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE FROM documents LEFT JOIN documents_actions ON documents.id_document = documents_actions.document_id LEFT JOIN settlements_description AS DS ON documents.NUMER_FV = DS.NUMER LIMIT 1"
    // );
    const keysArray = Object.keys(result[0]);

    // usuwam kolumny których nie chce przekazać do front
    const newArray = keysArray.filter(
      (item) =>
        item !== "id_document" &&
        item !== "id_action" &&
        item !== "document_id" &&
        item !== "id_sett_desc" &&
        item !== "NUMER"
    );
    console.log(newArray);
    res.json(newArray);
  } catch (error) {
    logEvents(
      `documentsController, getColumnsName: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getAllDocuments,
  documentsFromFile,
  changeSingleDocument,
  getDataTable,
  getDataDocuments,
  getSingleDocument,
  getColumnsName,
};
