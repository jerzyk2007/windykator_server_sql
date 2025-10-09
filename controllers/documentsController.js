const { logEvents } = require("../middleware/logEvents");
const { connect_SQL, msSqlQuery } = require("../config/dbConn");
// const { addDepartment } = require('./manageDocumentAddition');

const getAllDocumentsSQL =
  "SELECT IFNULL(JI.area, 'BRAK') as AREA, D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA, IFNULL(FS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA, CASE WHEN (IFNULL(S.NALEZNOSC, 0) - IFNULL(FS.DO_ROZLICZENIA, 0)) <> 0 THEN 'TAK'     ELSE 'NIE' END AS ROZNICA_AS_FK, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, UPPER(D.TYP_PLATNOSCI) AS TYP_PLATNOSCI, D.NIP, D.VIN,  datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT', ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE, D.FIRMA, IFNULL(UPPER(R.FIRMA_ZEWNETRZNA), 'BRAK') AS JAKA_KANCELARIA,  R.STATUS_AKTUALNY, DA.id_action, DA.document_id, IFNULL(DA.DZIALANIA, 'BRAK') AS DZIALANIA, IFNULL(IF(DA.KOMENTARZ_KANCELARIA_BECARED IS NOT NULL, 'KOMENTARZ ...', NULL), 'BRAK') AS KOMENTARZ_KANCELARIA_BECARED, KWOTA_WINDYKOWANA_BECARED, IFNULL(DA.NUMER_SPRAWY_BECARED, 'BRAK') AS NUMER_SPRAWY_BECARED,   IFNULL(DA.POBRANO_VAT, 'Nie dotyczy') AS POBRANO_VAT, IFNULL(UPPER(DA.STATUS_SPRAWY_KANCELARIA), 'BRAK') AS STATUS_SPRAWY_KANCELARIA, IFNULL(UPPER(DA.STATUS_SPRAWY_WINDYKACJA), 'BRAK') AS STATUS_SPRAWY_WINDYKACJA, IFNULL(DA.ZAZNACZ_KONTRAHENTA, 'NIE') AS ZAZNACZ_KONTRAHENTA,  DA.UWAGI_ASYSTENT, IFNULL(DA.BLAD_DORADCY, 'NIE') AS BLAD_DORADCY, IFNULL(DA.DATA_KOMENTARZA_BECARED, 'BRAK') AS DATA_KOMENTARZA_BECARED, DA.DATA_WYDANIA_AUTA, IFNULL(DA.OSTATECZNA_DATA_ROZLICZENIA, 'BRAK') AS OSTATECZNA_DATA_ROZLICZENIA,  IFNULL( DA.INFORMACJA_ZARZAD , 'BRAK' ) AS INFORMACJA_ZARZAD, IFNULL(DA.JAKA_KANCELARIA_TU, 'BRAK') AS JAKA_KANCELARIA_TU, DA.KRD   FROM company_documents AS D LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_rubicon_data AS R ON R.NUMER_FV = D.NUMER_FV LEFT JOIN company_mark_documents AS MD ON D.NUMER_FV = MD.NUMER_FV AND D.FIRMA = MD.COMPANY LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department LEFT JOIN company_fk_settlements AS FS ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA";

//pobiera faktury wg upranień uzytkownika z uwględnienień actual/archive/all SQL
const getDataDocuments = async (id_user, info) => {
  let filteredData = [];
  try {
    const [findUser] = await connect_SQL.query(
      "SELECT  permissions, username, usersurname, departments FROM company_users WHERE id_user = ?",
      [id_user]
    );
    const {
      permissions = {},
      username,
      usersurname,
      departments = [],
    } = findUser[0] || {};

    // jeśli użytkownik nie ma nadanych dostępów i działów to zwraca puste dane
    if (
      !permissions ||
      typeof permissions !== "object" ||
      (Object.keys(permissions).length === 0 &&
        (!Array.isArray(departments) || departments.length === 0))
    ) {
      return { data: [], permission: [] };
    }

    const truePermissions = Object.keys(permissions).filter(
      (permission) => permissions[permission]
    );

    // dopisuje do zapytania dostęp tylko do działow zadeklarowanych
    const sqlCondition =
      departments?.length > 0
        ? `(${departments
            .map(
              (dep) =>
                `D.DZIAL = '${dep.department}' AND D.FIRMA ='${dep.company}' `
            )
            .join(" OR ")})`
        : null;

    const DORADCA = `${usersurname} ${username}`;

    if (info === "actual") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND D.DORADCA =  '${DORADCA}'`
        );
      }
    } else if (info === "critical") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND DATEDIFF(NOW(), D.TERMIN) >= -3  AND R.FIRMA_ZEWNETRZNA IS NULL AND DA.JAKA_KANCELARIA_TU IS NULL AND ${sqlCondition}`
          // `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND DATEDIFF(NOW(), D.TERMIN) >= -3  AND R.FIRMA_ZEWNETRZNA IS NULL AND DA.JAKA_KANCELARIA_TU IS NULL AND AND D.DORADCA =  '${DORADCA}'`
        );
      }
    } else if (info === "obligations") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) < 0 AND ${sqlCondition}`
          // `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) > 0 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) < 0 AND D.DORADCA =  '${DORADCA}'`
        );
      }
    } else if (info === "archive") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) = 0 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE IFNULL(S.NALEZNOSC, 0) = 0 AND D.DORADCA =  '${DORADCA}'`
        );
      }
    } else if (info === "all") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE  D.DORADCA = '${DORADCA}'`
        );
      }
    } else if (info === "raport_fk") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE MD.RAPORT_FK = 1 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        // [filteredData] = await connect_SQL.query(`${getAllDocumentsSQL} WHERE  D.DORADCA = '${DORADCA}'`);
        filteredData = [];
      }
    } else if (info === "disabled_fk") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE MD.RAPORT_FK = 0 AND ${sqlCondition}`
        );
      } else if (truePermissions[0] === "Basic") {
        // [filteredData] = await connect_SQL.query(`${getAllDocumentsSQL} WHERE  D.DORADCA = '${DORADCA}'`);
        filteredData = [];
      }
    } else if (info === "control-bl") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE JI.area = 'BLACHARNIA' AND  ${sqlCondition} AND S.NALEZNOSC > 0 AND DA.JAKA_KANCELARIA_TU IS NULL AND R.FIRMA_ZEWNETRZNA IS NULL AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY)`
        );
      } else if (truePermissions[0] === "Basic") {
        filteredData = [];
      }
    } else if (info === "krd") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE  ${sqlCondition} AND DA.KRD IS NOT NULL`
        );
      } else if (truePermissions[0] === "Basic") {
        filteredData = [];
      }
    } else if (info === "different") {
      if (truePermissions[0] === "Standard") {
        [filteredData] = await connect_SQL.query(
          `${getAllDocumentsSQL} WHERE  ${sqlCondition} AND (IFNULL(S.NALEZNOSC, 0) - IFNULL(FS.DO_ROZLICZENIA, 0)) <> 0`
        );
      } else if (truePermissions[0] === "Basic") {
        filteredData = [];
      }
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
    res.status(500).json({ error: "Server error" });
  }
};

//SQL zmienia tylko pojedyńczy dokument, w tabeli BL po edycji wiersza
// funkcja zmieniająca dane w poszczególnym dokumncie (editRowTable)
const changeSingleDocument = async (req, res) => {
  const { id_document, documentItem, changeDeps } = req.body;

  try {
    if (changeDeps) {
      await connect_SQL.query(
        "UPDATE company_documents SET DZIAL = ? WHERE id_document = ?",
        [changeDeps, id_document]
      );
    }

    const [documents_actionsExist] = await connect_SQL.query(
      "SELECT id_action from company_documents_actions WHERE document_id = ?",
      [id_document]
    );

    if (documents_actionsExist[0]?.id_action) {
      await connect_SQL.query(
        "UPDATE company_documents_actions SET DZIALANIA = ?, JAKA_KANCELARIA_TU = ?, POBRANO_VAT = ?, ZAZNACZ_KONTRAHENTA = ?, UWAGI_ASYSTENT = ?, BLAD_DORADCY = ?, DATA_WYDANIA_AUTA = ?, OSTATECZNA_DATA_ROZLICZENIA = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ?, INFORMACJA_ZARZAD = ?, KRD = ?  WHERE document_id = ?",
        [
          documentItem.DZIALANIA && documentItem.DZIALANIA !== "BRAK"
            ? documentItem.DZIALANIA
            : null,
          documentItem.JAKA_KANCELARIA_TU &&
          documentItem.JAKA_KANCELARIA_TU !== "BRAK"
            ? documentItem.JAKA_KANCELARIA_TU
            : null,
          documentItem.POBRANO_VAT,
          documentItem.ZAZNACZ_KONTRAHENTA &&
          documentItem.ZAZNACZ_KONTRAHENTA === "TAK"
            ? documentItem.ZAZNACZ_KONTRAHENTA
            : null,
          JSON.stringify(documentItem.UWAGI_ASYSTENT),
          documentItem.BLAD_DORADCY && documentItem.BLAD_DORADCY === "TAK"
            ? documentItem.BLAD_DORADCY
            : null,
          documentItem.DATA_WYDANIA_AUTA &&
          documentItem.DATA_WYDANIA_AUTA !== "BRAK"
            ? documentItem.DATA_WYDANIA_AUTA
            : null,
          documentItem?.OSTATECZNA_DATA_ROZLICZENIA &&
          documentItem.OSTATECZNA_DATA_ROZLICZENIA !== "BRAK"
            ? documentItem.OSTATECZNA_DATA_ROZLICZENIA
            : null,
          documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            ? JSON.stringify(documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA)
            : documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA,
          documentItem.INFORMACJA_ZARZAD
            ? JSON.stringify(documentItem.INFORMACJA_ZARZAD)
            : null,
          documentItem.KRD && documentItem.KRD !== "BRAK"
            ? documentItem.KRD
            : null,
          id_document,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO company_documents_actions (document_id, DZIALANIA, JAKA_KANCELARIA_TU, POBRANO_VAT, ZAZNACZ_KONTRAHENTA, UWAGI_ASYSTENT, BLAD_DORADCY, DATA_WYDANIA_AUTA,OSTATECZNA_DATA_ROZLICZENIA, HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD, KRD) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          id_document,
          documentItem.DZIALANIA && documentItem.DZIALANIA !== "BRAK"
            ? documentItem.DZIALANIA
            : null,
          documentItem.JAKA_KANCELARIA_TU &&
          documentItem.JAKA_KANCELARIA_TU !== "BRAK"
            ? documentItem.JAKA_KANCELARIA_TU
            : null,
          documentItem.POBRANO_VAT,
          documentItem.ZAZNACZ_KONTRAHENTA &&
          documentItem.ZAZNACZ_KONTRAHENTA === "TAK"
            ? documentItem.ZAZNACZ_KONTRAHENTA
            : null,
          JSON.stringify(documentItem.UWAGI_ASYSTENT),
          documentItem.BLAD_DORADCY && documentItem.BLAD_DORADCY === "TAK"
            ? documentItem.BLAD_DORADCY
            : null,
          documentItem.DATA_WYDANIA_AUTA &&
          documentItem.DATA_WYDANIA_AUTA !== "BRAK"
            ? documentItem.DATA_WYDANIA_AUTA
            : null,
          documentItem?.OSTATECZNA_DATA_ROZLICZENIA &&
          documentItem.OSTATECZNA_DATA_ROZLICZENIA !== "BRAK"
            ? documentItem.OSTATECZNA_DATA_ROZLICZENIA
            : null,
          documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            ? JSON.stringify(documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA)
            : documentItem.HISTORIA_ZMIANY_DATY_ROZLICZENIA,
          documentItem.INFORMACJA_ZARZAD
            ? JSON.stringify(documentItem.INFORMACJA_ZARZAD)
            : null,
          documentItem.KRD && documentItem.KRD !== "BRAK"
            ? documentItem.KRD
            : null,
        ]
      );
    }

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
  const { id_user, info } = req.params;
  if (!id_user || !info) {
    return res.status(400).json({ message: "Id and info are required." });
  }
  try {
    const result = await getDataDocuments(id_user, info);

    res.json(result.data);
  } catch (error) {
    logEvents(
      `documentsController, getDataTable: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};
// SQL pobieram  ustawienia tabeli(order, visiblility itd), kolumny
const getSettingsColumnsTable = async (req, res) => {
  const { id_user } = req.params;
  if (!id_user) {
    return res.status(400).json({ message: "Id and info are required." });
  }
  try {
    const findUser = await connect_SQL.query(
      "SELECT  tableSettings, columns  FROM company_users WHERE id_user = ?",
      [id_user]
    );

    const tableSettings = findUser[0][0].tableSettings
      ? findUser[0][0].tableSettings
      : {};
    const columns = findUser[0][0].columns ? findUser[0][0].columns : [];

    res.json({ tableSettings, columns });
  } catch (error) {
    logEvents(
      `documentsController, getSettingsColumnsTable: ${error}`,
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
      `SELECT D.id_document, D.NUMER_FV, D.BRUTTO, IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA, IFNULL(FS.DO_ROZLICZENIA, 0) AS FK_DO_ROZLICZENIA, D.TERMIN, 
    D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, 
    D.NR_SZKODY, D.NR_AUTORYZACJI, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, 
    D.VIN, D.FIRMA, DA.*, SD.OPIS_ROZRACHUNKU,  SD.DATA_ROZL_AS, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, 
    ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', 
    IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE, JI.area AS AREA, UPPER(R.FIRMA_ZEWNETRZNA) AS JAKA_KANCELARIA, 
    R.STATUS_AKTUALNY, FZAL.FV_ZALICZKOWA, FZAL.KWOTA_BRUTTO AS KWOTA_FV_ZAL, MD.NUMER_FV AS MARK_FV, MD.RAPORT_FK AS MARK_FK
    FROM company_documents AS D 
    LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id 
    LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY
    LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department
    LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
    LEFT JOIN company_rubicon_data AS R ON R.NUMER_FV = D.NUMER_FV
    LEFT JOIN company_fv_zaliczkowe AS FZAL ON D.NUMER_FV = FZAL.NUMER_FV AND D.FIRMA = FZAL.COMPANY
    LEFT JOIN company_mark_documents AS MD ON D.NUMER_FV = MD.NUMER_FV AND D.FIRMA = MD.COMPANY
    LEFT JOIN company_fk_settlements AS FS ON D.NUMER_FV = FS.NUMER_FV AND D.FIRMA = FS.FIRMA
    WHERE D.id_document = ?`,
      [id_document]
    );

    const [controlDoc] = await connect_SQL.query(
      `SELECT * FROM company_control_documents WHERE NUMER_FV = ? AND COMPANY = ?`,
      [singleDoc[0].NUMER_FV, singleDoc[0].FIRMA]
    );

    res.json({
      singleDoc: singleDoc[0],
      controlDoc: controlDoc[0] ? controlDoc[0] : {},
    });
    // res.json(result[0]);
    // res.end();
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
      "SELECT D.id_document, D.NUMER_FV, D.BRUTTO, D.TERMIN, D.NETTO, D.DZIAL, D.DATA_FV, D.KONTRAHENT, D.DORADCA, D.NR_REJESTRACYJNY, D.NR_SZKODY, D.UWAGI_Z_FAKTURY, D.TYP_PLATNOSCI, D.NIP, D.VIN, DA.*, SD.OPIS_ROZRACHUNKU,  datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, ROUND((D.BRUTTO - D.NETTO), 2) AS '100_VAT',ROUND(((D.BRUTTO - D.NETTO) / 2), 2) AS '50_VAT', IF(D.TERMIN >= CURDATE(), 'N', 'P') AS CZY_PRZETERMINOWANE,  S.NALEZNOSC AS DO_ROZLICZENIA FROM company_documents AS D LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LIMIT 1"
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
  const { NUMER_FV, documentControlBL, FIRMA } = req.body;
  try {
    const [findDoc] = await connect_SQL.query(
      "SELECT NUMER_FV FROM company_control_documents WHERE NUMER_FV = ?",
      [NUMER_FV]
    );

    if (findDoc[0]?.NUMER_FV) {
      await connect_SQL.query(
        "UPDATE company_control_documents SET CONTROL_UPOW = ?, CONTROL_OSW_VAT = ?, CONTROL_PR_JAZ = ?, CONTROL_DOW_REJ = ?, CONTROL_POLISA = ?, CONTROL_DECYZJA = ?, CONTROL_FV = ?, CONTROL_ODPOWIEDZIALNOSC = ?, CONTROL_PLATNOSC_VAT = ?, CONTROL_BRAK_DZIALAN_OD_OST = ?, COMPANY = ?  WHERE NUMER_FV = ? AND COMPANY = ?",
        [
          documentControlBL.upowaznienie
            ? documentControlBL.upowaznienie
            : null,
          documentControlBL.oswiadczenieVAT
            ? documentControlBL.oswiadczenieVAT
            : null,
          documentControlBL.prawoJazdy ? documentControlBL.prawoJazdy : null,
          documentControlBL.dowodRejestr
            ? documentControlBL.dowodRejestr
            : null,
          documentControlBL.polisaAC ? documentControlBL.polisaAC : null,
          documentControlBL.decyzja ? documentControlBL.decyzja : null,
          documentControlBL.faktura ? documentControlBL.faktura : null,
          documentControlBL.odpowiedzialnosc
            ? documentControlBL.odpowiedzialnosc
            : null,
          documentControlBL.platnoscVAT ? documentControlBL.platnoscVAT : null,
          documentControlBL.zmianyOstatniaKontrola
            ? documentControlBL.zmianyOstatniaKontrola
            : null,
          FIRMA,
          NUMER_FV,
          FIRMA,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO company_control_documents (NUMER_FV, CONTROL_UPOW, CONTROL_OSW_VAT, CONTROL_PR_JAZ, CONTROL_DOW_REJ, CONTROL_POLISA, CONTROL_DECYZJA = ?, CONTROL_FV, CONTROL_ODPOWIEDZIALNOSC, CONTROL_PLATNOSC_VAT, CONTROL_BRAK_DZIALAN_OD_OST, COMPANY) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          NUMER_FV,
          documentControlBL.upowaznienie
            ? documentControlBL.upowaznienie
            : null,
          documentControlBL.oswiadczenieVAT
            ? documentControlBL.oswiadczenieVAT
            : null,
          documentControlBL.prawoJazdy ? documentControlBL.prawoJazdy : null,
          documentControlBL.dowodRejestr
            ? documentControlBL.dowodRejestr
            : null,
          documentControlBL.polisaAC ? documentControlBL.polisaAC : null,
          documentControlBL.decyzja ? documentControlBL.decyzja : null,
          documentControlBL.faktura ? documentControlBL.faktura : null,
          documentControlBL.odpowiedzialnosc
            ? documentControlBL.odpowiedzialnosc
            : null,
          documentControlBL.platnoscVAT ? documentControlBL.platnoscVAT : null,
          documentControlBL.zmianyOstatniaKontrola
            ? documentControlBL.zmianyOstatniaKontrola
            : null,
          FIRMA,
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
  getAllDocuments,
  changeSingleDocument,
  getDataTable,
  getSettingsColumnsTable,
  getDataDocuments,
  getSingleDocument,
  getColumnsName,
  changeControlChat,
  getDataDocumentsControl,
  changeDocumentControl,
  getAvailableDeps,
};
