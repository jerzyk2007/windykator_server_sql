const { connect_SQL, msSqlQuery } = require("../config/dbConn");


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

module.exports = {
    repairKanc,
    repairAdvisersName
};
