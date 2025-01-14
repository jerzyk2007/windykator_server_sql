const { connect_SQL, msSqlQuery } = require("../config/dbConn");



// naprawa/zamiana imienia i nazwiska dla Doradców - zamiana miejscami imienia i nazwiska
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

// sprawdzenie czy w wiekowaniu nie ma dokumentów które nie występują w programie
// const checkFKDocuments = async () => {
//     try {
//         const [documents] = await connect_SQL.query(`
//         SELECT NUMER_FV
//         FROM raportFK_accountancy 
//         WHERE TYP_DOKUMENTU = 'Faktura' OR TYP_DOKUMENTU = 'Nota'`);


//         for (const doc of documents) {
//             const [checkDoc] = await connect_SQL.query(`
//                 SELECT NUMER_FV
//                 FROM documents 
//                 WHERE NUMER_FV = '${doc.NUMER_FV}'`);

//             if (!checkDoc[0]) {
//                 console.log(doc);

//             }

//         }
//     }
//     catch (error) {
//         console.error(error);
//     }
// };

// sprawdzenie czy w programie nie ma dokumentów które nie występująw raporcie FK
const checkFKDocuments = async () => {
    try {
        const [documents] = await connect_SQL.query(`
       SELECT D.NUMER_FV, D.TERMIN, S.NALEZNOSC
    from documents AS D
    LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV 
    WHERE S.NALEZNOSC != 0
    AND D.TERMIN < '2025-01-01'`);

        console.log(documents.length);
        const newDocuments = [];
        for (const doc of documents) {
            const [checkDoc] = await connect_SQL.query(`
                SELECT NUMER_FV
                FROM raportFK_accountancy 
                WHERE NUMER_FV = '${doc.NUMER_FV}'`);

            if (!checkDoc[0]) {
                if (doc.NUMER_FV.includes('FV')) {
                    // console.log(doc.NUMER_FV);

                    newDocuments.push(doc);
                }

            }

        }
        // console.log(newDocuments);

    }
    catch (error) {
        console.error(error);
    }
};

module.exports = {
    repairAdvisersName,
    changeUserSettings,
    checkFKDocuments
};
