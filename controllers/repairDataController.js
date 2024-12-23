const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { addDepartment } = require('./manageDocumentAddition');



// do rozdzielenia kancelarii zwykłych i TU
const repairKanc = async (req, res) => {
    try {
        // const [getLawsName] = await connect_SQL.query(
        //     `SELECT id_action, JAKA_KANCELARIA FROM documents_actions 
        //     WHERE JAKA_KANCELARIA != 'BRAK' AND JAKA_KANCELARIA != 'M_LEGAL' AND JAKA_KANCELARIA != 'INWEST INKASO'`
        // );

        // for (const doc of getLawsName) {
        //     console.log(doc);
        //     // await connect_SQL.query(
        //     //     "UPDATE documents_actions SET JAKA_KANCELARIA_TU = ? WHERE id_action = ?",
        //     //     [doc.JAKA_KANCELARIA, doc.id_action]
        //     // );
        // }

        console.log('finish');
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

const repairAdvisersName = async (req, res) => {
    try {
        //         const [getAdvisersName] = await connect_SQL.query(
        //             `SELECT D.NUMER_FV, D.DORADCA
        // FROM documents as D
        // LEFT JOIN join_items AS JI ON D.DZIAL = JI.department
        // WHERE  D.DORADCA != 'Brak danych'`
        //         );
        //         console.log(getAdvisersName);
        // const updatedAdvisersName = getAdvisersName.map(item => {
        //     const [firstName, lastName] = item.DORADCA.split(' ');
        //     return { ...item, DORADCA: `${lastName} ${firstName}` };
        // });

        // for (const adviser of updatedAdvisersName) {
        //     await connect_SQL.query(
        //         'UPDATE documents SET DORADCA = ? WHERE NUMER_FV = ?', [adviser.DORADCA, adviser.NUMER_FV]);

        // }


        const query = `SELECT 
        fv.[NUMER],
        us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL
 FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
 LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
 
 WHERE fv.[NUMER] != 'POTEM' 
   AND fv.[DATA_WYSTAWIENIA] > '2023-12-31' `;

        const documents = await msSqlQuery(query);

        console.log('start doradca');
        for (const doc of documents) {
            await connect_SQL.query(
                'UPDATE documents SET DORADCA = ? WHERE NUMER_FV = ?', [doc.PRZYGOTOWAL, doc.NUMER]);
        }

        console.log('finish');
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: "Server error" });
    }
};

const repairDocumentDB = async () => {
    // zamienia na krótki format daty
    const formatDate = (date) => {
        if (date instanceof Date) {
            return date.toISOString().split('T')[0]; // Wyciąga tylko część daty, np. "2024-11-08"
        }
        return date;
    };

    const query = `SELECT 
         fv.[NUMER],
          CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23) AS DATA_WYSTAWIENIA,
      CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23) AS DATA_ZAPLATA,
         fv.[KONTR_NAZWA],
         fv.[KONTR_NIP],
         SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_BRUTTO] ELSE 0 END) AS WARTOSC_BRUTTO,
         SUM(CASE WHEN pos.[NAZWA] NOT LIKE '%Faktura zaliczkowa%' THEN pos.[WARTOSC_RABAT_NETTO] ELSE 0 END) AS WARTOSC_NETTO,
         fv.[NR_SZKODY],
         fv.[NR_AUTORYZACJI],
         fv.[UWAGI],
         fv.[KOREKTA_NUMER],
         zap.[NAZWA] AS TYP_PLATNOSCI,
         us.[NAZWA] + ' ' + us.[IMIE] AS PRZYGOTOWAL,
         auto.[REJESTRACJA],
         auto.[NR_NADWOZIA],
         tr.[WARTOSC_NAL]
  FROM [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC] AS fv
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[MYUSER] AS us ON fv.[MYUSER_PRZYGOTOWAL_ID] = us.[MYUSER_ID]
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] AS tr ON fv.[FAKTDOC_ID] = tr.[FAKTDOC_ID]
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[DOC_ZAPLATA] AS zap ON fv.FAKT_ZAPLATA_ID = zap.DOC_ZAPLATA_ID
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[AUTO] AS auto ON fv.AUTO_ID = auto.AUTO_ID
  LEFT JOIN [AS3_KROTOSKI_PRACA].[dbo].[FAKTDOC_POS] AS pos ON fv.[FAKTDOC_ID] = pos.[FAKTDOC_ID]
  WHERE fv.[NUMER] != 'POTEM' 
    AND fv.[DATA_WYSTAWIENIA] > '2024-01-01'
  GROUP BY 
         fv.[NUMER],
         CONVERT(VARCHAR(10), [DATA_WYSTAWIENIA], 23),
         CONVERT(VARCHAR(10), [DATA_ZAPLATA], 23),
                fv.[KONTR_NAZWA],
         fv.[KONTR_NIP],
         fv.[NR_SZKODY],
         fv.[NR_AUTORYZACJI],
         fv.[UWAGI],
         fv.[KOREKTA_NUMER],
         zap.[NAZWA],
         us.[NAZWA] + ' ' + us.[IMIE],
         auto.[REJESTRACJA],
         auto.[NR_NADWOZIA],
         tr.[WARTOSC_NAL];
  `;

    try {
        const documents = await msSqlQuery(query);
        // dodaje nazwy działów
        const addDep = addDepartment(documents);

        addDep.forEach(row => {
            row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
            row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
        });

        console.log('start');
        for (const doc of addDep) {

            const updateDoc = await connect_SQL.query('UPDATE documents SET BRUTTO = ?, NETTO = ? WHERE NUMER_FV = ?', [doc.WARTOSC_BRUTTO, doc.WARTOSC_NETTO, doc.NUMER]);

            // console.log(updateDoc);

            //     await connect_SQL.query(
            //         "INSERT IGNORE INTO documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
            //         [
            //             doc.NUMER,
            //             doc.WARTOSC_BRUTTO,
            //             doc.WARTOSC_NETTO,
            //             doc.DZIAL,
            //             doc.WARTOSC_NAL || 0,
            //             doc.DATA_WYSTAWIENIA,
            //             doc.DATA_ZAPLATA,
            //             doc.KONTR_NAZWA,
            //             doc.PRZYGOTOWAL,
            //             doc.REJESTRACJA,
            //             doc.NR_SZKODY || null,
            //             doc.UWAGI,
            //             doc.TYP_PLATNOSCI,
            //             doc.KONTR_NIP || null,
            //             doc.NR_NADWOZIA,
            //             doc.NR_AUTORYZACJI || null,
            //             doc.KOREKTA_NUMER
            //         ]
            //     );
        }
        console.log('finish');
    }
    catch (error) {
        console.error(error);
    }
};

const updateSettlementsTest = async () => {
    try {
        console.log('rozrachunki');
        const queryMsSql = `
     DECLARE @Termin DATETIME = '2012-11-29'; -- Przykładowe wartości
DECLARE @IS_BILANS BIT = 1;
DECLARE @IS_ROZLICZONY BIT = 0;
DECLARE @DATA_KONIEC DATETIME = GETDATE();

SELECT 
    T.OPIS,
	T.WARTOSC_SALDO
FROM [AS3_KROTOSKI_PRACA].[dbo].[TRANSDOC] T WITH(NOLOCK)
WHERE T.IS_BILANS = @IS_BILANS
  AND T.IS_ROZLICZONY = @IS_ROZLICZONY
  AND T.DATA <= @DATA_KONIEC
  AND T.WARTOSC_SALDO IS NOT NULL
  AND T.TERMIN IS NOT NULL
        `;

        const settlementsValue = await msSqlQuery(queryMsSql);

        const filteredData = settlementsValue.map(item => {
            const cleanDoc = item.OPIS.split(" ")[0];
            return {
                NUMER_FV: cleanDoc,
                DO_ROZLICZENIA: -(item.WARTOSC_SALDO)
            };
        });

        const checkDuplicate = Object.values(filteredData.reduce((acc, item) => {
            // Jeśli numer FV już istnieje w akumulatorze, dodaj DO_ROZLICZENIA
            if (acc[item.NUMER_FV]) {
                acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
            } else {
                // Jeśli nie, dodaj nowy rekord
                acc[item.NUMER_FV] = { NUMER_FV: item.NUMER_FV, DO_ROZLICZENIA: item.DO_ROZLICZENIA };
            }
            return acc;
        }, {}));
        // Najpierw wyczyść tabelę settlements_description
        await connect_SQL.query("TRUNCATE TABLE settlements");

        // Teraz przygotuj dane do wstawienia
        const values = checkDuplicate.map(item => [
            item.NUMER_FV,
            item.DO_ROZLICZENIA
        ]);

        const query = `
      INSERT IGNORE INTO settlements
        ( NUMER_FV,  NALEZNOSC) 
      VALUES 
        ${values.map(() => "(?, ?)").join(", ")}
    `;
        // Wykonanie zapytania INSERT
        await connect_SQL.query(query, values.flat());
        console.log('finish');

    }
    catch (error) {
        console.error(error);
    }
};

const changeUserSettings = async () => {
    try {
        const [users] = await connect_SQL.query(`SELECT id_user, roles FROM users`);

        for (const user of users) {
            const { EditorPlus, ...filteredObject } = user.roles;
            console.log(user.id_user);
            console.log(filteredObject);

            await connect_SQL.query(
                "UPDATE users SET roles = ? WHERE id_user = ?",
                [
                    JSON.stringify(filteredObject),
                    user.id_user
                ]
            );
        }
        console.log('finish');
    }
    catch (error) {
        console.error(error);
    }
};

module.exports = {
    repairKanc,
    repairAdvisersName,
    repairDocumentDB,
    updateSettlementsTest,
    changeUserSettings
};
