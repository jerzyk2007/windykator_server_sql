const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { verifyUserTableConfig } = require('./usersController');
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require('./mailController');
const { generatePassword } = require('./manageDocumentAddition');
const dayjs = require('dayjs');
const isSameOrBefore = require('dayjs/plugin/isSameOrBefore');
const { filter } = require("compression");
dayjs.extend(isSameOrBefore);

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

// const generatePassword = async (length = 12) => {
//     const chars = {
//         lower: "abcdefghijklmnopqrstuvwxyz",
//         upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
//         digits: "0123456789",
//         special: "!@#$%"
//     };

//     const getRandomChar = (set) => set[crypto.randomInt(0, set.length)];

//     let password = [
//         getRandomChar(chars.lower),
//         getRandomChar(chars.upper),
//         getRandomChar(chars.digits),
//         getRandomChar(chars.special),
//         ...Array.from({ length: length - 4 }, () => getRandomChar(Object.values(chars).join("")))
//     ].sort(() => Math.random() - 0.5).join("");

//     const hashedPwd = await bcryptjs.hash(password, 10);

//     return ({
//         password,
//         hashedPwd
//     });
// };

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
            "size": {
                "NIP": 100,
                "VIN": 100,
                "AREA": 100,
                "DZIAL": 100,
                "NETTO": 100,
                "BRUTTO": 111,
                "TERMIN": 122,
                "DATA_FV": 140,
                "DORADCA": 100,
                "NUMER_FV": 194,
                "KONTRAHENT": 270,
                "BLAD_DORADCY": 100,
                "TYP_PLATNOSCI": 100,
                "DO_ROZLICZENIA": 136,
                "UWAGI_ASYSTENT": 250,
                "JAKA_KANCELARIA": 100,
                "UWAGI_Z_FAKTURY": 100,
                "NR_REJESTRACYJNY": 100,
                "DATA_WYDANIA_AUTA": 100,
                "INFORMACJA_ZARZAD": 192,
                "CZY_PRZETERMINOWANE": 100,
                "ILE_DNI_PO_TERMINIE": 111,
                "ZAZNACZ_KONTRAHENTA": 100,
                "OSTATECZNA_DATA_ROZLICZENIA": 230
            },
            "order": [
                "NUMER_FV",
                "DATA_FV",
                "TERMIN",
                "ILE_DNI_PO_TERMINIE",
                "BRUTTO",
                "DO_ROZLICZENIA",
                "KONTRAHENT",
                "UWAGI_ASYSTENT",
                "AREA",
                "BLAD_DORADCY",
                "CZY_PRZETERMINOWANE",
                "DATA_WYDANIA_AUTA",
                "DORADCA",
                "DZIAL",
                "INFORMACJA_ZARZAD",
                "JAKA_KANCELARIA",
                "NETTO",
                "NIP",
                "NR_REJESTRACYJNY",
                "OSTATECZNA_DATA_ROZLICZENIA",
                "TYP_PLATNOSCI",
                "UWAGI_Z_FAKTURY",
                "VIN",
                "ZAZNACZ_KONTRAHENTA",
                "mrt-row-spacer"
            ],
            "pinning": {
                "left": [
                    "NUMER_FV"
                ],
                "right": []
            },
            "visible": {
                "NIP": false,
                "VIN": false,
                "AREA": false,
                "DZIAL": false,
                "NETTO": false,
                "BRUTTO": true,
                "TERMIN": true,
                "DATA_FV": true,
                "DORADCA": false,
                "NUMER_FV": true,
                "KONTRAHENT": true,
                "BLAD_DORADCY": false,
                "TYP_PLATNOSCI": false,
                "DO_ROZLICZENIA": true,
                "UWAGI_ASYSTENT": true,
                "JAKA_KANCELARIA": false,
                "UWAGI_Z_FAKTURY": false,
                "NR_REJESTRACYJNY": false,
                "DATA_WYDANIA_AUTA": false,
                "INFORMACJA_ZARZAD": true,
                "CZY_PRZETERMINOWANE": false,
                "ILE_DNI_PO_TERMINIE": true,
                "ZAZNACZ_KONTRAHENTA": false,
                "OSTATECZNA_DATA_ROZLICZENIA": true
            },
            "pagination": {
                "pageSize": 30,
                "pageIndex": 0
            }
        };

        // const result = await Promise.all(uniqueOwners.map(async user => {
        //     const [surname, name] = user.split(' '); // Podział na imię i nazwisko
        //     let userMail = '';
        //     let departments = new Set();
        //     const pass = await generatePassword();
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
        //         password: pass.password, // Teraz czekamy na wygenerowanie hasła
        //         hashedPwd: pass.hashedPwd, // Teraz czekamy na wygenerowanie hasła
        //         dzial: [...departments] // Konwersja z Set na tablicę
        //     };
        // }));

        // do testów i dodawania uzytkowników
        const pass = await generatePassword();
        const result = [
            {
                userlogin: 'krystian.janiak@porschecentrumlodz.com',
                username: 'Krystian',
                usersurname: 'Janiak',
                // password: 'j%6Jws5Eo0Hc',
                password: pass.password,
                // hashedPwd: '$2a$10$yrm451Fvp7XrcGB1qXG2DemIaQY2u1pyb/OFLln3iCq0jyHVrroFW',
                hashedPwd: pass.hashedPwd,
                dzial: ['D097']
            },
            {
                userlogin: 'michal.pazdzierski@porschecentrumlodz.com',
                username: 'Michał',
                usersurname: 'Paździerski',
                password: pass.password,
                hashedPwd: pass.hashedPwd,
                dzial: ['D097']
            },
            {
                userlogin: 'jakub.wierzbicki@porschecentrumlodz.com',
                username: 'Jakub',
                usersurname: 'Wierzbicki',
                password: pass.password,
                hashedPwd: pass.hashedPwd,
                dzial: ['D097']
            },
            {
                userlogin: 'jaroslaw.sloczynski@porschecentrumlodz.com',
                username: 'Jarosław',
                usersurname: 'Słoczyński',
                password: pass.password,
                hashedPwd: pass.hashedPwd,
                dzial: ['D097']
            },

        ];

        for (const user of result) {
            const [checkDuplicate] = await connect_SQL.query(`SELECT userlogin FROM users WHERE userlogin = ? `,
                [user.userlogin]
            );
            if (!checkDuplicate.length) {
                console.log(user);
                await connect_SQL.query(
                    `INSERT INTO users (username, usersurname, userlogin, password, departments, roles, permissions, tableSettings, raportSettings ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
                    [user.username,
                    user.usersurname,
                    user.userlogin,
                    user.hashedPwd,
                    JSON.stringify(user.dzial),
                    JSON.stringify(roles),
                    JSON.stringify(permissions),
                    JSON.stringify(tableSettings),
                    JSON.stringify(raportSettings),
                    ]);

                const [getColumns] = await connect_SQL.query('SELECT * FROM table_columns');

                const [checkIdUser] = await connect_SQL.query('SELECT id_user FROM users WHERE userlogin = ?',
                    [user.userlogin]
                );

                // titaj kod dopisuje jakie powinien dany user widzieć kolumny w tabeli
                await verifyUserTableConfig(checkIdUser[0].id_user, user.dzial, getColumns);

                const mailOptions = {
                    from: "powiadomienia-raportbl@krotoski.com",
                    to: `${user.userlogin}`,
                    // to: `jerzy.komorowski@krotoski.com`,
                    subject: "Zostało założone konto dla Ciebie",
                    // text: "Treść wiadomości testowej",
                    html: `
                    <b>Dzień dobry</b><br>
                    <br>
                    Zostało założone konto dla Ciebie, aplikacja dostępna pod adresem <br>
                    <a href="https://raportbl.krotoski.com/" target="_blank">https://raportbl.krotoski.com</a><br>
                    <br>
                    Login: ${user.userlogin}<br>
                    Hasło: ${user.password}<br>
                    Masz dostęp do działów: ${user.dzial.join(", ")} <br/>
                    <br>
                    Polecamy skorzystać z instrukcji obsługi, aby poznać funkcje programu.<br/>
                    <a href="https://raportbl.krotoski.com/instruction" target="_blank">https://raportbl.krotoski.com/instruction</a><br>
                     <br>
                    Z poważaniem.<br>
                    Dział Nadzoru i Kontroli Należności <br>
                `,
                };
                // console.log(mailOptions);
                await sendEmail(mailOptions);

            }

        }


        //wyciągnięcie wszystkich maili
        // const userLoginsString = [...new Set(result.map(user => user.userlogin))].sort().join('; ');

        // console.log(userLoginsString);
    }
    catch (error) {
        console.error(error);
    }
};

const repairHistory = async () => {
    try {
        const [getRaportFK] = await connect_SQL.query(`SELECT NR_DOKUMENTU, TERMIN_PLATNOSCI_FV FROM fk_raport_v2 WHERE OBSZAR != 'KSIĘGOWOŚĆ' AND TYP_DOKUMENTU IN ('Faktura', 'Faktura zaliczkowa', 'Korekta', 'Nota') AND CZY_W_KANCELARI = 'NIE' AND DO_ROZLICZENIA_AS > 0`);

        const [getDateHistory] = await connect_SQL.query('SELECT DISTINCT WYKORZYSTANO_RAPORT_FK FROM management_decision_FK');

        const [getDateDecision] = await connect_SQL.query('SELECT * FROM management_decision_FK');

        const subtractDays = (dateString, days) => {
            const date = new Date(dateString);
            date.setDate(date.getDate() + days);
            return date.toISOString().split('T')[0]; // zwraca z powrotem w formacie yyyy-mm-dd
        };


        // łączę dane z management_decision_FK HISTORIA_ZMIANY_DATY_ROZLICZENIA i INFORMACJA_ZARZADw jeden obiekt
        const merged = [];

        getDateDecision.forEach(item => {
            const existing = merged.find(el =>
                el.NUMER_FV === item.NUMER_FV &&
                el.WYKORZYSTANO_RAPORT_FK === item.WYKORZYSTANO_RAPORT_FK
            );

            if (existing) {
                // Uzupełnij brakujące pola tylko jeśli są null
                if (!existing.INFORMACJA_ZARZAD && item.INFORMACJA_ZARZAD) {
                    existing.INFORMACJA_ZARZAD = item.INFORMACJA_ZARZAD;
                }

                if (!existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA && item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
                    existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA = item.HISTORIA_ZMIANY_DATY_ROZLICZENIA;
                }
            } else {
                // Brak duplikatu, dodaj nowy obiekt
                merged.push({ ...item });
            }
        });

        // szukam duplikatów faktur i grupuję 
        const grouped = merged.reduce((acc, { NUMER_FV, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA, WYKORZYSTANO_RAPORT_FK }) => {
            // Sprawdzamy, czy już istnieje taki NUMER_FV w zgromadzonych danych
            const existingEntry = acc.find(entry => entry.NUMER_FV === NUMER_FV);

            if (existingEntry) {
                // Jeśli istnieje, dodajemy nowy obiekt do tablicy DATA
                existingEntry.DATA.push({
                    INFORMACJA_ZARZAD,
                    HISTORIA_ZMIANY_DATY_ROZLICZENIA,
                    WYKORZYSTANO_RAPORT_FK
                });
            } else {
                // Jeśli nie istnieje, tworzymy nowy obiekt
                acc.push({
                    NUMER_FV,
                    DATA: [
                        {
                            INFORMACJA_ZARZAD,
                            HISTORIA_ZMIANY_DATY_ROZLICZENIA,
                            WYKORZYSTANO_RAPORT_FK
                        }
                    ]
                });
            }

            return acc;
        }, []);

        // sprawdzam ile razy dana faktura powinna pojawic się w raportach
        const filteredData = getRaportFK.map(doc => {
            const newTermin = doc.TERMIN_PLATNOSCI_FV;
            // const newMaxDay = subtractDays(doc.TERMIN_PLATNOSCI_FV, 8);



            const dateObj = new Date(newTermin);
            dateObj.setDate(dateObj.getDate() + 8);

            const newMaxDay = dateObj.toISOString().slice(0, 10); // string yyyy-mm-dd

            const matchingDates = getDateHistory
                .map(d => d.WYKORZYSTANO_RAPORT_FK) // wyciągamy tylko daty jako stringi
                .filter(dateStr => dateStr >= newMaxDay) // szukamy dat, które są większe niż newMaxDay
                .sort(); // sortujemy rosnąco (najmłodsza na początku)


            // if (doc.NR_DOKUMENTU === 'FV/M/INT/1466/25/A/D27') {
            //     console.log(doc);
            //     console.log(newMaxDay);
            //     console.log(matchingDates);

            // }

            return {
                NUMER_FV: doc.NR_DOKUMENTU,
                ILE_WYSTAPIEN: matchingDates ? matchingDates : []
            };
        });

        // tworzę historię wpisó na podstawie danych wpisanych przez użytkowników i tych których nie uzupełnili
        const newHistory = filteredData.map(item => {
            const searchDoc = grouped.filter(doc => doc.NUMER_FV === item.NUMER_FV);


            if (searchDoc[0]?.NUMER_FV) {
                // if (searchDoc[0].NUMER_FV === 'FV/M/INT/1466/25/A/D27') {
                // console.log(item);
                // console.log(item.ILE_WYSTAPIEN);
                // console.log(searchDoc[0].DATA);

                const dataHistory = item?.ILE_WYSTAPIEN?.map((dataDoc, index) => {
                    const searchHistory = searchDoc[0].DATA.filter((filtrDoc) => filtrDoc.WYKORZYSTANO_RAPORT_FK === dataDoc);


                    return {
                        info: `${index + 1} raport utworzono ${dataDoc}`,
                        historyDate: searchHistory[0]?.HISTORIA_ZMIANY_DATY_ROZLICZENIA ? [searchHistory[0].HISTORIA_ZMIANY_DATY_ROZLICZENIA] : [],
                        historyText: searchHistory[0]?.INFORMACJA_ZARZAD ? [searchHistory[0].INFORMACJA_ZARZAD] : [],
                    };
                });
                // console.log(dataHistory);

                // }

                return {
                    NUMER_FV: searchDoc[0].NUMER_FV,
                    DATA: dataHistory
                };

            }
            else {
                const dataHistory = item?.ILE_WYSTAPIEN?.map((dataDoc, index) => {
                    return {
                        info: `${index + 1} raport utworzono ${dataDoc}`,
                        historyDate: [],
                        historyText: [],
                    };
                });
                return {
                    NUMER_FV: item.NUMER_FV,
                    DATA: dataHistory
                };
            }

        });


        const emptyData = newHistory.filter(item => item.DATA.length > 0);

        // console.log(emptyData.length);


        await connect_SQL.query('TRUNCATE history_fk_documents');
        for (const doc of emptyData) {
            console.log(doc);
            await connect_SQL.query(`INSERT INTO history_fk_documents (NUMER_FV, HISTORY_DOC) VALUES (?, ?)`,
                [doc.NUMER_FV, JSON.stringify(doc.DATA)]);
        }

        // const test2 = newHistory.map(item => {

        //     if (item.NUMER_FV === 'FV/UP/5189/24/A/D86') {
        //         console.log(item);

        //     }
        // });

        // FV/UP/5189/24/A/D86
        // FV/M/INT/1466/25/A/D27

        // const mergedData = filteredData.map(filteredItem => {
        //     const findDoc = merged.filter(doc => doc.NUMER_FV === filteredItem.NUMER_FV);
        //     if (findDoc.length) {
        //         return {
        //             NUMER_FV: filteredItem.NUMER_FV,
        //             historyDate: [findDoc.HISTORIA_ZMIANY_DATY_ROZLICZENIA],
        //             historyText: [findDoc.INFORMACJA_ZARZAD],
        //             WYKORZYSTANO_RAPORT_FK: filteredItem.WYKORZYSTANO_RAPORT_FK
        //         };
        //     } else {
        //         return {
        //             NUMER_FV: filteredItem.NUMER_FV,
        //             historyDate: [],
        //             historyText: [],
        //             WYKORZYSTANO_RAPORT_FK: filteredItem.WYKORZYSTANO_RAPORT_FK
        //         };
        //     }

        // });
        // console.log(mergedData);

        // const test2 = mergedData.map(item => {
        //     if (item.NUMER_FV === 'FV/M/INT/1466/25/A/D27') {
        //         console.log(item);

        //     }
        // });

        // const filteredData = getRaportFK.flatMap(item => {
        //     // if (item.NR_DOKUMENTU === 'FV/M/INT/1466/25/A/D27') {
        //     //     console.log(item);
        //     // }
        //     return getDateHistory
        //         .filter(prev => subtractDays(item.TERMIN_PLATNOSCI_FV, 8) < prev.WYKORZYSTANO_RAPORT_FK)
        //         .map(prev => {
        //             // console.log(prev);
        //             return {
        //                 NUMER_FV: item.NR_DOKUMENTU,
        //                 WYKORZYSTANO: prev.WYKORZYSTANO_RAPORT_FK,
        //             };
        //         });
        // });

        // const test = getRaportFK.map(item => {
        //     if (item.NR_DOKUMENTU === 'FV/M/INT/1466/25/A/D27') {
        //         console.log(item);
        //     }
        // });
        // console.log(getDateDecision);

        // console.log(filteredData[0]);

        // console.log(getDateHistory);
        // console.log(getRaportFK);


        // const resultMap = {};

        // getDateHistory
        //     .sort((a, b) => new Date(a.WYKORZYSTANO_RAPORT_FK) - new Date(b.WYKORZYSTANO_RAPORT_FK))
        //     .forEach(dateObj => {
        //         const currentDate = dateObj.WYKORZYSTANO_RAPORT_FK;

        //         // Szukamy faktur z filteredData dla tej daty
        //         const matches = filteredData.filter(fd => fd.WYKORZYSTANO === currentDate);

        //         matches.forEach(match => {
        //             const numerFV = match.NUMER_FV;

        //             if (!resultMap[numerFV]) {
        //                 resultMap[numerFV] = {
        //                     NUMER_FV: numerFV,
        //                     DATA: []
        //                 };
        //             }

        //             // Znajdź odpowiadający rekord w merged
        //             const mergedMatch = merged.find(m =>
        //                 m.NUMER_FV === numerFV && m.WYKORZYSTANO_RAPORT_FK === currentDate
        //             );

        //             const historyDate = mergedMatch?.HISTORIA_ZMIANY_DATY_ROZLICZENIA
        //                 ? [mergedMatch.HISTORIA_ZMIANY_DATY_ROZLICZENIA]
        //                 : [];

        //             const historyText = mergedMatch?.INFORMACJA_ZARZAD
        //                 ? [mergedMatch.INFORMACJA_ZARZAD]
        //                 : [];

        //             resultMap[numerFV].DATA.push({
        //                 info: `${resultMap[numerFV].DATA.length + 1} raport utworzono ${currentDate}`,
        //                 historyDate,
        //                 historyText
        //             });
        //         });
        //     });

        // const finalResult = Object.values(resultMap);
        // console.log(finalResult);
        // const test = finalResult.map(item => {
        //     if (item.NUMER_FV === 'FV/M/INT/1466/25/A/D27') {
        //         console.log(item);

        //     }
        // });

        // console.log(finalResult);
        // await connect_SQL.query('TRUNCATE history_fk_documents');
        // for (const doc of finalResult) {
        //     await connect_SQL.query(`INSERT INTO history_fk_documents (NUMER_FV, HISTORY_DOC) VALUES (?, ?)`,
        //         [doc.NUMER_FV, JSON.stringify(doc.DATA)]);
        // }


    }
    catch (err) {
        console.error(err);
    }
};

const repairManagementDecisionFK = async () => {
    try {
        const [getDateDecision] = await connect_SQL.query('SELECT * FROM management_decision_FK');

        // łączę dane z management_decision_FK HISTORIA_ZMIANY_DATY_ROZLICZENIA i INFORMACJA_ZARZADw jeden obiekt
        // const merged = [];

        // getDateDecision.forEach(item => {
        //     const existing = merged.find(el =>
        //         el.NUMER_FV === item.NUMER_FV &&
        //         el.WYKORZYSTANO_RAPORT_FK === item.WYKORZYSTANO_RAPORT_FK
        //     );

        //     if (existing) {
        //         // Uzupełnij brakujące pola tylko jeśli są null
        //         if (!existing.INFORMACJA_ZARZAD && item.INFORMACJA_ZARZAD) {
        //             existing.INFORMACJA_ZARZAD = item.INFORMACJA_ZARZAD;
        //         }

        //         if (!existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA && item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
        //             existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA = item.HISTORIA_ZMIANY_DATY_ROZLICZENIA;
        //         }
        //     } else {
        //         // Brak duplikatu, dodaj nowy obiekt
        //         merged.push({ ...item });
        //     }
        // });
        // console.log(merged);
        // console.log(getDateDecision);

        const groupedMap = new Map();

        for (const item of getDateDecision) {
            const key = `${item.NUMER_FV}|${item.WYKORZYSTANO_RAPORT_FK}`;

            if (!groupedMap.has(key)) {
                groupedMap.set(key, {
                    NUMER_FV: item.NUMER_FV,
                    WYKORZYSTANO_RAPORT_FK: item.WYKORZYSTANO_RAPORT_FK,
                    INFORMACJA_ZARZAD: [],
                    HISTORIA_ZMIANY_DATY_ROZLICZENIA: [],
                });
            }

            const group = groupedMap.get(key);

            if (item.INFORMACJA_ZARZAD) {
                group.INFORMACJA_ZARZAD.push(item.INFORMACJA_ZARZAD);
            }

            if (item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
                group.HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(item.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
            }
        }

        const result = Array.from(groupedMap.values());
        // const test2 = result.map(item => {

        //     if (item.NUMER_FV === 'FV/UP/5189/24/A/D86') {
        //         console.log(item);

        //     }
        // });

        for (const doc of result) {
            await connect_SQL.query(`INSERT INTO management_date_description_FK (NUMER_FV, WYKORZYSTANO_RAPORT_FK, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA) VALUES (?, ?, ?, ?)`,
                [doc.NUMER_FV, doc.WYKORZYSTANO_RAPORT_FK, JSON.stringify(doc.INFORMACJA_ZARZAD), JSON.stringify(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA)]);
        }

    }
    catch (err) {
        console.error(err);
    }
};

module.exports = {
    repairAdvisersName,
    changeUserSettings,
    checkFKDocuments,
    repairRoles,
    repairColumnsRaports,
    createAccounts,
    generatePassword,
    repairHistory,
    repairManagementDecisionFK
};
