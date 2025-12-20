const { logEvents } = require("../middleware/logEvents");
const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { userProfile } = require("./manageDocumentAddition");

const getAllDocumentsSQL = `
SELECT
  IFNULL(JI.area, 'BRAK') AS AREA,
  D.id_document,
  D.NUMER_FV,
  D.BRUTTO,
  D.TERMIN,
  D.NETTO,
  IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA,
  IFNULL(FS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA,
  D.DZIAL,
  D.DATA_FV,
  D.KONTRAHENT,
  D.DORADCA,
  D.NR_REJESTRACYJNY,
  D.NR_SZKODY,
  D.UWAGI_Z_FAKTURY,
  UPPER(D.TYP_PLATNOSCI) AS TYP_PLATNOSCI,
  D.NIP,
  D.VIN,
  DATEDIFF(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE,
  ROUND((D.BRUTTO - D.NETTO), 2) AS VAT_100,
  ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS VAT_50,
  IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,
  D.FIRMA,
  IFNULL(UPPER(R.FIRMA_ZEWNETRZNA), 'BRAK') AS JAKA_KANCELARIA,
  IFNULL(UPPER(DA.STATUS_SPRAWY_KANCELARIA), 'BRAK') AS STATUS_SPRAWY_KANCELARIA,
  IFNULL(UPPER(R.STATUS_AKTUALNY), 'BRAK') AS STATUS_AKTUALNY,
  DA.id_action,
  DA.document_id,
  IFNULL(DA.DZIALANIA, 'BRAK') AS DZIALANIA,
  IFNULL(
    IF(DA.KOMENTARZ_KANCELARIA_BECARED IS NOT NULL, 'KOMENTARZ ...', NULL),
    'BRAK'
  ) AS KOMENTARZ_KANCELARIA_BECARED,
  DA.KWOTA_WINDYKOWANA_BECARED,
  IFNULL(DA.NUMER_SPRAWY_BECARED, 'BRAK') AS NUMER_SPRAWY_BECARED,
  IFNULL(DA.POBRANO_VAT, 'Nie dotyczy') AS POBRANO_VAT,
  IFNULL(UPPER(DA.STATUS_SPRAWY_KANCELARIA), 'BRAK') AS STATUS_SPRAWY_KANCELARIA,
  IFNULL(UPPER(DA.STATUS_SPRAWY_WINDYKACJA), 'BRAK') AS STATUS_SPRAWY_WINDYKACJA,
  IFNULL(DA.ZAZNACZ_KONTRAHENTA, 'NIE') AS ZAZNACZ_KONTRAHENTA,
  DA.KANAL_KOMUNIKACJI,
  IFNULL(DA.BLAD_DORADCY, 'NIE') AS BLAD_DORADCY,
  IFNULL(DA.DATA_KOMENTARZA_BECARED, 'BRAK') AS DATA_KOMENTARZA_BECARED,
  DA.DATA_WYDANIA_AUTA,
  IFNULL(DA.OSTATECZNA_DATA_ROZLICZENIA, 'BRAK') AS OSTATECZNA_DATA_ROZLICZENIA,
  DA.INFORMACJA_ZARZAD,
  IFNULL(DA.JAKA_KANCELARIA_TU, 'BRAK') AS JAKA_KANCELARIA_TU,
  DA.KRD
FROM company_documents AS D
LEFT JOIN company_documents_actions AS DA
  ON D.id_document = DA.document_id
LEFT JOIN company_settlements AS S
  ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
LEFT JOIN company_fk_settlements AS FS
  ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA
LEFT JOIN company_rubicon_data AS R
  ON R.NUMER_FV = D.NUMER_FV
LEFT JOIN company_mark_documents AS MD
  ON D.NUMER_FV = MD.NUMER_FV AND D.FIRMA = MD.COMPANY
LEFT JOIN company_join_items AS JI
  ON D.DZIAL = JI.department
`;

//pobiera faktury wg upranień uzytkownika z uwględnienień actual/archive/all SQL
const getDataDocuments = async (id_user, info, profile) => {
  const userType = userProfile(profile);

  try {
    const [findUser] = await connect_SQL.query(
      "SELECT departments FROM company_users WHERE id_user = ?",
      [id_user]
    );

    const { departments = {} } = findUser[0] || {};
    const allDepartments = departments[userType] || [];

    if (!allDepartments.length) {
      return { data: [] };
    }

    const permissionCondition = `(${allDepartments
      .map(
        (dep) =>
          `(D.DZIAL = '${dep.department}' AND D.FIRMA = '${dep.company}')`
      )
      .join(" OR ")})`;

    const filters = {
      actual: "AND S.NALEZNOSC > 0",
      obligations: "AND S.NALEZNOSC < 0",
      archive: "AND (S.NALEZNOSC = 0 OR S.NALEZNOSC IS NULL)",
      all: "",
      raport_fk: "AND MD.RAPORT_FK = 1",
      disabled_fk: "AND MD.RAPORT_FK = 0",
      krd: "AND DA.KRD IS NOT NULL",
      critical: `
        AND S.NALEZNOSC > 0
        AND D.TERMIN <= DATE_ADD(CURDATE(), INTERVAL 3 DAY)
        AND R.FIRMA_ZEWNETRZNA IS NULL
        AND DA.JAKA_KANCELARIA_TU IS NULL
        AND (DA.DZIALANIA != 'WINDYKACJA WEWNĘTRZNA' OR DA.DZIALANIA IS NULL)
      `,
      "control-bl": `
        AND JI.area = 'BLACHARNIA'
        AND S.NALEZNOSC > 0
        AND DA.JAKA_KANCELARIA_TU IS NULL
        AND R.FIRMA_ZEWNETRZNA IS NULL
        AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY)
        AND (DA.DZIALANIA != 'WINDYKACJA WEWNĘTRZNA' OR DA.DZIALANIA IS NULL)
      `,
      different: `
        AND (IFNULL(S.NALEZNOSC, 0) - IFNULL(FS.DO_ROZLICZENIA, 0)) <> 0
      `,
    };

    if (!filters.hasOwnProperty(info)) {
      return { data: [] };
    }

    const finalQuery = `
      ${getAllDocumentsSQL}
      WHERE ${permissionCondition}
      ${filters[info]}
    `;

    const [filteredData] = await connect_SQL.query(finalQuery);

    return { data: filteredData };
  } catch (error) {
    logEvents(`documentsController: ${error}`, "reqServerErrors.txt");
    return { data: [] };
  }
};

//SQL zmienia tylko pojedyńczy dokument, w tabeli BL po edycji wiersza
// funkcja zmieniająca dane w poszczególnym dokumncie (editRowTable)
const changeSingleDocument = async (req, res) => {
  // const { id_document, documentItem, changeDeps, lawFirmData } = req.body;
  const { id_document, document, chatLog } = req.body;

  try {
    if (document?.DZIAL) {
      await connect_SQL.query(
        "UPDATE company_documents SET DZIAL = ? WHERE id_document = ?",
        [document.DZIAL, id_document]
      );
    }

    const [oldData] = await connect_SQL.query(
      "SELECT * FROM company_documents_actions WHERE document_id = ?",
      [id_document]
    );

    // łącze stare i nowe dane czatu
    const oldChatDoc = oldData[0]?.KANAL_KOMUNIKACJI
      ? oldData[0].KANAL_KOMUNIKACJI
      : [];
    const newChat = chatLog?.documents?.KANAL_KOMUNIKACJI?.length
      ? chatLog.documents.KANAL_KOMUNIKACJI
      : [];

    const mergeChat = [...(oldChatDoc ?? []), ...(newChat ?? [])];

    // łącze stare i nowe dane logów zdarzeń
    const oldLogDoc = oldData[0]?.DZIENNIK_ZMIAN
      ? oldData[0].DZIENNIK_ZMIAN
      : [];
    const newLog = chatLog?.documents?.DZIENNIK_ZMIAN?.length
      ? chatLog.documents.DZIENNIK_ZMIAN
      : [];

    const mergeLog = [...(oldLogDoc ?? []), ...(newLog ?? [])];

    const [documents_actionsExist] = await connect_SQL.query(
      "SELECT id_action from company_documents_actions WHERE document_id = ?",
      [id_document]
    );

    // if (documents_actionsExist[0]?.id_action) {
    //   await connect_SQL.query(
    //     "UPDATE company_documents_actions SET KANAL_KOMUNIKACJI = ?, DZIENNIK_ZMIAN = ?  WHERE document_id = ?",
    //     [
    //       mergeChat.length ? JSON.stringify(mergeChat) : null,
    //       mergeLog.length ? JSON.stringify(mergeLog) : null,
    //       id_document,
    //     ]
    //   );
    // } else {
    //   await connect_SQL.query(
    //     "INSERT INTO company_documents_actions (document_id, KANAL_KOMUNIKACJI, DZIENNIK_ZMIAN) VALUES (?, ?, ?)",
    //     [
    //       id_document,
    //       mergeChat.length ? JSON.stringify(mergeChat) : null,
    //       mergeLog.length ? JSON.stringify(mergeLog) : null,
    //     ]
    //   );
    // }

    // console.log(document);

    if (documents_actionsExist[0]?.id_action) {
      await connect_SQL.query(
        "UPDATE company_documents_actions SET DZIALANIA = ?, JAKA_KANCELARIA_TU = ?, POBRANO_VAT = ?, ZAZNACZ_KONTRAHENTA = ?, BLAD_DORADCY = ?, DATA_WYDANIA_AUTA = ?, OSTATECZNA_DATA_ROZLICZENIA = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ?, INFORMACJA_ZARZAD = ?, KRD = ?, KANAL_KOMUNIKACJI = ?, DZIENNIK_ZMIAN = ?   WHERE document_id = ?",

        [
          document.DZIALANIA && document.DZIALANIA !== "BRAK"
            ? document.DZIALANIA
            : null,
          document.JAKA_KANCELARIA_TU && document.JAKA_KANCELARIA_TU !== "BRAK"
            ? document.JAKA_KANCELARIA_TU
            : null,
          document.POBRANO_VAT && document.POBRANO_VAT !== "BRAK"
            ? document.POBRANO_VAT
            : null,
          document.ZAZNACZ_KONTRAHENTA && document.ZAZNACZ_KONTRAHENTA === "TAK"
            ? document.ZAZNACZ_KONTRAHENTA
            : null,
          document.BLAD_DORADCY && document.BLAD_DORADCY === "TAK"
            ? document.BLAD_DORADCY
            : null,
          document.DATA_WYDANIA_AUTA && document.DATA_WYDANIA_AUTA !== "BRAK"
            ? document.DATA_WYDANIA_AUTA
            : null,
          document?.OSTATECZNA_DATA_ROZLICZENIA &&
          document.OSTATECZNA_DATA_ROZLICZENIA !== "BRAK"
            ? document.OSTATECZNA_DATA_ROZLICZENIA
            : null,
          document.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            ? JSON.stringify(document.HISTORIA_ZMIANY_DATY_ROZLICZENIA)
            : null,
          document.INFORMACJA_ZARZAD
            ? JSON.stringify(document.INFORMACJA_ZARZAD)
            : null,
          document.KRD && document.KRD !== "BRAK" ? document.KRD : null,
          mergeChat.length ? JSON.stringify(mergeChat) : null,
          mergeLog.length ? JSON.stringify(mergeLog) : null,
          id_document,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO company_documents_actions (document_id, DZIALANIA, JAKA_KANCELARIA_TU, POBRANO_VAT, ZAZNACZ_KONTRAHENTA, BLAD_DORADCY, DATA_WYDANIA_AUTA,OSTATECZNA_DATA_ROZLICZENIA, HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD, KRD, KANAL_KOMUNIKACJI, DZIENNIK_ZMIAN) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id_document,
          document.DZIALANIA && document.DZIALANIA !== "BRAK"
            ? document.DZIALANIA
            : null,
          document.JAKA_KANCELARIA_TU && document.JAKA_KANCELARIA_TU !== "BRAK"
            ? document.JAKA_KANCELARIA_TU
            : null,
          document.POBRANO_VAT && document.POBRANO_VAT !== "BRAK"
            ? document.POBRANO_VAT
            : null,
          document.ZAZNACZ_KONTRAHENTA && document.ZAZNACZ_KONTRAHENTA === "TAK"
            ? document.ZAZNACZ_KONTRAHENTA
            : null,
          document.BLAD_DORADCY && document.BLAD_DORADCY === "TAK"
            ? document.BLAD_DORADCY
            : null,
          document.DATA_WYDANIA_AUTA && document.DATA_WYDANIA_AUTA !== "BRAK"
            ? document.DATA_WYDANIA_AUTA
            : null,
          document?.OSTATECZNA_DATA_ROZLICZENIA &&
          document.OSTATECZNA_DATA_ROZLICZENIA !== "BRAK"
            ? document.OSTATECZNA_DATA_ROZLICZENIA
            : null,
          document.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            ? JSON.stringify(document.HISTORIA_ZMIANY_DATY_ROZLICZENIA)
            : null,
          document.INFORMACJA_ZARZAD
            ? JSON.stringify(document.INFORMACJA_ZARZAD)
            : null,
          document.KRD && document.KRD !== "BRAK" ? document.KRD : null,
          mergeChat.length ? JSON.stringify(mergeChat) : null,
          mergeLog.length ? JSON.stringify(mergeLog) : null,
        ]
      );
    }
    // if (lawFirmData.zapisz) {
    //   await connect_SQL.query(
    //     "INSERT IGNORE INTO company_law_documents (NUMER_DOKUMENTU, KONTRAHENT, NAZWA_KANCELARII, KWOTA_ROSZCZENIA_DO_KANCELARII, KWOTA_BRUTTO_DOKUMENTU, FIRMA) VALUES (?, ?, ?, ?, ?, ?) ",
    //     [
    //       lawFirmData.numerFv,
    //       lawFirmData.kontrahent,
    //       lawFirmData.kancelaria,
    //       lawFirmData.kwotaRoszczenia,
    //       lawFirmData.kwota_brutto,
    //       lawFirmData.firma,
    //     ]
    //   );
    // }
    res.end();
  } catch (error) {
    logEvents(
      `documentsController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// pobiera dostępne nazwy działów dla BL - funkcja dla zmiany działu w BL
const getAvailableDeps = async (req, res) => {
  // const { id_document, documentItem } = req.body;

  try {
    const [departments] = await connect_SQL.query(
      `SELECT distinct DEPARTMENT FROM company_join_items WHERE  AREA = 'BLACHARNIA' AND COMPANY = ?`,
      [req.params.company]
    );
    const filteredDeps =
      Array.isArray(departments) && departments.length > 0
        ? departments.map((d) => d.DEPARTMENT).filter((dep) => dep !== "D208")
        : []; // jeśli tablica pusta lub nie istnieje, zwróć pustą tablicę

    res.json(filteredDeps);
  } catch (error) {
    logEvents(
      `documentsController, getAvailableDeps: ${error}`,
      "reqServerErrors.txt"
    );
  }
};
// SQL pobieram dane do tabeli
const getDataTable = async (req, res) => {
  const { id_user, info, profile } = req.params;
  if (!id_user || !info || !profile) {
    return res
      .status(400)
      .json({ message: "Id, info and profile are required." });
  }
  try {
    const result = await getDataDocuments(id_user, info, profile);

    res.json(result.data);
  } catch (error) {
    logEvents(
      `documentsController, getDataTable: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera pojedyńczy dokument SQL
const getSingleDocument = async (req, res) => {
  const { id_document } = req.params;
  try {
    const [singleDoc] = await connect_SQL.query(
      `SELECT D.id_document, D.NUMER_FV, D.BRUTTO, IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA,  D.TERMIN, 
    D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, 
    D.NR_SZKODY, D.NR_AUTORYZACJI, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, 
    D.VIN, D.FIRMA, DA.*, SD.OPIS_ROZRACHUNKU,  SD.DATA_ROZL_AS, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, 
    ROUND((D.BRUTTO - D.NETTO), 2) AS 'VAT_100',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS 'VAT_50', 
    IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE, JI.area AS AREA, UPPER(R.FIRMA_ZEWNETRZNA) AS JAKA_KANCELARIA, 
    R.STATUS_AKTUALNY, FZAL.FV_ZALICZKOWA, FZAL.KWOTA_BRUTTO AS KWOTA_FV_ZAL, MD.NUMER_FV AS MARK_FV, MD.RAPORT_FK AS MARK_FK,
    CLD.DATA_PRZEKAZANIA_SPRAWY AS DATA_PRZEKAZANIA_SPRAWY_DO_KANCELARII
    FROM company_documents AS D 
    LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id 
    LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY
    LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department
    LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
    LEFT JOIN company_rubicon_data AS R ON R.NUMER_FV = D.NUMER_FV
    LEFT JOIN company_fv_zaliczkowe AS FZAL ON D.NUMER_FV = FZAL.NUMER_FV AND D.FIRMA = FZAL.COMPANY
    LEFT JOIN company_mark_documents AS MD ON D.NUMER_FV = MD.NUMER_FV AND D.FIRMA = MD.COMPANY
    LEFT JOIN company_fk_settlements AS FS ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA
    LEFT JOIN company_law_documents AS CLD ON D.NUMER_FV = CLD.NUMER_DOKUMENTU AND D.FIRMA = CLD.FIRMA
    WHERE D.id_document = ?`,
      [id_document]
    );

    const [controlDoc] = await connect_SQL.query(
      `SELECT * FROM company_control_documents WHERE NUMER_FV = ? AND COMPANY = ?`,
      [singleDoc[0].NUMER_FV, singleDoc[0].FIRMA]
    );

    const [extLaw] = await connect_SQL.query(
      "SELECT EXT_COMPANY FROM company_settings;"
    );

    res.json({
      singleDoc: singleDoc[0],
      controlDoc: controlDoc[0] ? controlDoc[0] : {},
      lawPartner: extLaw[0]?.EXT_COMPANY ? extLaw[0].EXT_COMPANY : [],
    });
  } catch (error) {
    logEvents(
      `documentsController, getSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// SQL pobieram nazwy kolumn do sutawień tabeli
const getColumnsName = async (req, res) => {
  try {
    const [result] = await connect_SQL.query(
      "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, SD.OPIS_ROZRACHUNKU,  datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS 'VAT_100',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS 'VAT_50', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM company_documents AS D LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LIMIT 1"
    );

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
    res.json(newArray);
  } catch (error) {
    logEvents(
      `documentsController, getColumnsName: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// zapis chatu z kontroli dokumentacji
const changeControlChat = async (req, res) => {
  const { NUMER_FV, chat, FIRMA } = req.body;

  try {
    const [findDoc] = await connect_SQL.query(
      "SELECT NUMER_FV FROM company_control_documents WHERE NUMER_FV = ? AND COMPANY = ?",
      [NUMER_FV, FIRMA]
    );
    if (findDoc[0]?.NUMER_FV) {
      await connect_SQL.query(
        "UPDATE company_control_documents SET CONTROL_UWAGI = ? WHERE NUMER_FV = ?",
        [JSON.stringify(chat), NUMER_FV]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO company_control_documents (NUMER_FV, CONTROL_UWAGI, COMPANY) VALUES (?, ?, ?)",
        [NUMER_FV, JSON.stringify(chat), FIRMA]
      );
    }
    res.end();
  } catch (error) {
    logEvents(
      `documentsController, changeControlChat: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// pobiera dane  kontroli dokumentacji
const getDataDocumentsControl = async (req, res) => {
  try {
    const { doc_nr } = req.params;
    const [doc_control] = await connect_SQL.query(
      "SELECT * FROM company_control_documents WHERE NUMER_FV = ?",
      [doc_nr]
    );
    if (doc_control.length) {
      res.json(doc_control[0]);
    } else {
      res.json(doc_control);
    }
  } catch (error) {
    logEvents(
      `documentsController, getControlChat: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// zapis chatu z kontroli dokumentacji
const changeDocumentControl = async (req, res) => {
  const { NUMER_FV, documentControlBL, FIRMA, chatLog } = req.body;
  try {
    const [findDoc] = await connect_SQL.query(
      "SELECT NUMER_FV, DZIENNIK_ZMIAN, KANAL_KOMUNIKACJI FROM company_control_documents WHERE NUMER_FV = ?",
      [NUMER_FV]
    );

    //  const [oldData] = await connect_SQL.query(
    //   "SELECT * FROM company_documents_actions WHERE document_id = ?",
    //   [id_document]
    // );

    // łącze stare i nowe dane czatu
    const oldChatDoc = findDoc[0]?.KANAL_KOMUNIKACJI
      ? findDoc[0].KANAL_KOMUNIKACJI
      : [];
    const newChat = chatLog?.KANAL_KOMUNIKACJI?.length
      ? chatLog.KANAL_KOMUNIKACJI
      : [];

    const mergeChat = [...(oldChatDoc ?? []), ...(newChat ?? [])];

    // łącze stare i nowe dane logów zdarzeń
    const oldLogDoc = findDoc[0]?.DZIENNIK_ZMIAN
      ? findDoc[0].DZIENNIK_ZMIAN
      : [];
    const newLog = chatLog?.DZIENNIK_ZMIAN?.length
      ? chatLog.DZIENNIK_ZMIAN
      : [];

    const mergeLog = [...(oldLogDoc ?? []), ...(newLog ?? [])];
    if (findDoc[0]?.NUMER_FV) {
      await connect_SQL.query(
        `UPDATE company_control_documents SET
    CONTROL_ODPOWIEDZIALNOSC = ?,
    CONTROL_DECYZJA = ?,
    CONTROL_DOW_REJ = ?,
    CONTROL_BRAK_DZIALAN_OD_OST = ?,
    CONTROL_FV = ?,
    CONTROL_OSW_VAT = ?,
    CONTROL_PLATNOSC_VAT = ?,
    CONTROL_POLISA = ?,
    CONTROL_PR_JAZ = ?,
    CONTROL_UPOW = ?,
    DZIENNIK_ZMIAN = ?,
    KANAL_KOMUNIKACJI = ?,
    NUMER_FV = ?
   WHERE NUMER_FV = ? AND COMPANY = ?`,
        [
          documentControlBL.CONTROL_ODPOWIEDZIALNOSC ?? null,
          documentControlBL.CONTROL_DECYZJA ?? null,
          documentControlBL.CONTROL_DOW_REJ ?? null,
          documentControlBL.CONTROL_BRAK_DZIALAN_OD_OST ?? null,
          documentControlBL.CONTROL_FV ?? null,
          documentControlBL.CONTROL_OSW_VAT ?? null,
          documentControlBL.CONTROL_PLATNOSC_VAT ?? null,
          documentControlBL.CONTROL_POLISA ?? null,
          documentControlBL.CONTROL_PR_JAZ ?? null,
          documentControlBL.CONTROL_UPOW ?? null,
          mergeLog ? JSON.stringify(mergeLog) : null,
          mergeChat ? JSON.stringify(mergeChat) : null,
          documentControlBL.NUMER_FV ?? null,
          NUMER_FV,
          FIRMA,
        ]
      );
    } else {
      await connect_SQL.query(
        `INSERT INTO company_control_documents (
    COMPANY,
    CONTROL_ODPOWIEDZIALNOSC,
    CONTROL_DECYZJA,
    CONTROL_DOW_REJ,
    CONTROL_BRAK_DZIALAN_OD_OST,
    CONTROL_FV,
    CONTROL_OSW_VAT,
    CONTROL_PLATNOSC_VAT,
    CONTROL_POLISA,
    CONTROL_PR_JAZ,
    CONTROL_UPOW,
    DZIENNIK_ZMIAN,
    KANAL_KOMUNIKACJI,
    NUMER_FV
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          FIRMA ?? null,
          documentControlBL.CONTROL_ODPOWIEDZIALNOSC ?? null,
          documentControlBL.CONTROL_DECYZJA ?? null,
          documentControlBL.CONTROL_DOW_REJ ?? null,
          documentControlBL.CONTROL_BRAK_DZIALAN_OD_OST ?? null,
          documentControlBL.CONTROL_FV ?? null,
          documentControlBL.CONTROL_OSW_VAT ?? null,
          documentControlBL.CONTROL_PLATNOSC_VAT ?? null,
          documentControlBL.CONTROL_POLISA ?? null,
          documentControlBL.CONTROL_PR_JAZ ?? null,
          documentControlBL.CONTROL_UPOW ?? null,
          mergeLog ? JSON.stringify(mergeLog) : null,
          mergeChat ? JSON.stringify(mergeChat) : null,
          NUMER_FV ?? null,
        ]
      );
    }
    res.end();
  } catch (error) {
    logEvents(
      `documentsController, changeDocumentControl: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
  }
};

module.exports = {
  // getAllDocuments,
  changeSingleDocument,
  getDataTable,
  getDataDocuments,
  getSingleDocument,
  getColumnsName,
  changeControlChat,
  getDataDocumentsControl,
  changeDocumentControl,
  getAvailableDeps,
};
