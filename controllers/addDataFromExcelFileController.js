const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require("./manageDocumentAddition");

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
    // zamiana formatu liczby od VOTUM z kropką na liczbe z przecinkiem
    const parseKwotaPolska = (raw) => {
      if (raw === null || raw === undefined || raw === "") return 0;

      // jeśli to już number → zwróć bez zmian
      if (typeof raw === "number" && !isNaN(raw)) {
        return raw;
      }

      let str = String(raw).trim();

      // usuń spacje (np. separatorem tysięcy)
      str = str.replace(/\s+/g, "");

      // jeśli jest przecinek → zamień na kropkę
      if (str.includes(",")) {
        // opcjonalnie: jeśli jest też kropka — usuń najpierw tysiące np. "1.234,56"
        str = str.replace(/\./g, "");
        str = str.replace(",", ".");
      }

      const val = parseFloat(str);
      return isNaN(val) ? 0 : val;
    };

    for (const row of rows) {
      const [findDoc] = await connect_SQL.query(
        "SELECT id_document FROM company_documents WHERE NUMER_FV = ?",
        [row["Numery Faktur"]]
      );
      if (findDoc[0]?.id_document) {
        const [checkDoc] = await connect_SQL.query(
          "SELECT document_id FROM company_documents_actions WHERE document_id = ?",
          [findDoc[0].id_document]
        );
        if (checkDoc[0]?.document_id) {
          const STATUS_SPRAWY_KANCELARIA = row["Etap Sprawy"]
            ? row["Etap Sprawy"]
            : null;
          const KOMENTARZ_KANCELARIA_BECARED = row["Ostatni komentarz"]
            ? row["Ostatni komentarz"]
            : null;
          const DATA_KOMENTARZA_BECARED = isExcelDate(
            row["Data ostatniego komentarza"]
          )
            ? excelDateToISODate(row["Data ostatniego komentarza"])
            : null;
          const NUMER_SPRAWY_BECARED = row["Numer sprawy"]
            ? row["Numer sprawy"]
            : null;
          // const KWOTA_WINDYKOWANA_BECARED = row["Suma roszczeń"]
          //   ? row["Suma roszczeń"]
          //   : 0;
          // const KWOTA_WINDYKOWANA_BECARED = parseFloat(
          //   (row["Suma roszczeń"] || "0").replace(",", ".")
          // );

          const KWOTA_WINDYKOWANA_BECARED = parseKwotaPolska(
            row["Suma roszczeń"]
          );

          await connect_SQL.query(
            "UPDATE company_documents_actions SET STATUS_SPRAWY_KANCELARIA = ?, KOMENTARZ_KANCELARIA_BECARED = ?, NUMER_SPRAWY_BECARED = ?, KWOTA_WINDYKOWANA_BECARED = ?, DATA_KOMENTARZA_BECARED = ? WHERE document_id = ?",
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

    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        "BeCared",
      ]
    );

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        "BeCared",
      ]
    );
    logEvents(
      `addDataFromExcelFileController, becaredFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// SQL dodaje dane z pliku rubicon
const rubiconFile = async (rows, res) => {
  if (
    !("Faktura nr" in rows[0]) ||
    !("Status aktualny" in rows[0]) ||
    !("Firma zewnętrzna" in rows[0]) ||
    !("data przeniesienia<br>do WP" in rows[0])
  ) {
    logEvents(
      `addDataFromExcelFileController, rubiconFile: błędne kolumny w pliku Rubicon`,
      "reqServerErrors.txt"
    );
    return res.status(500).json({ error: "Error file" });
  }
  try {
    const filteredData = rows
      .map((row) => {
        const status =
          row["Status aktualny"] !== "Brak działań" &&
          row["Status aktualny"] !== "Rozliczona" &&
          row["Status aktualny"] !== "sms/mail +3" &&
          row["Status aktualny"] !== "sms/mail -2" &&
          row["Status aktualny"] !== "Zablokowana" &&
          row["Status aktualny"] !== "Zablokowana BL" &&
          row["Status aktualny"] !== "Zablokowana KF" &&
          row["Status aktualny"] !== "Zablokowana KF BL" &&
          row["Status aktualny"] !== "Do decyzji" &&
          row["Status aktualny"] !== "Windykacja zablokowana bezterminowo" &&
          row["Status aktualny"] !== "Do wyjaśnienia"
            ? row["Status aktualny"]
            : "BRAK";

        if (status !== "BRAK") {
          return {
            NUMER_FV: row["Faktura nr"],
            STATUS_AKTUALNY:
              status !== "BRAK" ? status : row["Status aktualny"],
            JAKA_KANCELARIA: status !== "BRAK" ? row["Firma zewnętrzna"] : null,
            DATA_PRZENIESIENIA_DO_WP: row["data przeniesienia<br>do WP"],
            FIRMA: "KRT",
          };
        }
      })
      .filter(Boolean);

    await connect_SQL.query(`TRUNCATE TABLE company_rubicon_data`);

    const query = `
      INSERT INTO company_rubicon_data ( NUMER_FV, STATUS_AKTUALNY,  FIRMA_ZEWNETRZNA, DATA_PRZENIESIENIA_DO_WP, COMPANY)
      VALUES ?
      ON DUPLICATE KEY UPDATE
        STATUS_AKTUALNY = VALUES(STATUS_AKTUALNY),
        FIRMA_ZEWNETRZNA = VALUES(FIRMA_ZEWNETRZNA),
        DATA_PRZENIESIENIA_DO_WP = VALUES(DATA_PRZENIESIENIA_DO_WP),
        COMPANY = VALUES(COMPANY)
    `;

    const values = filteredData.map((row) => [
      row.NUMER_FV,
      row.STATUS_AKTUALNY,
      row.JAKA_KANCELARIA,
      row.DATA_PRZENIESIENIA_DO_WP,
      row.FIRMA,
    ]);

    await connect_SQL.query(query, [values]);

    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        "Rubicon",
      ]
    );

    res.end();
  } catch (error) {
    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        "Rubicon",
      ]
    );
    logEvents(
      `addDataFromExcelFileController, rubiconFile: ${error}`,
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
      logEvents(
        `addDataFromExcelFileController, documentsFromFile - isExcelFIle: ${error}`,
        "reqServerErrors.txt"
      );
      return res.status(500).json({ error: "Invalid file" });
    }
    const workbook = read(buffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

    if (type === "becared") {
      return becaredFile(rows, res);
    } else if (type === "rubicon") {
      return rubiconFile(rows, res);
    } else {
      return res.status(500).json({ error: "Invalid file" });
    }
  } catch (error) {
    logEvents(
      `addDataFromExcelFileController, documentsFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  documentsFromFile,
};
