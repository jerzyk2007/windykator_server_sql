const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const cron = require('node-cron');


const today = new Date();
today.setDate(today.getDate() - 2); // Odejmujemy 2 dni
const twoDaysAgo = today.toISOString().split("T")[0];



// const query = `SELECT fv.[NUMER], fv.[KOREKTA_NUMER], fv.[DATA_WYSTAWIENIA], fv.[DATA_ZAPLATA], fv.[KONTR_NAZWA], fv.[KONTR_NIP], fv.[WARTOSC_NETTO], fv.[WARTOSC_BRUTTO], fv.[NR_SZKODY], fv.[NR_AUTORYZACJI], fv.[UWAGI],fv.[DATA_WYDANIA], u.[NAZWA], u.[IMIE] FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS u ON fv.[MYUSER_PRZYGOTOWAL_ID] = u.[MYUSER_ID] WHERE fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' AND fv.[NUMER]!='POTEM' `;

const query = `SELECT 
       fv.[NUMER]
     , fv.[DATA_WYSTAWIENIA]
     , fv.[DATA_ZAPLATA]
     , fv.[KONTR_NAZWA]
     , fv.[KONTR_NIP]
     , fv.[WARTOSC_NETTO]
     , fv.[WARTOSC_BRUTTO]
     , fv.[NR_SZKODY]
     , fv.[NR_AUTORYZACJI]
     , fv.[UWAGI]
	 , fv.[KOREKTA_NUMER]
	 , fv.[DATA_WYDANIA]
	 , tr.[OPIS]
	 , zap.[NAZWA]
	 , us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL
	 , auto.[REJESTRACJA]
	 , auto.[NR_NADWOZIA]
FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[AUTO] as auto ON fv.AUTO_ID = auto.AUTO_ID WHERE fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}' AND fv.[NUMER]!='POTEM' `;

const getData = async (req, res) => {
  try {

    const queryTest = await msSqlQuery(query);

    console.log(queryTest.length);

    const testToday = new Date();


    const testDate = new Intl.DateTimeFormat('pl-PL', {
      timeZone: 'Europe/Warsaw',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    }).format(testToday);

    console.log(testDate);
  } catch (error) {
    logEvents(`getDataFromMSSQL, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    // res.status(500).json({ error: "Server error" });
  }
};

// cykliczne wywoływanie funkcji o określonej godzinie
// W wyrażeniu cron.schedule('58 16 * * *', ...) każda część odpowiada określonemu elementowi daty i czasu. Oto pełne wyjaśnienie:
// Minuta – 58: Minuta, w której zadanie ma się uruchomić (tutaj: 58 minuta każdej godziny).
// Godzina – 16: Godzina, w której zadanie ma się uruchomić (tutaj: 16, czyli 16:58).
// Dzień miesiąca – *: Gwiazdka oznacza każdy dzień miesiąca (od 1 do 31).
// Miesiąc – *: Gwiazdka oznacza każdy miesiąc (od stycznia do grudnia).
// Dzień tygodnia – *: Gwiazdka oznacza każdy dzień tygodnia (od poniedziałku do niedzieli).
cron.schedule('41 19 * * *', getData, {
  timezone: "Europe/Warsaw"
});

module.exports = {
  getData,
};
