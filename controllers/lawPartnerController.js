const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

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
    console.log(contractorData);
    console.log(docID);
    res.json(contractorData);
  } catch (error) {
    logEvents(
      `settingsController, getPermissions: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getContractor,
};
