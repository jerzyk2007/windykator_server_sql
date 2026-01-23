const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { documentsType } = require("./manageDocumentAddition");

const getContarctorList = async (req, res) => {
  const { search } = req.query;
  try {
    const [result] = await connect_SQL.query(
      `SELECT * FROM company_contractor  WHERE KONTR_NIP LIKE '${search}%' OR NAZWA_KONTRAHENTA_SLOWNIK LIKE '%${search}%'`
    );
    return res.json(result ?? []);
  } catch (error) {
    logEvents(
      `contractorController, getContarctorList: ${error.message}`,
      "reqServerErrors.txt"
    );
    return res.json([]);
  }
};

const changeDataContractor = async (req, res) => {
  const { id } = req.params;
  const { email, phone, status } = req.body;
  try {
    await connect_SQL.query(
      "UPDATE company_contractor SET EMAIL = ?, TELEFON = ?, STATUS_WINDYKACJI = ? WHERE id_kontrahent = ?",
      [JSON.stringify(email), JSON.stringify(phone), status, id]
    );
    res.end();
  } catch (error) {
    logEvents(
      `contractorController, changeDataContractor: ${error.message}`,
      "reqServerErrors.txt"
    );
    res.status(500).end();
  }
};

const getReportData = async (req, res) => {
  const { id, company } = req.params;
  try {
    const [result] = await connect_SQL.query(
      `SELECT D.NUMER_FV, D.BRUTTO, D.DATA_FV, D.TERMIN, IFNULL(S.NALEZNOSC, 0) AS DO_ROZLICZENIA, D.TYP_PLATNOSCI, SD.DATA_ROZL_AS FROM company_documents AS D LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_settlements_description AS SD ON D.NUMER_FV = SD.NUMER AND D.FIRMA = SD.COMPANY WHERE D.KONTRAHENT_ID = ? AND D.FIRMA = ? AND D.DATA_FV > '2025-01-01'`,
      [id, company]
    );

    // const filteredData = result
    //   ?.map((item) => ({
    //     ...item,
    //     docType: documentsType(item.NUMER_FV),
    //   }))
    //   .filter((item) =>
    //     ["Faktura", "Faktura zaliczkowa"].includes(item.docType)
    //   );
    const filteredData = result
      ?.map((item) => ({
        ...item,
        docType: documentsType(item.NUMER_FV),
      }))
      .filter(
        (item) =>
          ["Faktura", "Faktura zaliczkowa"].includes(item.docType) &&
          item.TYP_PLATNOSCI?.toLowerCase().includes("przelew")
      );
    res.json(filteredData ?? []);
  } catch (error) {
    logEvents(
      `contractorController, getReportData: ${error.message}`,
      "reqServerErrors.txt"
    );
    res.status(500).json([]);
  }
};

const getSingleContractor = async (req, res) => {
  const { id } = req.params;
  try {
    const [result] = await connect_SQL.query(
      `SELECT * FROM company_contractor  WHERE id_kontrahent = ?`,
      [id]
    );

    return res.json(result[0] ?? []);
  } catch (error) {
    logEvents(
      `contractorController, getSingleContractor: ${error.message}`,
      "reqServerErrors.txt"
    );
    res.status(500).json([]);
  }
};

module.exports = {
  getContarctorList,
  changeDataContractor,
  getReportData,
  getSingleContractor,
};
