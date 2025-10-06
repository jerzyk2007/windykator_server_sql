const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require("./manageDocumentAddition");
const { addDepartment, documentsType } = require("./manageDocumentAddition");

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
          const KWOTA_WINDYKOWANA_BECARED = row["Suma roszczeń"]
            ? row["Suma roszczeń"]
            : 0;
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
            STATUS_AKTUALNY: status !== "BRAK" ? status : row.ETAP_SPRAWY,
            JAKA_KANCELARIA: status !== "BRAK" ? row["Firma zewnętrzna"] : null,
            DATA_PRZENIESIENIA_DO_WP: row["data przeniesienia<br>do WP"],
            FIRMA: "KRT",
          };
        }
      })
      .filter(Boolean);

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

// const accountancyFile = async (req, res) => {
//   const { company } = req.params;
//   if (!req.file) {
//     return res.status(400).json({ error: "Not delivered file" });
//   }
//   try {
//     const buffer = req.file.buffer;
//     const data = new Uint8Array(buffer);

//     if (!isExcelFile(data)) {
//       console.log('error');
//       return res.status(500).json({ error: "Invalid file" });
//     }

//     const workbook = read(buffer, { type: "buffer" });
//     const workSheetName = workbook.SheetNames[0];
//     const workSheet = workbook.Sheets[workSheetName];
//     const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

//     if (
//       !("Nr. dokumentu" in rows[0]) ||
//       !("Kontrahent" in rows[0]) ||
//       !("Płatność" in rows[0]) ||
//       !("Data płatn." in rows[0]) ||
//       !("Nr kontrahenta" in rows[0]) ||
//       !("Synt." in rows[0])
//     ) {
//       return res.json({ info: "Plik musi zawierać kolumny: 'Nr. dokumentu', 'Kontrahent', 'Płatność', 'Data płatn.', 'Nr kontrahenta', 'Synt.'" });
//     }

//     const changeNameColumns = rows.map(item => {
//       return {
//         NUMER: item["Nr. dokumentu"],
//         KONTRAHENT: item["Kontrahent"],
//         NR_KONTRAHENTA: item["Nr kontrahenta"],
//         DO_ROZLICZENIA: item["Płatność"],
//         TERMIN: isExcelDate(item["Data płatn."]) ? excelDateToISODate(item["Data płatn."]) : null,
//         KONTO: item["Synt."],
//         TYP_DOKUMENTU: documentsType(item["Nr. dokumentu"]),
//         FIRMA: company
//       };
//     });

//     const addDep = addDepartment(changeNameColumns);
//     const [findItems] = await connect_SQL.query('SELECT DEPARTMENT FROM company_join_items WHERE COMPANY = ?', [company]);

//     // jeśli nie będzie możliwe dopasowanie ownerów, lokalizacji to wyskoczy bład we froncie
//     let errorDepartments = [];
//     addDep.forEach(item => {
//       if (!findItems.some(findItem => findItem.DEPARTMENT === item.DZIAL)) {
//         // Jeśli DZIAL nie ma odpowiednika, dodaj do errorDepartments
//         if (!errorDepartments.includes(item.DZIAL)) {
//           errorDepartments.push(item.DZIAL);
//         }
//       }
//     });

//     if (errorDepartments.length > 0) {
//       return res.json({ info: `Brak danych o działach: ${errorDepartments}` });
//     }
//     await connect_SQL.query(`TRUNCATE TABLE company_raportFK_${company}_accountancy`);

//     const values = addDep.map(item => [
//       item.NUMER,
//       item.KONTRAHENT,
//       item.NR_KONTRAHENTA,
//       item.DO_ROZLICZENIA,
//       item.TERMIN,
//       item.KONTO,
//       item.TYP_DOKUMENTU,
//       item.DZIAL,
//       item.FIRMA
//     ]);

//     const query = `
//       INSERT IGNORE INTO company_raportFK_${company}_accountancy
//         (NUMER_FV, KONTRAHENT, NR_KONTRAHENTA, DO_ROZLICZENIA, TERMIN_FV, KONTO, TYP_DOKUMENTU, DZIAL, FIRMA)
//       VALUES
//         ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
//     `;

//     await connect_SQL.query(query, values.flat());

//     await connect_SQL.query(`UPDATE company_fk_updates_date SET DATE = ?, COUNTER = ? WHERE TITLE = 'accountancy' AND COMPANY = ?`, [checkDate(new Date()), addDep.length || 0, company]);

//     res.json({ info: 'Dane zaktualizowane.' });
//   }
//   catch (error) {
//     logEvents(
//       `addDataFromExcelFileController, accountancyFile: ${error}`,
//       "reqServerErrors.txt"
//     );
//     res.status(500).json({ error: "Server error" });
//   }
// };

const randomFile = async (rows, res) => {
  try {
    // const filteredData = rows.map((item) => {
    //   const DATA_DODANIA = isExcelDate(item.data)
    //     ? excelDateToISODate(item.data)
    //     : null;
    //   return {
    //     NUMER_FV: item.faktura,
    //     KANCELARIA: item.firma,
    //     DATA_DODANIA,
    //     FIRMA: "KRT",
    //   };
    // });

    // const values = filteredData.map((item) => [
    //   item.NUMER_FV,
    //   item.DATA_DODANIA,
    //   item.KANCELARIA,
    //   item.FIRMA,
    // ]);

    // const query = `
    //   INSERT IGNORE INTO company_rubicon_data_history
    //     (NUMER_FV, DATA_PRZENIESIENIA_DO_WP, FIRMA_ZEWNETRZNA, COMPANY)
    //   VALUES
    //     ${values.map(() => "(?, ?, ?, ?)").join(", ")}
    // `;

    // await connect_SQL.query(query, values.flat());
    res.end();
  } catch (error) {
    logEvents(
      `addDataFromExcelFileController, randomFile: ${error}`,
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
    } else if (type === "random") {
      return randomFile(rows, res);
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
  // accountancyFile
};
