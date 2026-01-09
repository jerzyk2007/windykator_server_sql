const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { mergeJsonLogs } = require("./manageDocumentAddition");

// zapytanie do pobrania danych
const getDocumentsLawPartner =
  "SELECT CLD.id_document, CLD.NUMER_DOKUMENTU, CLD.KONTRAHENT, CLD.NIP_NR, CLD.DATA_PRZYJECIA_SPRAWY, CLD.DATA_WYSTAWIENIA_DOKUMENTU, CLD.KWOTA_BRUTTO_DOKUMENTU, CLD.ODDZIAL, CLD.OPIS_DOKUMENTU, CLD.DATA_PRZEKAZANIA_SPRAWY, CLD.KWOTA_ROSZCZENIA_DO_KANCELARII, CLD.KANAL_KOMUNIKACJI, CLD.STATUS_SPRAWY, CLD.SYGNATURA_SPRAWY_SADOWEJ, CLD.TERMIN_PRZEDAWNIENIA_ROSZCZENIA, CLD.DATA_WYMAGALNOSCI_PLATNOSCI, CLD.WYDZIAL_SADU, CLD.ORGAN_EGZEKUCYJNY, CLD.SYGN_SPRAWY_EGZEKUCYJNEJ, CLDS.WYKAZ_SPLACONEJ_KWOTY_FK, CLDS.SUMA_SPLACONEJ_KWOTY_FK, CLDS.POZOSTALA_NALEZNOSC_FK FROM company_law_documents as CLD LEFT JOIN company_law_documents_settlements as CLDS ON CLD.NUMER_DOKUMENTU = CLDS.NUMER_DOKUMENTU_FK";

// pobiera dane do tabeli w zaleźności od wywołania
const getDataTable = async (req, res) => {
  const { id_user, info, profile } = req.params;
  try {
    let data = [];
    if (info === "ongoing") {
      [data] = await connect_SQL.query(
        `${getDocumentsLawPartner} WHERE DATA_PRZYJECIA_SPRAWY IS NOT NULL`
      );
    } else if (info === "no-accept") {
      [data] = await connect_SQL.query(
        `${getDocumentsLawPartner} WHERE DATA_PRZYJECIA_SPRAWY IS NULL`
      );
    } else {
      data = [];
    }
    res.json(data);
    // res.end();
  } catch (error) {
    logEvents(
      `lawPartnerController, getDataTable: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

//pobiera dane kontrahenta z FK
const getContractor = async (req, res) => {
  const { docID } = req.params;
  try {
    const contractorData = await msSqlQuery(
      `SELECT
kon.[PESEL]
    ,kon.[NAZWA]
	,kon.[IMIE]
    ,kon.[NAZWISKO]
	,kon.[A_PRZEDROSTEK]
    ,kon.[A_ULICA]
    ,kon.[A_KOD]
    ,kon.[A_MIASTO]
    ,kon.[TELEFON]
	,kon.[TELKOMORKA]
    ,kon.[TELEFON_NORM]
    ,kon.[E_MAIL]
	,kon.[A_ULICA_EXT]
    ,kon.[A_NRDOMU]
    ,kon.[A_NRLOKALU]
	,kon.[NIP]
    ,kon.[REGON]
	,kon.[IS_FIRMA]
  FROM [AS3_KROTOSKI_PRACA].[dbo].[KONTRAHENT] AS kon
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv ON fv.KONTRAHENT_ID = kon.KONTRAHENT_ID
WHERE fv.[NUMER] = '${docID}'`
    );
    res.json(contractorData);
  } catch (error) {
    logEvents(
      `lawPartnerController, getContractor: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const getSingleDocument = async (req, res) => {
  const { docID } = req.params;
  try {
    // const [singleDocument] = await connect_SQL.query(
    //   "SELECT * FROM company_law_documents WHERE id_document = ?",
    //   [docID]
    // );
    const [singleDocument] = await connect_SQL.query(
      "SELECT CLD.*, CLDS.* FROM company_law_documents as CLD LEFT JOIN company_law_documents_settlements as CLDS ON CLD.NUMER_DOKUMENTU = CLDS.NUMER_DOKUMENTU_FK WHERE CLD.id_document = ?",
      [docID]
    );
    res.json(singleDocument.length ? singleDocument[0] : {});
  } catch (error) {
    logEvents(
      `lawPartnerController, getSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const changeSingleDocument = async (req, res) => {
  const { id_document, document, chatLog } = req.body;
  try {
    const [oldData] = await connect_SQL.query(
      "SELECT * FROM company_law_documents WHERE id_document = ?",
      [id_document]
    );
    const { mergeChat, mergeLog } = mergeJsonLogs(oldData, chatLog);

    await connect_SQL.query(
      "UPDATE company_law_documents SET KANAL_KOMUNIKACJI = ?, DZIENNIK_ZMIAN = ?, STATUS_SPRAWY = ?, SYGNATURA_SPRAWY_SADOWEJ = ?, TERMIN_PRZEDAWNIENIA_ROSZCZENIA = ?, DATA_WYMAGALNOSCI_PLATNOSCI = ?, WYDZIAL_SADU = ?, ORGAN_EGZEKUCYJNY = ?, SYGN_SPRAWY_EGZEKUCYJNEJ = ? WHERE id_document = ?",
      [
        mergeChat.length ? JSON.stringify(mergeChat) : null,
        mergeLog.length ? JSON.stringify(mergeLog) : null,
        document.STATUS_SPRAWY && document.STATUS_SPRAWY !== "BRAK"
          ? document.STATUS_SPRAWY
          : null,
        document?.SYGNATURA_SPRAWY_SADOWEJ
          ? document.SYGNATURA_SPRAWY_SADOWEJ
          : null,
        document?.TERMIN_PRZEDAWNIENIA_ROSZCZENIA
          ? document.TERMIN_PRZEDAWNIENIA_ROSZCZENIA
          : null,
        document?.DATA_WYMAGALNOSCI_PLATNOSCI
          ? document.DATA_WYMAGALNOSCI_PLATNOSCI
          : null,
        document?.WYDZIAL_SADU ? document.WYDZIAL_SADU : null,
        document?.ORGAN_EGZEKUCYJNY ? document.ORGAN_EGZEKUCYJNY : null,
        document?.SYGN_SPRAWY_EGZEKUCYJNEJ
          ? document.SYGN_SPRAWY_EGZEKUCYJNEJ
          : null,
        id_document,
      ]
    );
    res.end();
  } catch (error) {
    logEvents(
      `lawPartnerController, changeSingleDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const acceptDocument = async (req, res) => {
  const { id_document, acceptDate, note } = req.body;
  try {
    await connect_SQL.query(
      "UPDATE company_law_documents SET DATA_PRZYJECIA_SPRAWY = ?, DZIENNIK_ZMIAN = ? WHERE id_document = ?",
      [acceptDate, JSON.stringify([note]), id_document]
    );
    res.end();
  } catch (error) {
    logEvents(
      `lawPartnerController, acceptDocument: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

module.exports = {
  getDataTable,
  getContractor,
  getSingleDocument,
  changeSingleDocument,
  acceptDocument,
};
