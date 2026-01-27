const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { b } = require("./manageDocumentAddition");
const { generateDebtNoticePdf } = require("./vindex-utils/letterCreate");
const { calculateCommercialInterest } = require("./payGuard");

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
    // console.log(id_document, document, chatLog);
    res.end();
  } catch (error) {
    logEvents(
      `insuranceController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

//pobieranie pliku pdf
const getLetter = async (req, res) => {
  const { id } = req.query;
  try {
    const [docData] = await connect_SQL.query(
      "SELECT D.NUMER_FV, D.BRUTTO, D.DATA_FV, D.TERMIN, IFNULL(S.NALEZNOSC, 0) AS AS_DO_ROZLICZENIA, IFNULL(FKS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA, D.FAKT_BANK_KONTO, CC.NAZWA_KONTRAHENTA_SLOWNIK, CC.A_PRZEDROSTEK, CC.A_ULICA_EXT, CC.A_NRDOMU, CC.A_NRLOKALU, CC.A_KOD, CC.A_MIASTO, CC.KONTR_NIP FROM company_documents AS D LEFT JOIN company_fk_settlements AS FKS ON D.NUMER_FV = FKS.NUMER_FV AND D.FIRMA = FKS.FIRMA LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY LEFT JOIN company_contractor CC ON D.KONTRAHENT_ID = CC.KONTRAHENT_ID AND D.FIRMA = CC.SPOLKA WHERE D.id_document = ?",
      [id]
    );
    const OPLATA_ZA_OPOZNIENIE = 171.81;

    const xdocData = [
      {
        NUMER_FV: "FV/UP/22/25/D646",
        BRUTTO: 5949.45,
        DATA_FV: "2025-05-22",
        TERMIN: "2025-05-29",
        AS_DO_ROZLICZENIA: 5949.45,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/33/25/D646",
        BRUTTO: 5000.45,
        DATA_FV: "2025-01-22",
        TERMIN: "2025-01-29",
        AS_DO_ROZLICZENIA: 600.45,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/55/25/D646",
        BRUTTO: 9000.45,
        DATA_FV: "2025-03-22",
        TERMIN: "2025-03-29",
        AS_DO_ROZLICZENIA: 8000.45,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/5111/25/D646",
        BRUTTO: 4589,
        DATA_FV: "2025-09-22",
        TERMIN: "2025-09-29",
        AS_DO_ROZLICZENIA: 4589,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/777/25/D646",
        BRUTTO: 4589,
        DATA_FV: "2025-09-22",
        TERMIN: "2025-09-29",
        AS_DO_ROZLICZENIA: 4589,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/55/25/D646",
        BRUTTO: 9000.45,
        DATA_FV: "2025-03-22",
        TERMIN: "2025-03-29",
        AS_DO_ROZLICZENIA: 8000.45,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/5111/25/D646",
        BRUTTO: 4589,
        DATA_FV: "2025-09-22",
        TERMIN: "2025-09-29",
        AS_DO_ROZLICZENIA: 4589,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
      {
        NUMER_FV: "FV/UP/777/25/D646",
        BRUTTO: 4589,
        DATA_FV: "2025-09-22",
        TERMIN: "2025-09-29",
        AS_DO_ROZLICZENIA: 4589,
        FK_DO_ROZLICZENIA: 0,
        FAKT_BANK_KONTO: "98 1020 4027 0000 1102 1967 6037",
        NAZWA_KONTRAHENTA_SLOWNIK:
          '"JNS" SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚCIĄ',
        A_PRZEDROSTEK: "ul.",
        A_ULICA_EXT: "Wróblewskiego",
        A_NRDOMU: "18",
        A_NRLOKALU: null,
        A_KOD: "93-578",
        A_MIASTO: "Łódź",
        KONTR_NIP: "7251891394",
      },
    ];

    const filteredData = await Promise.all(
      docData.map(async (item) => {
        const ODSETKI = await calculateCommercialInterest(
          item.AS_DO_ROZLICZENIA,
          item.TERMIN,
          new Date().toISOString().split("T")[0],
          "single"
        );

        return {
          ...item,
          OPLATA_ZA_OPOZNIENIE,
          ODSETKI,
        };
      })
    );

    const pdfBuffer = await generateDebtNoticePdf(filteredData);

    res.status(200);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="wezwanie.pdf"');
    res.setHeader("Content-Length", pdfBuffer.length);

    // ❗❗❗ KLUCZOWE
    res.end(pdfBuffer);
  } catch (error) {
    logEvents(
      `letterGeneratorController, getLetter: ${error}`,
      "reqServerErrors.txt"
    );
    res.sendStatus(500);
  }
};

module.exports = {
  getDataTable,
  getSingleDocument,
  changeSingleDocument,
  getLetter,
};
