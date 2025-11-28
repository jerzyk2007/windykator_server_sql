const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

// zapytanie do pobrania danych
const queryTable = "SELECT * FROM company_insurance_documents";

// pobiera dane do tabeli w zaleźności od wywołania
const getDataTable = async (req, res) => {
  const { info } = req.params;
  try {
    let data = [];
    if (info === "vindication") {
      [data] = await connect_SQL.query(`${queryTable}`);
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

module.exports = {
  getDataTable,
  getSingleDocument,
};
