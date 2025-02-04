const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");
const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { addDepartment, documentsType } = require('./manageDocumentAddition');
const { add } = require("date-fns");



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
      item.DATA_WYSTAWIENIA_FV,
      item.DO_ROZLICZENIA !== 0 ? item.DO_ROZLICZENIA : -item.ZOBOWIAZANIA,
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO settlements
            ( NUMER_FV, DATA_FV, NALEZNOSC) 
          VALUES 
            ${values.map(() => "(?, ?, ?)").join(", ")}
        `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

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
    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        'Rozrachunki'
      ]);

    logEvents(
      `addDataFromExcelFileController, settlementsFile: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// SQL funkcja która dodaje dane z becared
const becaredFile = async (rows, res) => {
  console.log('bec');
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

    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'BeCared'
      ]);

    res.status(201).json({ message: "Documents are updated" });
  } catch (error) {
    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
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
    !('Firma zewnętrzna' in rows[0])
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
          row["Status aktualny"] !== "Windykacja zablokowana bezterminowo" &&
          row["Status aktualny"] !== "Windykacja zablokowana 10" &&
          row["Status aktualny"] !== "Do decyzji"
          ? row["Status aktualny"]
          : "BRAK";
      if (status !== "BRAK") {
        return {
          NUMER_FV: row['Faktura nr'],
          STATUS_AKTUALNY: status !== "BRAK" ? status : row.ETAP_SPRAWY,
          JAKA_KANCELARIA: status !== "BRAK"
            ? row["Firma zewnętrzna"]
            : null,
          CZY_W_KANCELARI: status !== "BRAK" ? "TAK" : "NIE",
        };
      }

    }).filter(Boolean);
    await connect_SQL.query("TRUNCATE TABLE rubicon");

    const rubiconData = filteredData.map(item => [
      item.NUMER_FV,
      item.STATUS_AKTUALNY,
      item.JAKA_KANCELARIA
    ]);

    const query = `
         INSERT IGNORE INTO rubicon
           ( NUMER_FV, STATUS_AKTUALNY,  FIRMA_ZEWNETRZNA ) 
         VALUES 
           ${rubiconData.map(() => "(?, ?,  ?)").join(", ")}
       `;
    await connect_SQL.query(query, rubiconData.flat());


    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'Rubicon'
      ]);

    // przypisuję wersję z pewnymi zmianami dla raportu FK
    const filteredDataV2 = rows.map(row => {
      const status =
        row["Status aktualny"] !== "Brak działań" &&
          row["Status aktualny"] !== "Rozliczona" &&
          row["Status aktualny"] !== "sms/mail +3" &&
          row["Status aktualny"] !== "sms/mail -2" &&
          row["Status aktualny"] !== "Zablokowana" &&
          row["Status aktualny"] !== "Zablokowana BL" &&
          row["Status aktualny"] !== "Zablokowana KF" &&
          row["Status aktualny"] !== "Zablokowana KF BL" &&
          row["Status aktualny"] !== "Do decyzji"
          ? row["Status aktualny"]
          : "BRAK";
      if (status !== "BRAK") {
        return {
          NUMER_FV: row['Faktura nr'],
          STATUS_AKTUALNY: status !== "BRAK" ? status : row.ETAP_SPRAWY,
          JAKA_KANCELARIA: status !== "BRAK"
            ? row["Firma zewnętrzna"]
            : null,
          CZY_W_KANCELARI: status !== "BRAK" ? "TAK" : "NIE",
        };
      }

    }).filter(Boolean);

    await connect_SQL.query("TRUNCATE TABLE rubicon_raport_fk");

    const rubiconDataV2 = filteredDataV2.map(item => [
      item.NUMER_FV,
      item.STATUS_AKTUALNY,
      item.JAKA_KANCELARIA
    ]);

    const queryV2 = `
  INSERT IGNORE INTO rubicon_raport_fk
    ( NUMER_FV, STATUS_AKTUALNY,  FIRMA_ZEWNETRZNA ) 
  VALUES 
    ${rubiconDataV2.map(() => "(?, ?,  ?)").join(", ")}
`;
    await connect_SQL.query(queryV2, rubiconDataV2.flat());


    res.end();
  } catch (error) {

    await connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
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

const accountancyFile = async (rows, res) => {
  try {
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
        TYP_DOKUMENTU: documentsType(item["Nr. dokumentu"])
      };
    });



    const addDep = addDepartment(changeNameColumns);

    const [findItems] = await connect_SQL.query('SELECT department FROM join_items');

    // console.log(addDep[0]);
    // console.log(findItems[0]);


    // jeśli nie będzie możliwe dopasowanie ownerów, lokalizacji to wyskoczy bład we froncie
    let errorDepartments = [];
    addDep.forEach(item => {
      if (!findItems.some(findItem => findItem.department === item.DZIAL)) {
        // Jeśli DZIAL nie ma odpowiednika, dodaj do errorDepartments
        if (!errorDepartments.includes(item.DZIAL)) {
          errorDepartments.push(item.DZIAL);
        }
      }
    });

    if (errorDepartments.length > 0) {
      return res.json({ info: `Brak danych o działach: ${errorDepartments}` });
    }

    await connect_SQL.query("TRUNCATE TABLE raportFK_accountancy");

    const values = addDep.map(item => [
      item.NUMER,
      item.KONTRAHENT,
      item.NR_KONTRAHENTA,
      item.DO_ROZLICZENIA,
      item.TERMIN,
      item.KONTO,
      item.TYP_DOKUMENTU,
      item.DZIAL,
    ]);

    const query = `
      INSERT IGNORE INTO raportFK_accountancy
        ( NUMER_FV, KONTRAHENT, NR_KONTRAHENTA, DO_ROZLICZENIA, TERMIN_FV, KONTO, TYP_DOKUMENTU, DZIAL) 
      VALUES 
        ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
    `;

    await connect_SQL.query(query, values.flat());
    // console.log(addDep);

    const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
    const params = ["accountancy", checkDate(new Date()), addDep.length || 0];
    await connect_SQL.query(sql, params);

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
    if (type === "settlements") {
      return settlementsFile(rows, res);
    } else if (type === "becared") {
      return becaredFile(rows, res);
    } else if (type === "rubicon") {
      return rubiconFile(rows, res);
    } else if (type === "accountancy") {
      return accountancyFile(rows, res);
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
  documentsFromFile
};