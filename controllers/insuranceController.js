const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { mergeJsonLogs } = require("./manageDocumentAddition");

// zapytanie do pobrania danych
const queryTable = "SELECT * FROM company_insurance_documents ";

// pobiera dane do tabeli w zaleźności od wywołania
const getDataTable = async (req, res) => {
  const { info } = req.params;
  try {
    let data = [];
    if (info === "vindication") {
      [data] = await connect_SQL.query(
        `${queryTable} WHERE (STATUS != 'ZAKOŃCZONA' OR STATUS IS NULL)`
      );
    } else if (info === "completed") {
      [data] = await connect_SQL.query(
        `${queryTable} WHERE STATUS = 'ZAKOŃCZONA'`
      );
    } else if (info === "all") {
      [data] = await connect_SQL.query(`${queryTable}`);
    } else if (info === "settled") {
      [data] = await connect_SQL.query(
        `${queryTable} WHERE STATUS = 'ZAKOŃCZONA' AND OW IS NOT NULL`
      );
    } else if (info === "pending") {
      [data] = await connect_SQL.query(
        `${queryTable} WHERE STATUS = 'ZAKOŃCZONA' AND OW IS NULL`
      );
    } else {
      data = [];
    }
    res.json(data);
  } catch (error) {
    logEvents(
      `insuranceController, getDataTable: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const getSingleDocument = async (req, res) => {
  const { docID } = req.params;
  try {
    const [singleDocument] = await connect_SQL.query(
      "SELECT * FROM company_insurance_documents WHERE id_document = ?",
      [docID]
    );
    res.json(singleDocument.length ? singleDocument[0] : {});
  } catch (error) {
    logEvents(
      `insuranceController, getSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const changeSingleDocument = async (req, res) => {
  const { id_document, document, chatLog } = req.body;
  try {
    const [oldData] = await connect_SQL.query(
      "SELECT * FROM company_insurance_documents WHERE id_document = ?",
      [id_document]
    );
    const { mergeChat, mergeLog } = mergeJsonLogs(oldData, chatLog);

    await connect_SQL.query(
      "UPDATE company_insurance_documents SET STATUS = ?, OW = ?, KANAL_KOMUNIKACJI = ?, DZIENNIK_ZMIAN = ?, NALEZNOSC = ? WHERE id_document = ?",
      [
        document.STATUS || null,
        document.OW || null,
        mergeChat.length ? JSON.stringify(mergeChat) : null,
        mergeLog.length ? JSON.stringify(mergeLog) : null,
        document.NALEZNOSC || 0,
        id_document,
      ]
    );

    res.end();
  } catch (error) {
    logEvents(
      `insuranceController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const insertNewDocuments = async (req, res) => {
  const { data } = req.body;
  try {
    const [checkDuplicate] = await connect_SQL.query(
      "SELECT id_document FROM company_insurance_documents WHERE NUMER_POLISY = ?",
      [data.numerDokumentu]
    );

    if (checkDuplicate.length > 0)
      return res
        .status(409)
        .json({ message: `Numer dokumentu istnieje w bazie danych.` });

    const contact = {
      MAIL: [...data.maile],
      TELEFON: [...data.telefony],
    };
    await connect_SQL.query(
      "INSERT INTO company_insurance_documents (NUMER_POLISY, TERMIN_PLATNOSCI, DATA_PRZEKAZANIA, UBEZPIECZYCIEL, KONTRAHENT_NAZWA, KONTRAHENT_ULICA, KONTRAHENT_NR_BUDYNKU, KONTRAHENT_NR_LOKALU, KONTRAHENT_KOD_POCZTOWY, KONTRAHENT_MIASTO, KONTRAHENT_NIP, KONTRAHENT_REGON, DZIAL, NALEZNOSC, OSOBA_ZLECAJACA_WINDYKACJE, KONTAKT_DO_KLIENTA, NR_KONTA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
      [
        data.numerDokumentu,
        data.terminPlatnosci,
        data.dataPrzekazania,
        data.ubezpieczyciel,
        data.kontrahentNazwa,
        data.kontrahentUlica,
        data.kontrahentNrDomu,
        data.kontrahentNrLokalu,
        data.kontrahentKod,
        data.kontrahentMiasto,
        data.kontrahentNip,
        data.kontrahentRegon,
        data.dzial,
        data.kwotaNaleznosci,
        data.osobaZlecajaca,
        JSON.stringify(contact),
        data.konto,
      ]
    );

    res.status(201).json({ message: `Nowy dokument został dodany.` });
  } catch (error) {
    logEvents(
      `insuranceController, insertNewDocuments: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// pobieram możliwe działy dla wprowadzenia polisu
const getDepartments = async (req, res) => {
  try {
    const [result] = await connect_SQL.query(
      'SELECT distinct DEPARTMENT FROM company_join_items WHERE AREA = "F&I"'
    );
    const departments = result.map((item) => item.DEPARTMENT);

    res.json(departments.sort() ?? []);
  } catch (error) {
    logEvents(
      `insuranceController, getDepartments: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const getInsuranceNr = async (req, res) => {
  const { search } = req.query;
  try {
    const [result] = await connect_SQL.query(
      `SELECT * FROM company_insurance_documents  WHERE NUMER_POLISY LIKE '%${search}%'`
    );
    res.json(result ?? []);
  } catch (error) {
    logEvents(
      `insuranceController, getInsuranceNr: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const editSingleDocument = async (req, res) => {
  const { id, data } = req.body;
  try {
    const contact = {
      MAIL: [...data.maile],
      TELEFON: [...data.telefony],
    };
    await connect_SQL.query(
      "UPDATE company_insurance_documents SET NUMER_POLISY = ?, TERMIN_PLATNOSCI = ?, DATA_PRZEKAZANIA = ?, UBEZPIECZYCIEL = ?, KONTRAHENT_NAZWA = ?, KONTRAHENT_ULICA = ?, KONTRAHENT_NR_BUDYNKU = ?, KONTRAHENT_NR_LOKALU = ?, KONTRAHENT_KOD_POCZTOWY = ?, KONTRAHENT_MIASTO = ?, KONTRAHENT_NIP = ?, KONTRAHENT_REGON = ?, DZIAL = ?, NALEZNOSC = ?, OSOBA_ZLECAJACA_WINDYKACJE = ?, KONTAKT_DO_KLIENTA = ?, NR_KONTA = ? WHERE id_document = ?",
      [
        data.numerDokumentu,
        data.terminPlatnosci,
        data.dataPrzekazania,
        data.ubezpieczyciel,
        data.kontrahentNazwa,
        data.kontrahentUlica,
        data.kontrahentNrDomu,
        data.kontrahentNrLokalu,
        data.kontrahentKod,
        data.kontrahentMiasto,
        data.kontrahentNip,
        data.kontrahentRegon,
        data.dzial,
        data.kwotaNaleznosci,
        data.osobaZlecajaca,
        JSON.stringify(contact),
        data.konto,
        id,
      ]
    );
    res.status(201).json({ message: `Dane zostały zmienione.` });
  } catch (error) {
    logEvents(
      `insuranceController, editSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

module.exports = {
  getDataTable,
  getSingleDocument,
  changeSingleDocument,
  insertNewDocuments,
  getDepartments,
  getInsuranceNr,
  editSingleDocument,
};
