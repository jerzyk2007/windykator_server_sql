const { connect_SQL, msSqlQuery } = require("../config/dbConn");

const today = new Date();
today.setDate(today.getDate() - 2); // Odejmujemy 2 dni
const twoDaysAgo = today.toISOString().split("T")[0];

const query = `SELECT fv.[NUMER], fv.[KOREKTA_NUMER], fv.[DATA_WYSTAWIENIA], fv.[DATA_ZAPLATA], fv.[KONTR_NAZWA], fv.[KONTR_NIP], fv.[WARTOSC_NETTO], fv.[WARTOSC_BRUTTO], fv.[NR_SZKODY], fv.[NR_AUTORYZACJI], fv.[UWAGI],fv.[DATA_WYDANIA], u.[NAZWA], u.[IMIE] FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS u ON fv.[MYUSER_PRZYGOTOWAL_ID] = u.[MYUSER_ID] WHERE fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' AND fv.[NUMER]!='POTEM' `;

const getData = async (req, res) => {
  try {
    const [getDate] = await connect_SQL.query(
      "SELECT settlements FROM updates"
    );
    const queryTest = await msSqlQuery(query);

    console.log(queryTest.length);
    res.json(getDate[0].settlements);
  } catch (error) {
    logEvents(`getDataFromMSSQL, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getData,
};
