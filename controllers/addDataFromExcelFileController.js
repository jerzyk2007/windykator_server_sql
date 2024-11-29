const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");


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

    // Najpierw wyczyść tabelę settlements_description
    await connect_SQL.query("TRUNCATE TABLE settlements");

    // Teraz przygotuj dane do wstawienia
    const values = result.map(item => [
      item.NUMER_FV,
      item.TERMIN,
      item.DO_ROZLICZENIA !== 0 ? item.DO_ROZLICZENIA : -item.ZOBOWIAZANIA,
      item.ZOBOWIAZANIA
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO settlements
            ( NUMER_FV, TERMIN, NALEZNOSC, ZOBOWIAZANIA) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?)").join(", ")}
        `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    // dodaje date aktualizacji rozrachunków
    const checkDate = (data) => {
      const year = data.getFullYear();
      const month = String(data.getMonth() + 1).padStart(2, '0'); // Dodajemy +1, bo miesiące są liczone od 0
      const day = String(data.getDate()).padStart(2, '0');
      const yearNow = `${year}-${month}-${day}`;
      return yearNow;
    };
    const checkTime = (data) => {
      const hour = String(data.getHours()).padStart(2, '0');
      const min = String(data.getMinutes()).padStart(2, '0');
      const timeNow = `${hour}:${min}`;

      return timeNow;
    };

    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'Rozrachunki'
      ]);


    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    logEvents(
      `addDataFromExcelFileController, settlementsFile: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
    res.status(500).json({ error: "Server error" });
  }
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

// SQL dodaje dane z pliku rubicon
const rubiconFile = async (rows, res) => {
  if (
    !('Faktura nr' in rows[0]) ||
    !('Status aktualny' in rows[0]) ||
    !('data przeniesienia<br>do WP' in rows[0]) ||
    !('Firma zewnętrzna' in rows[0])
  ) {
    return res.status(500).json({ error: "Error file" });
  }
  try {
    const filteredFile = rows.filter(item => item['data przeniesienia<br>do WP']);

    const rubiconData = filteredFile.map(item => [
      item['Faktura nr'],
      item['Status aktualny'],
      item['data przeniesienia<br>do WP'],
      item['Firma zewnętrzna']
    ]);
    await connect_SQL.query("TRUNCATE TABLE rubicon");

    const query = `
         INSERT IGNORE INTO rubicon
           ( NUMER_FV, STATUS_AKTUALNY, DATA_PRZENIESIENIA_DO_WP, FIRMA_ZEWNETRZNA ) 
         VALUES 
           ${rubiconData.map(() => "(?, ?, ?, ?)").join(", ")}
       `;
    await connect_SQL.query(query, rubiconData.flat());

    res.end();
  } catch (error) {
    logEvents(
      `documentsController, rubiconFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

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
    if (type === "settlements") {
      return settlementsFile(rows, res);
    } else if (type === "becared") {
      return becaredFile(rows, res);
    } else if (type === "rubicon") {
      return rubiconFile(rows, res);
    }
    else {
      return res.status(500).json({ error: "Invalid file" });
    }
  }
  catch (error) {
    logEvents(
      `addDataFromExcelFileController, documentsFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    // console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  documentsFromFile
};