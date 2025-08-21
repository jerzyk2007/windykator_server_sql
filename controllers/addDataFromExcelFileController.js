const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { addDepartment, documentsType } = require('./manageDocumentAddition');
const ExcelJS = require("exceljs");

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
        'BeCared'
      ]);

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        'BeCared'
      ]);
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
    !('Faktura nr' in rows[0]) ||
    !('Status aktualny' in rows[0]) ||
    !('data przeniesienia<br>do WP' in rows[0]) ||
    !('Firma zewnętrzna' in rows[0]) ||
    !('data przeniesienia<br>do WP' in rows[0])

  ) {
    return res.status(500).json({ error: "Error file" });
  }

  try {
    const filteredData = rows.map(row => {
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
          row["Status aktualny"] !== "Windykacja zablokowana bezterminowo"
          ? row["Status aktualny"]
          : "BRAK";
      if (status !== "BRAK") {
        return {
          NUMER_FV: row['Faktura nr'],
          STATUS_AKTUALNY: status !== "BRAK" ? status : row.ETAP_SPRAWY,
          JAKA_KANCELARIA: status !== "BRAK"
            ? row["Firma zewnętrzna"]
            : null,
          DATA_PRZENIESIENIA_DO_WP: row['data przeniesienia<br>do WP'],
          FIRMA: 'KRT'
        };
      }

    }).filter(Boolean);


    const query = `
      INSERT INTO company_rubicon_data ( NUMER_FV, STATUS_AKTUALNY,  FIRMA_ZEWNETRZNA, DATA_PRZENIESIENIA_DO_WP, COMPANY) 
      VALUES ?
      ON DUPLICATE KEY UPDATE
        STATUS_AKTUALNY = VALUES(STATUS_AKTUALNY),
        FIRMA_ZEWNETRZNA = VALUES(FIRMA_ZEWNETRZNA),
        DATA_PRZENIESIENIA_DO_WP = VALUES(DATA_PRZENIESIENIA_DO_WP),
        COMPANY = VALUES(COMPANY)
    `;

    const values = filteredData.map(row => [
      row.NUMER_FV,
      row.STATUS_AKTUALNY,
      row.JAKA_KANCELARIA,
      row.DATA_PRZENIESIENIA_DO_WP,
      row.FIRMA
    ]);

    await connect_SQL.query(query, [values]);


    const queryHistory = `
    INSERT INTO company_rubicon_data_history ( NUMER_FV, STATUS_AKTUALNY,  FIRMA_ZEWNETRZNA, DATA_PRZENIESIENIA_DO_WP, COMPANY) 
    VALUES ?
    ON DUPLICATE KEY UPDATE
      STATUS_AKTUALNY = VALUES(STATUS_AKTUALNY),
      FIRMA_ZEWNETRZNA = VALUES(FIRMA_ZEWNETRZNA),
      DATA_PRZENIESIENIA_DO_WP = VALUES(DATA_PRZENIESIENIA_DO_WP),
      COMPANY = VALUES(COMPANY)
  `;

    const valuesHistory = filteredData.map(row => [
      row.NUMER_FV,
      row.STATUS_AKTUALNY,
      row.JAKA_KANCELARIA,
      row.DATA_PRZENIESIENIA_DO_WP,
      row.FIRMA
    ]);

    await connect_SQL.query(queryHistory, [valuesHistory]);

    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'Rubicon'
      ]);

    res.end();
  } catch (error) {

    await connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        'Rubicon'
      ]);
    logEvents(
      `addDataFromExcelFileController, rubiconFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};


const accountancyFile = async (req, res) => {
  const { company } = req.params;
  if (!req.file) {
    return res.status(400).json({ error: "Not delivered file" });
  }
  try {
    const buffer = req.file.buffer;
    const data = new Uint8Array(buffer);

    if (!isExcelFile(data)) {
      console.log('error');
      return res.status(500).json({ error: "Invalid file" });
    }

    const workbook = read(buffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

    if (
      !("Nr. dokumentu" in rows[0]) ||
      !("Kontrahent" in rows[0]) ||
      !("Płatność" in rows[0]) ||
      !("Data płatn." in rows[0]) ||
      !("Nr kontrahenta" in rows[0]) ||
      !("Synt." in rows[0])
    ) {
      return res.json({ info: "Plik musi zawierać kolumny: 'Nr. dokumentu', 'Kontrahent', 'Płatność', 'Data płatn.', 'Nr kontrahenta', 'Synt.'" });
    }

    const changeNameColumns = rows.map(item => {
      return {
        NUMER: item["Nr. dokumentu"],
        KONTRAHENT: item["Kontrahent"],
        NR_KONTRAHENTA: item["Nr kontrahenta"],
        DO_ROZLICZENIA: item["Płatność"],
        TERMIN: isExcelDate(item["Data płatn."]) ? excelDateToISODate(item["Data płatn."]) : null,
        KONTO: item["Synt."],
        TYP_DOKUMENTU: documentsType(item["Nr. dokumentu"]),
        FIRMA: company
      };
    });

    const addDep = addDepartment(changeNameColumns);
    const [findItems] = await connect_SQL.query('SELECT DEPARTMENT FROM company_join_items WHERE COMPANY = ?', [company]);


    // jeśli nie będzie możliwe dopasowanie ownerów, lokalizacji to wyskoczy bład we froncie
    let errorDepartments = [];
    addDep.forEach(item => {
      if (!findItems.some(findItem => findItem.DEPARTMENT === item.DZIAL)) {
        // Jeśli DZIAL nie ma odpowiednika, dodaj do errorDepartments
        if (!errorDepartments.includes(item.DZIAL)) {
          errorDepartments.push(item.DZIAL);
        }
      }
    });

    if (errorDepartments.length > 0) {
      return res.json({ info: `Brak danych o działach: ${errorDepartments}` });
    }
    await connect_SQL.query(`TRUNCATE TABLE company_raportFK_${company}_accountancy`);

    const values = addDep.map(item => [
      item.NUMER,
      item.KONTRAHENT,
      item.NR_KONTRAHENTA,
      item.DO_ROZLICZENIA,
      item.TERMIN,
      item.KONTO,
      item.TYP_DOKUMENTU,
      item.DZIAL,
      item.FIRMA
    ]);

    const query = `
      INSERT IGNORE INTO company_raportFK_${company}_accountancy
        (NUMER_FV, KONTRAHENT, NR_KONTRAHENTA, DO_ROZLICZENIA, TERMIN_FV, KONTO, TYP_DOKUMENTU, DZIAL, FIRMA) 
      VALUES 
        ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    `;

    await connect_SQL.query(query, values.flat());

    await connect_SQL.query(`UPDATE company_fk_updates_date SET DATE = ?, COUNTER = ? WHERE TITLE = 'accountancy' AND COMPANY = ?`, [checkDate(new Date()), addDep.length || 0, company]);

    res.json({ info: 'Dane zaktualizowane.' });
  }
  catch (error) {
    logEvents(
      `addDataFromExcelFileController, accountancyFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const getExcelRaport = async (data) => {
  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet("Raport");

  // kolumny na podstawie kluczy pierwszego obiektu, początkowo szerokość 10
  worksheet.columns = Object.keys(data[0]).map((key) => ({
    header: key,
    key: key,
    width: 10, // tymczasowa szerokość
    style: { alignment: { wrapText: true } } // zawijanie tekstu
  }));

  // dodajemy dane
  data.forEach((row) => {
    const addedRow = worksheet.addRow(row);
    addedRow.alignment = { wrapText: true, vertical: "top" };
  });

  // formatowanie nagłówków
  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };
  headerRow.alignment = { horizontal: "center", vertical: "middle" };

  // zablokowanie pierwszego wiersza
  worksheet.views = [{ state: "frozen", ySplit: 1 }];

  // automatyczny filtr
  worksheet.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: 1, column: worksheet.columns.length }
  };

  // auto dopasowanie szerokości kolumn do zawartości, max 25
  worksheet.columns.forEach((col) => {
    let maxLength = col.header.length;
    col.eachCell({ includeEmpty: true }, (cell) => {
      const cellValue = cell.value ? cell.value.toString() : "";
      if (cellValue.length > maxLength) maxLength = cellValue.length;
    });
    col.width = Math.min(maxLength + 2, 25); // +2 dla trochę luzu, max 25
  });

  return await workbook.xlsx.writeBuffer();
};



const randomFile = async (rows, res) => {
  try {

   const fiteredData = rows.map(row=>{
         const WPROWADZONO = isExcelDate(row.WPROWADZONO)
        ? excelDateToISODate(row.WPROWADZONO)
        : null;
         const TERMIN = isExcelDate(row.TERMIN)
        ? excelDateToISODate(row.TERMIN)
        : null;
    return {
      ...row,
      WPROWADZONO,
TERMIN,
    }
   })

   const newData = [];

for (const doc of fiteredData) {
  const query = `
    SELECT 
        fv.[NUMER] AS NUMER_FV,
        rozl.[OPIS] AS NUMER_OPIS
    FROM 
        [AS3_KROTOSKI_PRACA].[dbo].TRANSDOC AS tr
    LEFT JOIN 
        [AS3_KROTOSKI_PRACA].[dbo].FAKTDOC AS fv
        ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
    LEFT JOIN 
        [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS rozl 
        ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID]
    WHERE
        fv.[NUMER] IS NOT NULL
        AND tr.[OPIS] LIKE '${doc["TYTUŁ"]}'
  `;

  const opis = await msSqlQuery(query);

  // kopiujemy obiekt, żeby nie nadpisywać oryginału
  const newDoc = { ...doc };

  if (opis.length > 0) {
    opis.forEach((row, index) => {
      const key = index === 0 ? "OPIS_ROZR" : `OPIS_ROZR${index + 1}`;
      newDoc[key] = row.NUMER_OPIS;
    });
  }

  newData.push(newDoc);
}
console.log(newData[1])
 const excelBuffer = await getExcelRaport(newData, "opisy");

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader(
      "Content-Disposition",
      "attachment; filename=raport.xlsx"
    );

    res.send(excelBuffer);
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
      console.log('error');
      return res.status(500).json({ error: "Invalid file" });
    }

    const workbook = read(buffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

    if (type === "becared") {
      return becaredFile(rows, res);
    }
    else if (type === "rubicon") {
      return rubiconFile(rows, res);
    }
    else if (type === "random") {
      return randomFile(rows, res);
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
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  documentsFromFile,
  accountancyFile
};