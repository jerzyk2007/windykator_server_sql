const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { b } = require("./manageDocumentAddition");

const getDataSQL = `
SELECT
  D.id_document,
  D.NUMER_FV,
  D.DATA_FV,
   D.TERMIN,
  D.BRUTTO,
   D.NETTO,
    IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA,
  IFNULL(FS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA,
   D.KONTRAHENT,
  D.DZIAL
 FROM company_documents AS D
 LEFT JOIN company_settlements AS S
  ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
  LEFT JOIN company_fk_settlements AS FS
  ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA
`;

// pobiera dane do tabeli w zaleźności od wywołania
const getDataTable = async (req, res) => {
  const { info } = req.params;
  const refreshToken = req.cookies?.jwt;

  if (!refreshToken) {
    return res.status(401).json({ message: "Brak autoryzacji." });
  }

  try {
    const [userRows] = await connect_SQL.query(
      "SELECT company FROM company_users WHERE refreshToken = ?",
      [refreshToken]
    );

    if (!userRows || userRows.length === 0) return res.json([]);

    let companyArray = [];
    const rawCompany = userRows[0].company;

    // Obsługa różnych formatów zapisu kolumny company
    try {
      companyArray =
        typeof rawCompany === "string" ? JSON.parse(rawCompany) : rawCompany;
    } catch (e) {
      companyArray = [rawCompany];
    }

    if (!Array.isArray(companyArray) || companyArray.length === 0) {
      return res.json([]);
    }

    // --- TYMCZASOWA ZMIANA: WYMUSZENIE TYLKO 'KEM' ---
    companyArray = ["KEM"];
    // ------------------------------------------------
    let finalQuery = "";
    let queryParams = [];

    switch (info) {
      case "all-kem":
        // 1. Filtr firm (D.FIRMA IN (?))
        // AND
        // 2. Warunek (S.NALEZNOSC != 0 LUB FS.DO_ROZLICZENIA != 0)
        finalQuery = `
          ${getDataSQL} 
          WHERE D.FIRMA IN (?) 
          AND (IFNULL(S.NALEZNOSC, 0) != 0 OR IFNULL(FS.DO_ROZLICZENIA, 0) != 0)
        `;
        queryParams = [companyArray];
        break;

      default:
        return res.json([]);
    }

    const [data] = await connect_SQL.query(finalQuery, queryParams);
    return res.json(data);
  } catch (error) {
    logEvents(
      `insuranceController, getDataTable: ${error.message}`,
      "reqServerErrors.txt"
    );
    return res.json([]);
  }
};

const getSingleDocument = async (req, res) => {
  const { docID } = req.params;
  try {
    console.log(docID);
    const [singleDocument] = await connect_SQL.query(
      `SELECT
  D.id_document,
  D.NUMER_FV,
  D.DATA_FV,
   D.TERMIN,
  D.BRUTTO,
   D.NETTO,
    IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA,
  IFNULL(FS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA,
   D.KONTRAHENT,
   D.KONTRAHENT_ID,
  D.DZIAL
 FROM company_documents AS D
 LEFT JOIN company_settlements AS S
  ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
  LEFT JOIN company_fk_settlements AS FS
  ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA
    WHERE D.id_document = ?`,
      [docID]
    );
    // res.json(singleDocument.length ? singleDocsingleDocument[0] : {});
    res.json(singleDocument.length ? { singleDoc: singleDocument[0] } : {});
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
    console.log(id_document, document, chatLog);
    res.end();
  } catch (error) {
    logEvents(
      `insuranceController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

module.exports = {
  getDataTable,
  getSingleDocument,
  changeSingleDocument,
};
