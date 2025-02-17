const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { verifyUserTableConfig } = require('./usersController');
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");

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

const repairRoles = async () => {
    try {
        // const [users] = await connect_SQL.query(`SELECT id_user, roles FROM users`);
        const [users] = await connect_SQL.query(`SELECT id_user, roles FROM users`);

        const updatedUsers = users.map(item => {
            if (item.roles.Editor) {
                // console.log(item);
                // Usunięcie kluczy SuperAdmin i AdminBL, jeśli istnieją
                // delete item.roles.SuperAdmin;
                // delete item.roles.FKAdmin;

                // // Zmiana wartości klucza Admin na 1000, jeśli istnieje
                if ('Editor' in item.roles) {
                    item.roles.Editor = 110;
                }
            }
            return item;
        });
        // console.log(updatedUsers);
        // console.log(users);
        // for (item of updatedUsers) {
        //     // console.log(item.id_user);
        //     console.log(item.roles);

        //     connect_SQL.query(
        //         "UPDATE users SET  roles = ? WHERE id_user = ?",
        //         [
        //             JSON.stringify(item.roles),
        //             item.id_user
        //         ]);
        // }
    }
    catch (error) {
        console.error(error);
    }
};

const repairColumnsRaports = async () => {
    try {
        // const [users] = await connect_SQL.query(`
        //         SELECT raportSettings
        //         FROM users
        //         WHERE usersurname = 'Kowalski'`);

        // const raportSettings = {
        //     raportAdvisers: '{"size":{},"visible":{"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DORADCA","DZIAL","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","CEL_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
        //     raportDepartments: '{"size":{},"visible":{"CEL_BEZ_PZU_LINK4":false,"PRZETERMINOWANE_BEZ_PZU_LINK4":false,"ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4":false,"NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4":false,"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DZIALY","CEL","CEL_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","CEL_CALOSC","PRZETERMINOWANE_FV","ILOSC_PRZETERMINOWANYCH_FV","NIEPRZETERMINOWANE_FV","CEL_BEZ_KANCELARII","PRZETERMINOWANE_BEZ_KANCELARII","ILOSC_PRZETERMINOWANYCH_FV_BEZ_KANCELARII","NIEPRZETERMINOWANE_FV_BEZ_KANCELARII","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}'
        // };

        // await connect_SQL.query(`UPDATE users SET raportSettings = ? WHERE usersurname = ?`,
        //     [
        //         JSON.stringify(raportSettings),
        //         'Kowalski'
        //     ]);
        console.log('test');

    }
    catch (error) {
        console.error(error);
    }
};

const generatePassword = async (length = 12) => {
    const chars = {
        lower: "abcdefghijklmnopqrstuvwxyz",
        upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
        digits: "0123456789",
        special: "!@#$%"
    };

    const getRandomChar = (set) => set[crypto.randomInt(0, set.length)];

    let password = [
        getRandomChar(chars.lower),
        getRandomChar(chars.upper),
        getRandomChar(chars.digits),
        getRandomChar(chars.special),
        ...Array.from({ length: length - 4 }, () => getRandomChar(Object.values(chars).join("")))
    ].sort(() => Math.random() - 0.5).join("");

    const hashedPwd = await bcryptjs.hash(password, 10);
    console.log(password);
    console.log(hashedPwd);
    return ({
        password,
        hashedPwd
    });
};

const hashedPwd = async () => {
    const password = await bcryptjs.hash("Start123!", 10);
    return password;
};

// tworzy konta dla pracowników wg struktury organizacyjnej, operacja jednorazowa :)
const createAccounts = async (req, res) => {
    try {
        const [data] = await connect_SQL.query(
            "SELECT * FROM join_items ORDER BY department"
        );

        const findMail = await Promise.all(
            data.map(async (item) => {
                const ownerMail = await Promise.all(
                    item.owner.map(async (own) => {
                        const [mail] = await connect_SQL.query(
                            `SELECT owner_mail FROM owner_items WHERE owner = ?`, [own]
                        );

                        // Zamiana null na "Brak danych"
                        return mail.map(row => row.owner_mail || "Brak danych");
                    })
                );

                return {
                    ...item,
                    mail: ownerMail.flat() // Spłaszczamy tablicę wyników
                };
            })
        );

        // Pobranie unikalnych wartości z owner, usunięcie "Brak danych" i sortowanie
        const uniqueOwners = [...new Set(findMail.flatMap(item => item.owner))]
            .filter(name => name !== 'Brak danych') // Usuwa "Brak danych"
            .sort(); // Sortuje alfabetycznie

        // console.log(uniqueOwners);


        // const hashedPwd = await bcryptjs.hash("Start123!", 10);
        const roles = { Start: 1, User: 100, Editor: 110 };
        const permissions = {
            "Basic": false,
            "Standard": true
        };
        const raportSettings = {
            raportAdvisers: '{"size":{},"visible":{"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DORADCA","DZIAL","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","CEL_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
            raportDepartments: '{"size":{},"visible":{"CEL_BEZ_PZU_LINK4":false,"PRZETERMINOWANE_BEZ_PZU_LINK4":false,"ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4":false,"NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4":false,"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DZIALY","CEL","CEL_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","CEL_CALOSC","PRZETERMINOWANE_FV","ILOSC_PRZETERMINOWANYCH_FV","NIEPRZETERMINOWANE_FV","CEL_BEZ_KANCELARII","PRZETERMINOWANE_BEZ_KANCELARII","ILOSC_PRZETERMINOWANYCH_FV_BEZ_KANCELARII","NIEPRZETERMINOWANE_FV_BEZ_KANCELARII","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}'
        };
        const tableSettings = {
            "size": {},
            "order": [
                "NUMER_FV",
                "DATA_FV",
                "TERMIN",
                "ILE_DNI_PO_TERMINIE",
                "BRUTTO",
                "DO_ROZLICZENIA",
                "UWAGI_ASYSTENT",
                "mrt-row-spacer"
            ],
            "pinning": {
                "left": [],
                "right": []
            },
            "visible": {
                "BRUTTO": true,
                "TERMIN": true,
                "DATA_FV": true,
                "NUMER_FV": true,
                "DO_ROZLICZENIA": true,
                "UWAGI_ASYSTENT": true,
                "ILE_DNI_PO_TERMINIE": true
            },
            "pagination": {
                "pageSize": 10,
                "pageIndex": 0
            }
        };

        // const result = await Promise.all(uniqueOwners.map(async user => {
        //     const [surname, name] = user.split(' '); // Podział na imię i nazwisko
        //     let userMail = '';
        //     let departments = new Set();

        //     findMail.forEach(({ owner, mail, department }) => {
        //         const index = owner.indexOf(user);
        //         if (index !== -1) {
        //             if (!userMail) userMail = mail[index]; // Przypisujemy pierwszy znaleziony mail
        //             departments.add(department); // Dodajemy dział, jeśli użytkownik występuje w tym obiekcie
        //         }
        //     });

        //     return {
        //         userlogin: userMail || null,
        //         username: name,
        //         usersurname: surname,
        //         dzial: [...departments] // Konwersja z Set na tablicę
        //     };
        // }));

        const result = await Promise.all(uniqueOwners.map(async user => {
            const [surname, name] = user.split(' '); // Podział na imię i nazwisko
            let userMail = '';
            let departments = new Set();

            findMail.forEach(({ owner, mail, department }) => {
                const index = owner.indexOf(user);
                if (index !== -1) {
                    if (!userMail) userMail = mail[index]; // Przypisujemy pierwszy znaleziony mail
                    departments.add(department); // Dodajemy dział, jeśli użytkownik występuje w tym obiekcie
                }
            });
            return {
                userlogin: userMail || null,
                username: name,
                usersurname: surname,
                password: await hashedPwd(), // Teraz czekamy na wygenerowanie hasła
                dzial: [...departments] // Konwersja z Set na tablicę
            };
        }));
        let existUser = [];
        console.log(await generatePassword());


        // for (const user of result) {
        //     const [checkDuplicate] = await connect_SQL.query(`SELECT userlogin FROM users WHERE userlogin = ? `,
        //         [user.userlogin]
        //     );
        //     if (!checkDuplicate.length) {

        //         existUser.push({ ...user, haslo: "Start123!" });
        //         // console.log(user);
        //         // await connect_SQL.query(
        //         //     `INSERT INTO users (username, usersurname, userlogin, password, departments, roles, permissions, tableSettings, raportSettings ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        //         //     [user.username,
        //         //     user.usersurname,
        //         //     user.userlogin,
        //         //     user.password,
        //         //     JSON.stringify(user.dzial),
        //         //     JSON.stringify(roles),
        //         //     JSON.stringify(permissions),
        //         //     JSON.stringify(tableSettings),
        //         //     JSON.stringify(raportSettings),
        //         //     ]);

        //         // const [getColumns] = await connect_SQL.query('SELECT * FROM table_columns');

        //         // const [checkIdUser] = await connect_SQL.query('SELECT id_user FROM users WHERE userlogin = ?',
        //         //     [user.userlogin]
        //         // );

        //         // titaj kod dopisuje jakie powinien dany user widzieć kolumny w tabeli
        //         await verifyUserTableConfig(checkIdUser[0].id_user, user.dzial, getColumns);
        //         // console.log(result.length);

        //     }
        //     else {
        //         existUser.push({ ...user, haslo: "Już ma konto" });
        //     }

        // }
        // res.json({ existUser });
    }
    catch (error) {
        console.error(error);
    }
};




module.exports = {
    repairAdvisersName,
    changeUserSettings,
    checkFKDocuments,
    repairRoles,
    repairColumnsRaports,
    createAccounts,
    generatePassword
};
