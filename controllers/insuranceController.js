const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

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

    // łącze stare i nowe dane czatu
    const oldChatDoc = oldData[0]?.KANAL_KOMUNIKACJI
      ? oldData[0].KANAL_KOMUNIKACJI
      : [];
    const newChat = chatLog?.KANAL_KOMUNIKACJI?.length
      ? chatLog.KANAL_KOMUNIKACJI
      : [];

    const mergeChat = [...(oldChatDoc ?? []), ...(newChat ?? [])];

    // łącze stare i nowe dane logów zdarzeń
    const oldLogDoc = oldData[0]?.DZIENNIK_ZMIAN
      ? oldData[0].DZIENNIK_ZMIAN
      : [];
    const newLog = chatLog?.DZIENNIK_ZMIAN?.length
      ? chatLog.DZIENNIK_ZMIAN
      : [];

    const mergeLog = [...(oldLogDoc ?? []), ...(newLog ?? [])];

    await connect_SQL.query(
      "UPDATE company_insurance_documents SET STATUS = ?, OW = ?, KANAL_KOMUNIKACJI = ?, DZIENNIK_ZMIAN = ? WHERE id_document = ?",
      [
        document.STATUS || null,
        document.OW || null,
        mergeChat.length ? JSON.stringify(mergeChat) : null,
        mergeLog.length ? JSON.stringify(mergeLog) : null,
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

module.exports = {
  getDataTable,
  getSingleDocument,
  changeSingleDocument,
};
