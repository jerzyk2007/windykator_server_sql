// const Document = require("../model/Document");
// const User = require("../model/User");
const { logEvents } = require("../middleware/logEvents");
const { getDataDocuments } = require("./documentsController");

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getDataRaport = async (req, res) => {
  const { id_user } = req.params;
  try {

    const result = await getDataDocuments(id_user, "actual");
    res.json({ data: result.data, permission: result.permission });
  } catch (error) {
    logEvents(
      `raportsController, getDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getDataRaport,
};
