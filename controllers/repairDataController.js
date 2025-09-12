const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const { generatePassword } = require("./manageDocumentAddition");
const { addDepartment } = require("./manageDocumentAddition");
const { getAccountancyDataMsSQL } = require("./generateRaportFK");

// naprawa/zamiana imienia i nazwiska dla Doradców - zamiana miejscami imienia i nazwiska
const repairAdvisersName = async (req, res) => {
  try {
    //         const [getAdvisersName] = await connect_SQL.query(
    //             `SELECT D.NUMER_FV, D.DORADCA
    // FROM company_documents as D
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

    // const addDep = addDepartment(documents);

    // console.log(addDep);
    for (const doc of documents) {
      await connect_SQL.query(
        "UPDATE company_documents SET DORADCA = ? WHERE NUMER_FV = ?",
        [doc.PRZYGOTOWAL, doc.NUMER]
      );
    }

    console.log("finish");
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const changeUserSettings = async () => {
  try {
    const [users] = await connect_SQL.query(
      `SELECT id_user, roles FROM company_users`
    );

    for (const user of users) {
      const { EditorPlus, ...filteredObject } = user.roles;
      console.log(user.id_user);
      console.log(filteredObject);

      await connect_SQL.query(
        "UPDATE company_users SET roles = ? WHERE id_user = ?",
        [JSON.stringify(filteredObject), user.id_user]
      );
    }
    console.log("finish");
  } catch (error) {
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
//                 FROM company_documents
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
       SELECT D.NUMER_FV, D.TERMIN, D.FIRMA, S.NALEZNOSC
    from company_documents AS D
    LEFT JOIN company_settlements AS S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY
    WHERE S.NALEZNOSC != 0
    AND D.TERMIN < '2025-01-01'`);

    const newDocuments = [];
    for (const doc of documents) {
      const [checkDoc] = await connect_SQL.query(`
                SELECT NUMER_FV
                FROM company_raportFK_KRT_accountancy 
                WHERE NUMER_FV = '${doc.NUMER_FV}' AND FIRMA = '${doc.FIRMA}'`);

      if (!checkDoc[0]) {
        if (doc.NUMER_FV.includes("FV")) {
          // console.log(doc.NUMER_FV);

          newDocuments.push(doc);
        }
      }
    }
    // console.log(newDocuments);
  } catch (error) {
    console.error(error);
  }
};

const repairRoles = async () => {
  try {
    const [users] = await connect_SQL.query(
      `SELECT id_user, roles FROM company_users`
    );

    const updatedUsers = users.map((item) => {
      if (item.roles.Editor) {
        // console.log(item);
        // Usunięcie kluczy SuperAdmin i AdminBL, jeśli istnieją
        // delete item.roles.SuperAdmin;
        // delete item.roles.FKAdmin;

        // // Zmiana wartości klucza Admin na 1000, jeśli istnieje
        if ("Editor" in item.roles) {
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
    //         "UPDATE company_users SET  roles = ? WHERE id_user = ?",
    //         [
    //             JSON.stringify(item.roles),
    //             item.id_user
    //         ]);
    // }
  } catch (error) {
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

    // await connect_SQL.query(`UPDATE company_users SET raportSettings = ? WHERE usersurname = ?`,
    //     [
    //         JSON.stringify(raportSettings),
    //         'Kowalski'
    //     ]);
    console.log("test");
  } catch (error) {
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
      "SELECT * FROM company_join_items  WHERE COMPANY = 'KEM' ORDER BY DEPARTMENT"
    );

    // Dodaj do OWNER elementy z GUARDIAN, jeśli ich tam nie ma
    data.forEach((item) => {
      item.GUARDIAN.forEach((guardianName) => {
        if (!item.OWNER.includes(guardianName)) {
          item.OWNER.push(guardianName);
        }
      });
    });

    const findMail = await Promise.all(
      data.map(async (item) => {
        const ownerMail = await Promise.all(
          item.OWNER.map(async (own) => {
            const [mail] = await connect_SQL.query(
              `SELECT OWNER_MAIL FROM company_owner_items WHERE OWNER = ?`,
              [own]
            );
            // Zamiana null na "Brak danych"
            return mail.map((row) => row.OWNER_MAIL || "Brak danych");
          })
        );

        return {
          ...item,
          MAIL: ownerMail.flat(), // Spłaszczamy tablicę wyników
        };
      })
    );

    // Pobranie unikalnych wartości z owner, usunięcie "Brak danych" i sortowanie
    const uniqueOwners = [...new Set(findMail.flatMap((item) => item.OWNER))]
      .filter((name) => name !== "Brak danych") // Usuwa "Brak danych"
      .sort(); // Sortuje alfabetycznie

    const roles = { Start: 1, User: 100, Editor: 110 };
    const permissions = {
      Basic: false,
      Standard: true,
    };
    const raportSettings = {
      raportAdvisers:
        '{"size":{},"visible":{"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DORADCA","DZIAL","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","CEL_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
      raportDepartments:
        '{"size":{},"visible":{"CEL_BEZ_PZU_LINK4":false,"PRZETERMINOWANE_BEZ_PZU_LINK4":false,"ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4":false,"NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4":false,"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DZIALY","CEL","CEL_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","CEL_CALOSC","PRZETERMINOWANE_FV","ILOSC_PRZETERMINOWANYCH_FV","NIEPRZETERMINOWANE_FV","CEL_BEZ_KANCELARII","PRZETERMINOWANE_BEZ_KANCELARII","ILOSC_PRZETERMINOWANYCH_FV_BEZ_KANCELARII","NIEPRZETERMINOWANE_FV_BEZ_KANCELARII","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
    };
    const tableSettings = {
      size: {
        NIP: 100,
        VIN: 100,
        AREA: 100,
        DZIAL: 100,
        NETTO: 100,
        BRUTTO: 111,
        TERMIN: 122,
        DATA_FV: 140,
        DORADCA: 100,
        NUMER_FV: 194,
        KONTRAHENT: 270,
        BLAD_DORADCY: 100,
        TYP_PLATNOSCI: 100,
        DO_ROZLICZENIA: 136,
        UWAGI_ASYSTENT: 250,
        JAKA_KANCELARIA: 100,
        UWAGI_Z_FAKTURY: 100,
        NR_REJESTRACYJNY: 100,
        DATA_WYDANIA_AUTA: 100,
        INFORMACJA_ZARZAD: 192,
        CZY_PRZETERMINOWANE: 100,
        ILE_DNI_PO_TERMINIE: 111,
        ZAZNACZ_KONTRAHENTA: 100,
        OSTATECZNA_DATA_ROZLICZENIA: 230,
      },
      order: [
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
        "mrt-row-spacer",
      ],
      pinning: {
        left: ["NUMER_FV"],
        right: [],
      },
      visible: {
        NIP: false,
        VIN: false,
        AREA: false,
        DZIAL: false,
        NETTO: false,
        BRUTTO: true,
        TERMIN: true,
        DATA_FV: true,
        DORADCA: false,
        NUMER_FV: true,
        KONTRAHENT: true,
        BLAD_DORADCY: false,
        TYP_PLATNOSCI: false,
        DO_ROZLICZENIA: true,
        UWAGI_ASYSTENT: true,
        JAKA_KANCELARIA: false,
        UWAGI_Z_FAKTURY: false,
        NR_REJESTRACYJNY: false,
        DATA_WYDANIA_AUTA: false,
        INFORMACJA_ZARZAD: true,
        CZY_PRZETERMINOWANE: false,
        ILE_DNI_PO_TERMINIE: true,
        ZAZNACZ_KONTRAHENTA: false,
        OSTATECZNA_DATA_ROZLICZENIA: true,
      },
      pagination: {
        pageSize: 30,
        pageIndex: 0,
      },
    };

    const result = await Promise.all(
      uniqueOwners.map(async (user) => {
        const [surname, name] = user.split(" "); // Podział na imię i nazwisko
        let userMail = "";
        let departments = new Set();
        const pass = await generatePassword();

        findMail.forEach(({ OWNER, MAIL, DEPARTMENT }) => {
          const index = OWNER.indexOf(user);
          if (index !== -1) {
            if (!userMail) userMail = MAIL[index]; // Przypisujemy pierwszy znaleziony mail
            departments.add({ company: "KEM", department: DEPARTMENT }); // Dodajemy dział, jeśli użytkownik występuje w tym obiekcie
          }
        });
        return {
          userlogin: userMail || null,
          username: name,
          usersurname: surname,
          password: pass.password, // Teraz czekamy na wygenerowanie hasła
          hashedPwd: pass.hashedPwd, // Teraz czekamy na wygenerowanie hasła
          dzial: [...departments], // Konwersja z Set na tablicę
        };
      })
    );

    // const test = result.map(item => {
    //     if (item.userlogin === 'mariola.sliwa@krotoski.com') {
    //         console.log(item);

    //     }
    // });
    // do testów i dodawania uzytkowników
    // const pass = await generatePassword();

    // const result = [
    //     {
    //         userlogin: 'mariola.sliwa@krotoski.com',
    //         username: 'Mariola',
    //         usersurname: 'Śliwa',
    //         password: 'WmW3%AwdrGbs',
    //         hashedPwd: '$2a$10$1cI.SKg7Jn1M8vvDGj4GJuVLj4G1S7PCW.pd/N0WGPZlnYmwNN.0G',
    //         dzial: [
    //             { company: 'KEM', department: 'D531' },
    //             { company: 'KEM', department: 'D538' }
    //         ]
    //     }
    // ];

    for (const user of result) {
      const [checkDuplicate] = await connect_SQL.query(
        `SELECT userlogin FROM company_users WHERE userlogin = ? `,
        [user.userlogin]
      );
      // console.log(checkDuplicate);

      if (!checkDuplicate.length) {
        // console.log(user);

        await connect_SQL.query(
          `INSERT INTO company_users (username, usersurname, userlogin, password, departments, roles, permissions, tableSettings, raportSettings ) VALUES ( ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            user.username,
            user.usersurname,
            user.userlogin,
            user.hashedPwd,
            JSON.stringify(user.dzial),
            JSON.stringify(roles),
            JSON.stringify(permissions),
            JSON.stringify(tableSettings),
            JSON.stringify(raportSettings),
          ]
        );

        const [getColumns] = await connect_SQL.query(
          "SELECT * FROM company_table_columns"
        );

        const [checkIdUser] = await connect_SQL.query(
          "SELECT id_user FROM company_users WHERE userlogin = ?",
          [user.userlogin]
        );

        // // titaj kod dopisuje jakie powinien dany user widzieć kolumny w tabeli
        await verifyUserTableConfig(
          checkIdUser[0].id_user,
          user.dzial,
          getColumns
        );

        const dzialy = user.dzial.map((item) => item.department);

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
                    Masz dostęp do działów: ${dzialy.join(", ")} <br/>
                    <br>
                    Polecamy skorzystać z instrukcji obsługi, aby poznać funkcje programu.<br/>
                    <a href="https://raportbl.krotoski.com/instruction" target="_blank">https://raportbl.krotoski.com/instruction</a><br>
                     <br>
                    Z poważaniem.<br>
                    Dział Nadzoru i Kontroli Należności <br>
                `,
        };
        console.log(mailOptions);

        await sendEmail(mailOptions);
      }
    }

    console.log(result.length);
    // wyciągnięcie wszystkich maili;
    // const userLoginsString = [...new Set(result.map(user => user.userlogin))].sort().join('; ');

    // console.log(userLoginsString);
  } catch (error) {
    console.error(error);
  }
};

const repairHistory = async () => {
  try {
    const [dataHistory] = await connect_SQL.query(
      "SELECT * FROM company_windykacja.company_history_management"
    );

    const test = dataHistory.map((item) => {
      if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
        console.log(item);
      }
    });

    const targetDate = "2025-09-11";

    const filteredDataHistory = dataHistory.map((doc) => {
      return {
        ...doc,
        HISTORY_DOC: doc.HISTORY_DOC.filter(
          (historyItem) => !historyItem.info.includes(`utworzono ${targetDate}`)
        ),
      };
    });

    const test2 = filteredDataHistory.map((item) => {
      if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
        console.log(item);
      }
    });
    await connect_SQL.query(
      "TRUNCATE company_windykacja.company_history_management"
    );

    for (const doc of filteredDataHistory) {
      // console.log(doc);
      await connect_SQL.query(
        `INSERT INTO company_windykacja.company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
        [doc.NUMER_FV, JSON.stringify(doc.HISTORY_DOC), doc.COMPANY]
      );
    }
    console.log("nic");
    // *************
    // const [getRaportFK] = await connect_SQL.query(
    //   `SELECT NR_DOKUMENTU, TERMIN_PLATNOSCI_FV FROM company_fk_raport_KRT WHERE OBSZAR != 'KSIĘGOWOŚĆ' AND TYP_DOKUMENTU IN ('Faktura', 'Faktura zaliczkowa', 'Korekta', 'Nota') AND CZY_W_KANCELARI = 'NIE' AND DO_ROZLICZENIA_AS > 0`
    // );

    // const [getDateHistory] = await connect_SQL.query(
    //   "SELECT DISTINCT WYKORZYSTANO_RAPORT_FK FROM management_decision_FK"
    // );

    // const [getDateDecision] = await connect_SQL.query(
    //   "SELECT * FROM management_decision_FK"
    // );

    // const subtractDays = (dateString, days) => {
    //   const date = new Date(dateString);
    //   date.setDate(date.getDate() + days);
    //   return date.toISOString().split("T")[0]; // zwraca z powrotem w formacie yyyy-mm-dd
    // };

    // // łączę dane z management_decision_FK HISTORIA_ZMIANY_DATY_ROZLICZENIA i INFORMACJA_ZARZADw jeden obiekt
    // const merged = [];

    // getDateDecision.forEach((item) => {
    //   const existing = merged.find(
    //     (el) =>
    //       el.NUMER_FV === item.NUMER_FV &&
    //       el.WYKORZYSTANO_RAPORT_FK === item.WYKORZYSTANO_RAPORT_FK
    //   );

    //   if (existing) {
    //     // Uzupełnij brakujące pola tylko jeśli są null
    //     if (!existing.INFORMACJA_ZARZAD && item.INFORMACJA_ZARZAD) {
    //       existing.INFORMACJA_ZARZAD = item.INFORMACJA_ZARZAD;
    //     }

    //     if (
    //       !existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA &&
    //       item.HISTORIA_ZMIANY_DATY_ROZLICZENIA
    //     ) {
    //       existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA =
    //         item.HISTORIA_ZMIANY_DATY_ROZLICZENIA;
    //     }
    //   } else {
    //     // Brak duplikatu, dodaj nowy obiekt
    //     merged.push({ ...item });
    //   }
    // });

    // // szukam duplikatów faktur i grupuję
    // const grouped = merged.reduce(
    //   (
    //     acc,
    //     {
    //       NUMER_FV,
    //       INFORMACJA_ZARZAD,
    //       HISTORIA_ZMIANY_DATY_ROZLICZENIA,
    //       WYKORZYSTANO_RAPORT_FK,
    //     }
    //   ) => {
    //     // Sprawdzamy, czy już istnieje taki NUMER_FV w zgromadzonych danych
    //     const existingEntry = acc.find((entry) => entry.NUMER_FV === NUMER_FV);

    //     if (existingEntry) {
    //       // Jeśli istnieje, dodajemy nowy obiekt do tablicy DATA
    //       existingEntry.DATA.push({
    //         INFORMACJA_ZARZAD,
    //         HISTORIA_ZMIANY_DATY_ROZLICZENIA,
    //         WYKORZYSTANO_RAPORT_FK,
    //       });
    //     } else {
    //       // Jeśli nie istnieje, tworzymy nowy obiekt
    //       acc.push({
    //         NUMER_FV,
    //         DATA: [
    //           {
    //             INFORMACJA_ZARZAD,
    //             HISTORIA_ZMIANY_DATY_ROZLICZENIA,
    //             WYKORZYSTANO_RAPORT_FK,
    //           },
    //         ],
    //       });
    //     }

    //     return acc;
    //   },
    //   []
    // );

    // // sprawdzam ile razy dana faktura powinna pojawic się w raportach
    // const filteredData = getRaportFK.map((doc) => {
    //   const newTermin = doc.TERMIN_PLATNOSCI_FV;
    //   // const newMaxDay = subtractDays(doc.TERMIN_PLATNOSCI_FV, 8);

    //   const dateObj = new Date(newTermin);
    //   dateObj.setDate(dateObj.getDate() + 8);

    //   const newMaxDay = dateObj.toISOString().slice(0, 10); // string yyyy-mm-dd

    //   const matchingDates = getDateHistory
    //     .map((d) => d.WYKORZYSTANO_RAPORT_FK) // wyciągamy tylko daty jako stringi
    //     .filter((dateStr) => dateStr >= newMaxDay) // szukamy dat, które są większe niż newMaxDay
    //     .sort(); // sortujemy rosnąco (najmłodsza na początku)

    //   // if (doc.NR_DOKUMENTU === 'FV/M/INT/1466/25/A/D27') {
    //   //     console.log(doc);
    //   //     console.log(newMaxDay);
    //   //     console.log(matchingDates);

    //   // }

    //   return {
    //     NUMER_FV: doc.NR_DOKUMENTU,
    //     ILE_WYSTAPIEN: matchingDates ? matchingDates : [],
    //   };
    // });

    // // tworzę historię wpisó na podstawie danych wpisanych przez użytkowników i tych których nie uzupełnili
    // const newHistory = filteredData.map((item) => {
    //   const searchDoc = grouped.filter((doc) => doc.NUMER_FV === item.NUMER_FV);

    //   if (searchDoc[0]?.NUMER_FV) {
    //     // if (searchDoc[0].NUMER_FV === 'FV/M/INT/1466/25/A/D27') {
    //     // console.log(item);
    //     // console.log(item.ILE_WYSTAPIEN);
    //     // console.log(searchDoc[0].DATA);

    //     const dataHistory = item?.ILE_WYSTAPIEN?.map((dataDoc, index) => {
    //       const searchHistory = searchDoc[0].DATA.filter(
    //         (filtrDoc) => filtrDoc.WYKORZYSTANO_RAPORT_FK === dataDoc
    //       );

    //       return {
    //         info: `${index + 1} raport utworzono ${dataDoc}`,
    //         historyDate: searchHistory[0]?.HISTORIA_ZMIANY_DATY_ROZLICZENIA
    //           ? [searchHistory[0].HISTORIA_ZMIANY_DATY_ROZLICZENIA]
    //           : [],
    //         historyText: searchHistory[0]?.INFORMACJA_ZARZAD
    //           ? [searchHistory[0].INFORMACJA_ZARZAD]
    //           : [],
    //       };
    //     });
    //     console.log(dataHistory);

    //     // }

    //     return {
    //       NUMER_FV: searchDoc[0].NUMER_FV,
    //       DATA: dataHistory,
    //     };
    //   } else {
    //     const dataHistory = item?.ILE_WYSTAPIEN?.map((dataDoc, index) => {
    //       return {
    //         info: `${index + 1} raport utworzono ${dataDoc}`,
    //         historyDate: [],
    //         historyText: [],
    //       };
    //     });
    //     return {
    //       NUMER_FV: item.NUMER_FV,
    //       DATA: dataHistory,
    //     };
    //   }
    // });

    // const emptyData = newHistory.filter((item) => item.DATA.length > 0);

    // console.log(emptyData.length);

    // await connect_SQL.query("TRUNCATE history_fk_documents");
    // for (const doc of emptyData) {
    //   console.log(doc);
    //   await connect_SQL.query(
    //     `INSERT INTO history_fk_documents (NUMER_FV, HISTORY_DOC) VALUES (?, ?)`,
    //     [doc.NUMER_FV, JSON.stringify(doc.DATA)]
    //   );
    // }
  } catch (err) {
    console.error(err);
  }
};

const repairManagementDecisionFK = async () => {
  try {
    const [getDateDecision] = await connect_SQL.query(
      "SELECT * FROM management_decision_FK"
    );

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
        group.HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(
          item.HISTORIA_ZMIANY_DATY_ROZLICZENIA
        );
      }
    }

    const result = Array.from(groupedMap.values());
    // const test2 = result.map(item => {

    //     if (item.NUMER_FV === 'FV/UP/5189/24/A/D86') {
    //         console.log(item);

    //     }
    // });

    for (const doc of result) {
      await connect_SQL.query(
        `INSERT INTO management_date_description_FK (NUMER_FV, WYKORZYSTANO_RAPORT_FK, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA) VALUES (?, ?, ?, ?)`,
        [
          doc.NUMER_FV,
          doc.WYKORZYSTANO_RAPORT_FK,
          JSON.stringify(doc.INFORMACJA_ZARZAD),
          JSON.stringify(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA),
        ]
      );
    }
  } catch (err) {
    console.error(err);
  }
};

const usersDepartmentsCompany = async () => {
  try {
    const [departments] = await connect_SQL.query(
      `SELECT id_user, departments FROM windykacja.users`
    );

    for (const dep of departments) {
      const id = dep.id_user;
      const company = "KRT";

      const resultArray = dep.departments.map((department) => ({
        department: department,
        company,
      }));

      console.log("id:", id);
      console.log(resultArray);

      // await connect_SQL.query('UPDATE testowanie_windykacja.users SET departments = ? WHERE id_user = ?', [JSON.stringify(resultArray), id]);
    }
  } catch (err) {
    console.error(err);
  }
};

// zamienia na krótki format daty
const formatDate = (date) => {
  if (date instanceof Date) {
    return date.toISOString().split("T")[0]; // Wyciąga tylko część daty, np. "2024-11-08"
  }
  return date;
};

//pobieram dokumenty z bazy mssql AS
const testAddDocumentToDatabase = async (type) => {
  const twoDaysAgo = "2025-04-14";
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
    AND fv.[DATA_WYSTAWIENIA] > '${twoDaysAgo}'
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
  const firma = type === "KRT" ? "KRT" : "INNA";
  try {
    const documents = await msSqlQuery(query);
    // dodaje nazwy działów
    const addDep = addDepartment(documents);

    addDep.forEach((row) => {
      row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
      row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
    });

    // for (const doc of addDep) {

    //   await connect_SQL.query(
    //     "INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
    //     [
    //       doc.NUMER,
    //       doc.WARTOSC_BRUTTO,
    //       doc.WARTOSC_NETTO,
    //       doc.DZIAL,
    //       doc.WARTOSC_NAL || 0,
    //       doc.DATA_WYSTAWIENIA,
    //       doc.DATA_ZAPLATA,
    //       doc.KONTR_NAZWA,
    //       doc.PRZYGOTOWAL ? doc.PRZYGOTOWAL : "Brak danych",
    //       doc.REJESTRACJA,
    //       doc.NR_SZKODY || null,
    //       doc.UWAGI,
    //       doc.TYP_PLATNOSCI,
    //       doc.KONTR_NIP || null,
    //       doc.NR_NADWOZIA,
    //       doc.NR_AUTORYZACJI || null,
    //       doc.KOREKTA_NUMER,
    //       firma
    //     ]
    //   );
    // }
    return true;
  } catch (error) {
    console.error(error);
  }
};

const addDocToHistory = async () => {
  try {
    // const [historyDoc] = await connect_SQL.query(`SELECT HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD  FROM company_documents_actions`);
    const [historyDoc] =
      await connect_SQL.query(`SELECT C_D_A.HISTORIA_ZMIANY_DATY_ROZLICZENIA, C_D_A.INFORMACJA_ZARZAD, C_D.NUMER_FV
FROM company_documents_actions AS C_D_A
LEFT JOIN company_documents AS C_D ON C_D.id_document = C_D_A.document_id `);
    const thresholdDate = new Date("2025-05-14"); // YYYY-MM-DD

    const result = historyDoc.filter((doc) => {
      const infoZarzad = Array.isArray(doc.INFORMACJA_ZARZAD)
        ? doc.INFORMACJA_ZARZAD
        : [];
      const ostatecznaData = Array.isArray(doc.OSTATECZNA_DATA_ROZLICZENIA)
        ? doc.OSTATECZNA_DATA_ROZLICZENIA
        : [];

      // Funkcja pomocnicza do wyciągania i porównywania dat
      const containsRecentDate = (arr) =>
        arr.some((entry) => {
          const match = entry.match(/^(\d{2})-(\d{2})-(\d{4})/); // Szukamy daty na początku
          if (!match) return false;
          const [_, dd, mm, yyyy] = match;
          const entryDate = new Date(`${yyyy}-${mm}-${dd}`);
          return entryDate >= thresholdDate;
        });

      return (
        containsRecentDate(infoZarzad) || containsRecentDate(ostatecznaData)
      );
    });
    const reportDate = "2025-05-14";
    console.log(result[21]);

    //         for (const doc of result) {
    //             const [docDuplicate] = await connect_SQL.query(`SELECT * FROM company_windykacja.company_management_date_description_FK
    // WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ?`, [doc.NUMER_FV, reportDate]);
    //             if (docDuplicate.length) {
    //                 // console.log(docDuplicate);

    //             } else {
    //                 console.log(doc);
    //             }
    //         }

    // for (const doc of result) {
    //     if (doc.NUMER_FV === 'FV/UBL/1008/24/A/D38') {
    //         console.log(doc);
    //     }

    //     // await connect_SQL.query(
    //     //     `INSERT INTO company_management_date_description_FK (NUMER_FV, HISTORIA_ZMIANY_DATY_ROZLICZENIA, INFORMACJA_ZARZAD, WYKORZYSTANO_RAPORT_FK, COMPANY ) VALUES ( ?, ?, ?, ?, ?)`,
    //     //     [
    //     //         doc.NUMER_FV,
    //     //         JSON.stringify(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA : []),
    //     //         JSON.stringify(doc.INFORMACJA_ZARZAD ? doc.INFORMACJA_ZARZAD : []),
    //     //         reportDate,
    //     //         'KRT'

    //     //     ]);

    // }
  } catch (error) {
    console.error(error);
  }
};

//do wyciągnięcia maili ownerów
const getOwnersMail = async (company) => {
  try {
    const [owners] = await connect_SQL.query(
      `SELECT OWNER FROM company_join_items
            WHERE COMPANY = ?`,
      [company]
    );

    const uniqueOwners = [...new Set(owners.flatMap((obj) => obj.OWNER))].sort(
      (a, b) => a.localeCompare(b, "pl", { sensitivity: "base" })
    );

    let mailArray = [];
    for (const owner of uniqueOwners) {
      const [mailOwner] = await connect_SQL.query(
        `SELECT OWNER_MAIL FROM company_owner_items
            WHERE OWNER = ?`,
        [owner]
      );
      // console.log(owner);
      mailArray.push(mailOwner[0].OWNER_MAIL);
    }

    console.log(mailArray.join("; "));
  } catch (error) {
    console.error(error);
  }
};

// zmiana roli użytkownika, jesli posiada FK to będzie zmieniony na FK_KRT
const changeUserRole = async () => {
  try {
    const [owners] = await connect_SQL.query(
      `SELECT id_user, roles FROM company_users`
    );

    // Zmieniamy "FK" na "FK_KRT" w każdym obiekcie
    const updatedFilteredData = owners
      .filter((obj) => obj.roles.hasOwnProperty("FK"))
      .map((obj) => {
        obj.roles["FK_KRT"] = obj.roles["FK"];
        delete obj.roles["FK"];
        return obj;
      });

    for (const owner of updatedFilteredData) {
      await connect_SQL.query(
        "UPDATE company_users SET roles = ? WHERE id_user = ?",
        [JSON.stringify(owner.roles), owner.id_user]
      );
      console.log(owner.roles);
    }
  } catch (error) {
    console.error(error);
  }
};

const prepareToNewCompany = async () => {
  try {
    // zmiana roli użytkownika, jesli posiada FK to będzie zmieniony na FK_KRT
    await changeUserRole();

    //dopasowanie bazy danych do rozszerzenia ról FK
    await connect_SQL.query(
      `UPDATE company_settings 
SET roles = JSON_ARRAY(
    JSON_OBJECT(
        'FK_KRT', 200,
         'FK_KEM', 201,
          'FK_RAC', 202,
        'Nora', 300,
        'Root', 5000,
        'User', 100,
        'Admin', 1000,
        'Start', 1,
        'Editor', 110,
        'Controller', 120,
        'SuperAdmin', 2000
    )
)
WHERE id_setting = 1`
    );

    //dodanie dodatkowej firmy RAC
    // await connect_SQL.query(
    //     `UPDATE testy_windykacja.company_settings
    //     SET company = JSON_ARRAY("KRT", "KEM", "RAC")
    //     WHERE id_setting = 1`);

    await connect_SQL.query(
      `UPDATE company_settings 
            SET company = JSON_ARRAY("KRT", "KEM")
            WHERE id_setting = 1`
    );
  } catch (error) {
    console.error(error);
  }
};

// pobranie poczatkowych faktur RAC, nierozliczonych w całym okresie
const getRacData = async () => {
  console.log("start getRacData");
  try {
    //   const query = `SELECT
    //   [faktn_fakt_nr_caly] AS NUMER_FV
    // ,[faktp_og_brutto] AS BRUTTO
    //   ,[faktp_og_netto] AS NETTO
    //  ,[faktn_zaplata_kwota] AS DO_ROZLICZENIA
    //   ,CONVERT(VARCHAR(10), [dataWystawienia], 23) AS DATA_FV
    //   	  ,CONVERT(VARCHAR(10), [terminPlatnosci], 23) AS TERMIN
    //    ,[kl_nazwa] AS KONTRAHENT
    //       ,[faktn_wystawil] AS DORADCA
    // ,null AS NR_REJESTRACYJNY
    //   ,null AS UWAGI_Z_FAKTURY
    //     ,[typSprzedazy] AS TYP_PLATNOSCI
    //       ,[kl_nip] AS NIP
    // FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
    //   WHERE faktn_zaplata_status != 'Zapłacono całkowicie'`;

    const query = `SELECT  
    [faktn_fakt_nr_caly] AS NUMER_FV,
    SUM([faktp_og_brutto]) AS BRUTTO,
    SUM([faktp_og_netto]) AS NETTO,
    SUM([faktn_zaplata_kwota]) AS DO_ROZLICZENIA,
    CONVERT(VARCHAR(10), MIN([dataWystawienia]), 23) AS DATA_FV,
    CONVERT(VARCHAR(10), MIN([terminPlatnosci]), 23) AS TERMIN,
    MAX([kl_nazwa]) AS KONTRAHENT,
    MAX([faktn_wystawil]) AS DORADCA,
    NULL AS NR_REJESTRACYJNY,
    NULL AS UWAGI_Z_FAKTURY,
    MAX([typSprzedazy]) AS TYP_PLATNOSCI,
    MAX([kl_nip]) AS NIP   
FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
WHERE faktn_zaplata_status != 'Zapłacono całkowicie'
GROUP BY [faktn_fakt_nr_caly];
`;

    const documents = await msSqlQuery(query);

    const values = documents.map((item) => [
      item.NUMER_FV,
      item.BRUTTO,
      item.NETTO,
      "RAC",
      item.DO_ROZLICZENIA,
      item.DATA_FV,
      item.TERMIN,
      item.KONTRAHENT,
      item.DORADCA || "Brak danych",
      item.NR_REJESTRACYJNY,
      null,
      item.UWAGI_Z_FAKTURY,
      item.TYP_PLATNOSCI,
      item.NIP,
      null,
      null,
      null,
      "RAC",
    ]);

    const queryIns = `
       INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA)
       VALUES 
         ${values
           .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
           .join(", ")}
     `;

    await connect_SQL.query(queryIns, values.flat());
    console.log("finish getRacData");
  } catch (error) {
    console.error(error);
  }
};
// pobranie  faktur RAC od 01-01-2024
const getRacDataTime = async () => {
  console.log("start getRacDataTime");

  try {
    //   const query = `SELECT
    //   [faktn_fakt_nr_caly] AS NUMER_FV
    // ,[faktp_og_brutto] AS BRUTTO
    //   ,[faktp_og_netto] AS NETTO
    //  ,[faktn_zaplata_kwota] AS DO_ROZLICZENIA
    //   ,CONVERT(VARCHAR(10), [dataWystawienia], 23) AS DATA_FV
    //   	  ,CONVERT(VARCHAR(10), [terminPlatnosci], 23) AS TERMIN
    //    ,[kl_nazwa] AS KONTRAHENT
    //       ,[faktn_wystawil] AS DORADCA
    // ,[faktp_rejestr] AS NR_REJESTRACYJNY
    //   ,[uwagiFaktura] AS UWAGI_Z_FAKTURY
    //     ,[typSprzedazy] AS TYP_PLATNOSCI
    //       ,[kl_nip] AS NIP
    // FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
    //   WHERE [dataWystawienia] >= '2024-01-01'`;
    const query = `SELECT  
    [faktn_fakt_nr_caly] AS NUMER_FV,
    SUM([faktp_og_brutto]) AS BRUTTO,
    SUM([faktp_og_netto]) AS NETTO,
    SUM([faktn_zaplata_kwota]) AS DO_ROZLICZENIA,
    CONVERT(VARCHAR(10), MIN([dataWystawienia]), 23) AS DATA_FV,
    CONVERT(VARCHAR(10), MIN([terminPlatnosci]), 23) AS TERMIN,
    MAX([kl_nazwa]) AS KONTRAHENT,
    MAX([faktn_wystawil]) AS DORADCA,
    MAX([faktp_rejestr]) AS NR_REJESTRACYJNY,
    MAX([uwagiFaktura]) AS UWAGI_Z_FAKTURY,
    MAX([typSprzedazy]) AS TYP_PLATNOSCI,
    MAX([kl_nip]) AS NIP
FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
WHERE [dataWystawienia] >= '2024-01-01'
GROUP BY [faktn_fakt_nr_caly];
`;

    const documents = await msSqlQuery(query);

    const values = documents.map((item) => [
      item.NUMER_FV,
      item.BRUTTO,
      item.NETTO,
      "RAC",
      item.DO_ROZLICZENIA,
      item.DATA_FV,
      item.TERMIN,
      item.KONTRAHENT,
      item.DORADCA || "Brak danych",
      item.NR_REJESTRACYJNY,
      null,
      item.UWAGI_Z_FAKTURY,
      item.TYP_PLATNOSCI,
      item.NIP,
      null,
      null,
      null,
      "RAC",
    ]);

    const queryIns = `
       INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA)
       VALUES 
         ${values
           .map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)")
           .join(", ")}
     `;

    await connect_SQL.query(queryIns, values.flat());

    console.log("finish getRacDataTime");
  } catch (error) {
    console.error(error);
  }
};

// zapytanie o rozliczenia RAC do Symfoni
const today = new Date();
const todayDate = today.toISOString().split("T")[0];
const querySettlementsFK = `
DECLARE @datado DATETIME = '${todayDate}';
DECLARE @DataDoDate DATE = CAST(@datado AS DATE);
DECLARE @DataDoPlusJedenDzien DATE = DATEADD(day, 1, @DataDoDate);

WITH
-- Krok 1: Pre-agregacja rozrachunków. To jest najlepsza praktyka i pozostaje bez zmian.
cte_Rozrachunki AS (
    SELECT
        transakcja,
        SUM(kwota * SIGN(0.5 - strona)) AS WnMaRozliczono,
        SUM(CASE WHEN walutaObca IS NULL THEN kwota_w ELSE rozliczonoWO END * SIGN(0.5 - strona)) AS WnMaRozliczono_w
    FROM FK_Rent_SK.FK.rozrachunki
    WHERE dataokr < @DataDoPlusJedenDzien AND czyRozliczenie = 1 AND potencjalna = 0
    GROUP BY transakcja
),
-- Krok 2: Przygotowanie trzech podstawowych bloków danych z wstępną agregacją.
-- Blok A: Zobowiązania - część 1
cte_Zobowiazania_Blok_A AS (
    SELECT
        dsymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            (CASE WHEN orgstrona = 0 THEN SUM(rozdata.kwota) ELSE -SUM(rozdata.kwota) END) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 1 OR (rozdata.strona = 0 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND rozdata.strona = 1
    GROUP BY dsymbol, termin, orgstrona, synt, poz1, poz2, kpu.skrot, rozdata.kurs
),
-- Blok B: Zobowiązania - część 2
cte_Zobowiazania_Blok_B AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) -
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.baza = 2 AND rozdata.synt IN (201, 203)
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND rozdata.rozliczona = 0 AND rozdata.termin <= @DataDoDate
      AND rozdata.strona = 0 AND rozdata.kwota < 0 AND rozdata.doRozlZl > 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Blok C: Należności
cte_Naleznosci_Blok_C AS (
    SELECT
        dSymbol, CAST(termin AS DATE) AS termin,
        DATEDIFF(DAY, termin, @DataDoDate) AS dniPrzetreminowania,
        synt, poz1, poz2, kpu.skrot AS kontrahent,
        ROUND(
            SUM(rozdata.kwota) +
            SUM(CASE WHEN rr.WnMaRozliczono < 0 AND kurs <> 0 THEN ISNULL(rr.WnMaRozliczono_w, 0) * rozdata.kurs ELSE ISNULL(rr.WnMaRozliczono, 0) END)
        , 2) AS overdue
    FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
    LEFT JOIN cte_Rozrachunki AS rr ON rr.transakcja = rozdata.id
    LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci AS kpu ON rozdata.kontrahent = kpu.pozycja
    WHERE rozdata.potencjalna = 0 AND rozdata.synt IN (201, 203)
      AND rozdata.dataokr < @DataDoPlusJedenDzien AND rozdata.baza = 2
      AND (rozdata.strona = 0 OR (rozdata.strona = 1 AND rozdata.kwota < 0))
      AND NOT (rozdata.rozliczona = 1 AND rozdata.dataOstat < @DataDoPlusJedenDzien)
      AND strona = 0 AND rozdata.orgStrona = 0
    GROUP BY dSymbol, termin, synt, poz1, poz2, kpu.skrot
),
-- Krok 3: Połączenie wstępnie zagregowanych bloków z zachowaniem oryginalnej logiki UNION / UNION ALL
cte_Wszystkie_Transakcje AS (
    -- Tutaj odtwarzamy oryginalny UNION, który usuwa duplikaty między dwoma blokami zobowiązań
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_A
    UNION
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Zobowiazania_Blok_B
    UNION ALL
    -- A następnie dodajemy należności
    SELECT dsymbol, termin, dniPrzetreminowania, synt, poz1, poz2, kontrahent, overdue FROM cte_Naleznosci_Blok_C
),
-- Krok 4: Końcowa, spłaszczona agregacja. To jest znacznie wydajniejsze niż wielopoziomowe grupowanie.
cte_Zagregowane AS (
    SELECT
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania,
        SUM(overdue) AS płatność
    FROM cte_Wszystkie_Transakcje
    GROUP BY
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania
),
-- Krok 5: Finałowe obliczenia (funkcje okna, przedziały) i filtrowanie zer
cte_WynikKoncowy AS (
    SELECT
        @DataDoDate AS stanNa,
        dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, płatność,
        CASE
            WHEN DniPrzetreminowania < 1   THEN '< 1'
            WHEN DniPrzetreminowania <= 30 THEN '1 - 30'
            WHEN DniPrzetreminowania <= 60 THEN '31 - 60'
            WHEN DniPrzetreminowania <= 90 THEN '61 - 90'
            WHEN DniPrzetreminowania <= 180 THEN '91 - 180'
            WHEN DniPrzetreminowania <= 360 THEN '181 - 360'
            ELSE '> 360'
        END AS przedział,
        -- Warunkowe obliczanie salda
        SUM(płatność) OVER (
            PARTITION BY synt, CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END
        ) AS saldoKontrahent
    FROM cte_Zagregowane
    WHERE ROUND(płatność, 2) <> 0
)
-- Końcowy SELECT
SELECT
    stanNa,
    dsymbol, kontrahent, synt, poz1, poz2, termin, dniPrzetreminowania, przedział, płatność,
    ROUND(saldoKontrahent, 2) AS saldoKontrahent,
    CASE
        WHEN ROUND(saldoKontrahent, 2) > 0 THEN 'N'
        WHEN ROUND(saldoKontrahent, 2) < 0 THEN 'Z'
        ELSE 'R'
    END AS Typ
FROM cte_WynikKoncowy
ORDER BY
    synt,
    CASE WHEN synt = 201 THEN poz2 WHEN synt = 203 THEN poz1 END,
    termin;
    `;
// testowe rozrachunki dla RAC
const settlementsRAC = async () => {
  console.log("start settlementsRAC");

  try {
    await connect_SQL.query(
      ` DELETE FROM company_settlements WHERE COMPANY = 'RAC'`
    );

    const documents = await msSqlQuery(querySettlementsFK);

    const values = documents.map((item) => [
      item.dsymbol,
      item.termin,
      item["płatność"],
      "RAC",
    ]);

    const queryIns = `
         INSERT IGNORE INTO company_settlements
           ( NUMER_FV, DATA_FV, NALEZNOSC, COMPANY)
         VALUES
           ${values.map(() => "(?, ?, ?, ?)").join(", ")}
       `;
    // Wykonanie zapytania INSERT
    await connect_SQL.query(queryIns, values.flat());

    console.log("finish settlementsRAC");
  } catch (error) {
    console.error(error);
  }
};

const addRacCompany = async () => {
  try {
    console.log("start addRacCompany");
    await connect_SQL.query(
      `UPDATE company_settings 
            SET company = JSON_ARRAY("KRT", "KEM", "RAC")
            WHERE id_setting = 1`
    );
    console.log("finish addRacCompany");
  } catch (error) {
    console.error(error);
  }
};

const tableColumnsForRAC = async () => {
  console.log("start columns");

  try {
    const [columns] = await connect_SQL.query(
      "SELECT * FROM company_table_columns"
    );

    // columns.forEach((column) => {
    //   const areas = column.areas;
    //   console.log(areas);

    //   // Liczymy ile jest available: true
    //   const availableCount = areas.filter((area) => area.available).length;
    //   // Jeśli więcej niż 3, ustawiamy RAC na available: true
    //   if (availableCount > 3) {
    //     const racArea = areas.find((area) => area.name === "RAC");

    //     if (racArea) {
    //       racArea.available = true;
    //     }
    //   }
    // });
    columns.forEach((column) => {
      const areas = column.areas;

      // Liczymy ile jest available: true
      const availableCount = areas.filter((area) => area.available).length;

      // Dodajemy nowy obiekt RAC
      areas.push({
        hide: false,
        name: "RAC",
        available: availableCount >= 3, // true jeśli >= 3, w przeciwnym razie false
      });
    });

    // const test = columns.map((item) => {
    //   console.log(item);
    // });

    for (const col of columns) {
      console.log(col);
      await connect_SQL.query(
        `
              UPDATE company_table_columns SET areas = ?
      WHERE id_table_columns = ?;
        `,
        [JSON.stringify(col.areas), col.id_table_columns]
      );
    }
    console.log("finish columns");
  } catch (error) {
    console.error(error);
  }
};

const dataFromRAC = [
  {
    Termin: "9/12/25",
    Kwota: "48,596.07 zł",
    Podmiot: "ANG 2 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "6912571296",
    Faktura: "FV/274/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "119,525.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/275/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "35,523.63 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/276/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,870.80 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/277/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,870.80 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/278/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,870.80 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/279/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "3,118.05 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/280/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "5,412.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/281/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "5,412.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/282/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "5,412.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/283/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "5,043.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/284/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "1,735.53 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/285/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "5,289.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/286/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "2,851.96 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/287/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "2,217.69 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/288/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "2,649.01 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/289/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,022.10 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/290/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "3,965.52 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/291/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "464.94 zł",
    Podmiot: "CERSANIT",
    NIP: "5640001666",
    Faktura: "FV/292/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/28/25",
    Kwota: "17,158.50 zł",
    Podmiot: "FTFSERVICESSPÓŁKAZOGRANICZONĄODPOWIEDZI",
    NIP: "9591689008",
    Faktura: "FV/293/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,403.40 zł",
    Podmiot: "HAPRO ROMAN HAŁKA LECH PROCHOWSKI SPÓŁKA",
    NIP: "9521674467",
    Faktura: "FV/294/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "4,059.00 zł",
    Podmiot: "Inga Kuśnierz Productions",
    NIP: "6793251822",
    Faktura: "FV/295/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/28/25",
    Kwota: "688.80 zł",
    Podmiot: "ORLENSYNTHOSGREENENERGYSPÓŁKAZOGRANICZO",
    NIP: "5252910856",
    Faktura: "FV/296/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "11,547.24 zł",
    Podmiot: "PARISTOBACCOINTERNATIONALMANUFACTURINGS",
    NIP: "5252739374",
    Faktura: "FV/297/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "123.00 zł",
    Podmiot: "PARD EUROPE",
    NIP: "5223189907",
    Faktura: "FV/298/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "123.00 zł",
    Podmiot: "Adam Duk",
    NIP: "",
    Faktura: "FV/299/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "400.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/300/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "246.00 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/301/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/28/25",
    Kwota: "3,932.36 zł",
    Podmiot: "ORLENSYNTHOSGREENENERGYSPÓŁKAZOGRANICZO",
    NIP: "5252910856",
    Faktura: "FV/302/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/28/25",
    Kwota: "2,070.09 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/303/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "426.40 zł",
    Podmiot: "JOWY SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "7010940501",
    Faktura: "FV/304/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/12/25",
    Kwota: "639.59 zł",
    Podmiot: "QUANTA CARS",
    NIP: "5532513487",
    Faktura: "FV/305/08/2025",
    Data: "8/29/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,266.88 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/142/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,029.50 zł",
    Podmiot: "AD02 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "7963026735",
    Faktura: "FV/143/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,075.00 zł",
    Podmiot: "AD02 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "7963026735",
    Faktura: "FV/144/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "5,768.70 zł",
    Podmiot: "AGENCJA ROZWOJU PRZEMYSŁU SPÓŁKA AKCYJNA",
    NIP: "5260300204",
    Faktura: "FV/145/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "5,768.70 zł",
    Podmiot: "AGENCJA ROZWOJU PRZEMYSŁU SPÓŁKA AKCYJNA",
    NIP: "5260300204",
    Faktura: "FV/146/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,920.00 zł",
    Podmiot: "ALG PHARMA SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "5272715595",
    Faktura: "FV/147/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,628.50 zł",
    Podmiot: "ALL SPICE NIEGODZISZ SPÓŁKA JAWNA",
    NIP: "1182165114",
    Faktura: "FV/148/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,305.00 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/149/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,813.00 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/150/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "10,147.50 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/151/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "5,658.00 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/152/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,742.90 zł",
    Podmiot: "ALPLA OPAKOWANIA Z TWORZYW SZTUCZNYCH",
    NIP: "5530101361",
    Faktura: "FV/153/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,185.70 zł",
    Podmiot: "ANGELI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIAL",
    NIP: "5222880211",
    Faktura: "FV/154/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,567.00 zł",
    Podmiot: "HEXPERTA SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5253010215",
    Faktura: "FV/155/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,321.00 zł",
    Podmiot: "AXENDI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIAL",
    NIP: "7010150673",
    Faktura: "FV/156/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,259.50 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/157/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,640.80 zł",
    Podmiot: "BLUMENBECKER ENGINEERING POLSKA SPÓŁKA Z",
    NIP: "6312090482",
    Faktura: "FV/158/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,640.80 zł",
    Podmiot: "BLUMENBECKER ENGINEERING POLSKA SPÓŁKA Z",
    NIP: "6312090482",
    Faktura: "FV/159/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,804.40 zł",
    Podmiot: "Centrum Św. Hildegardy w Józefowie Elżbi",
    NIP: "5321671924",
    Faktura: "FV/160/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,936.00 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/161/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,127.90 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/162/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,936.00 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/163/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,127.90 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/164/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/165/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,939.70 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/166/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,570.70 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/167/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "3,013.50 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/168/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,447.70 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/169/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,693.70 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/170/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "3,136.50 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/171/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,755.20 zł",
    Podmiot: 'DEN-KOZ-""SCAN"" DENIS KOZUB',
    NIP: "6452501749",
    Faktura: "FV/172/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,923.70 zł",
    Podmiot: "DERMAPROFILSPÓŁKAZOGRANICZONĄODPOWIEDZI",
    NIP: "1132823609",
    Faktura: "FV/173/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,292.70 zł",
    Podmiot: "DOBTELZygmuntDobosz",
    NIP: "5631283607",
    Faktura: "FV/174/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,321.00 zł",
    Podmiot: "EON GROUP SŁAWOMIR ZDOBYLAK-BARAN",
    NIP: "6921017292",
    Faktura: "FV/175/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "4,637.10 zł",
    Podmiot: "ESSITY POLAND",
    NIP: "5252534850",
    Faktura: "FV/176/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,693.70 zł",
    Podmiot: "FARADAGROUPSPÓŁKAZOGRANICZONĄODPOWIEDZI",
    NIP: "7142055285",
    Faktura: "FV/177/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,169.70 zł",
    Podmiot: "FROMATECH INGREDIENTS POLAND SPÓŁKA Z OG",
    NIP: "7792552516",
    Faktura: "FV/178/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,570.70 zł",
    Podmiot: "GAMA MARIA ISKRA AGENCJA PRACY TYMCZAS",
    NIP: "5291736428",
    Faktura: "FV/179/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,649.42 zł",
    Podmiot: "GSCS POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "7010942606",
    Faktura: "FV/180/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,415.70 zł",
    Podmiot: "GSCS POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "7010942606",
    Faktura: "FV/181/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,194.30 zł",
    Podmiot: "GSCS POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "7010942606",
    Faktura: "FV/182/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "5,643.24 zł",
    Podmiot: "GT RENT FLEET MANAGEMENT SPÓŁKA Z OGRANI",
    NIP: "5222911354",
    Faktura: "FV/183/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,936.00 zł",
    Podmiot: "HELLMANNWORLDWIDELOGISTICSPOLSKASPÓŁKAZ",
    NIP: "1230005823",
    Faktura: "FV/184/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,616.20 zł",
    Podmiot: "HUSQVARNA POLAND",
    NIP: "5242560627",
    Faktura: "FV/185/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,554.70 zł",
    Podmiot: "ICSECSPÓŁKAAKCYJNA",
    NIP: "7811986010",
    Faktura: "FV/186/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,693.70 zł",
    Podmiot: "INTEGRATED PROFESSIONAL SOLUTIONS SPÓŁKA",
    NIP: "5272493120",
    Faktura: "FV/187/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,693.70 zł",
    Podmiot: "INTEGRATED PROFESSIONAL SOLUTIONS SPÓŁKA",
    NIP: "5272493120",
    Faktura: "FV/188/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,742.90 zł",
    Podmiot: "IntelligentLogisticsSolutionsSp.zo.o.",
    NIP: "9471981723",
    Faktura: "FV/189/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,923.70 zł",
    Podmiot: "IntelligentLogisticsSolutionsSp.zo.o.",
    NIP: "9471981723",
    Faktura: "FV/190/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,923.70 zł",
    Podmiot: "IntelligentLogisticsSolutionsSp.zo.o.",
    NIP: "9471981723",
    Faktura: "FV/191/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,878.20 zł",
    Podmiot: "JPM  S.C. JOLANTA PIERZAK, RADOSŁAW PIE",
    NIP: "6571013849",
    Faktura: "FV/192/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,400.00 zł",
    Podmiot: "KA MARKETINGBUREAU",
    NIP: "NL005252122B45",
    Faktura: "FV/193/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "541.20 zł",
    Podmiot: "KISZ Jakub Sienkiewicz",
    NIP: "5361901537",
    Faktura: "FV/194/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,460.00 zł",
    Podmiot: "KMRent Klaudia Stankiewicz",
    NIP: "8231674978",
    Faktura: "FV/195/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,075.00 zł",
    Podmiot: "KT Kacper Tarnawczyk",
    NIP: "6252499692",
    Faktura: "FV/196/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,644.50 zł",
    Podmiot: "MARTIKA MARTA SZPARAGA",
    NIP: "9512528341",
    Faktura: "FV/197/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,927.40 zł",
    Podmiot: "MEDEZINSPÓŁKAZOGRANICZONĄODPOWIEDZIALNO",
    NIP: "9471979904",
    Faktura: "FV/198/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "1,766.28 zł",
    Podmiot: "MK BUD SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIAL",
    NIP: "8681967522",
    Faktura: "FV/200/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,907.70 zł",
    Podmiot: "MONTEL Jan Wyszyński",
    NIP: "5311718914",
    Faktura: "FV/201/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,091.00 zł",
    Podmiot: "MONTEL Jan Wyszyński",
    NIP: "5311718914",
    Faktura: "FV/202/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,795.77 zł",
    Podmiot: "MOVATOO ASSETS SPÓŁKA Z OGRANICZONĄ ODPO",
    NIP: "5223160252",
    Faktura: "FV/203/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "1,832.70 zł",
    Podmiot: "NANOVOSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010406380",
    Faktura: "FV/204/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "1,832.70 zł",
    Podmiot: "NANOVOSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010406380",
    Faktura: "FV/205/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "369.00 zł",
    Podmiot: "NAPOLLOHOLDINGSPÓŁKAZOGRANICZONĄODPOWIE",
    NIP: "9512218764",
    Faktura: "FV/206/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "2,570.70 zł",
    Podmiot: "NEXTERIOSPÓŁKAZOGRANICZONĄODPOWIEDZIALN",
    NIP: "6572919109",
    Faktura: "FV/207/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,321.00 zł",
    Podmiot: "OLENSEN GROUP SPÓŁKA Z OGRANICZONĄ ODPOW",
    NIP: "9542847298",
    Faktura: "FV/208/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "14,269.64 zł",
    Podmiot: "TIKROWSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "5223102929",
    Faktura: "FV/209/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,460.00 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/210/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,460.00 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/211/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,185.70 zł",
    Podmiot: "PARADOX",
    NIP: "5632452986",
    Faktura: "FV/212/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,120.50 zł",
    Podmiot: "PARD EUROPE",
    NIP: "5223189907",
    Faktura: "FV/213/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,911.40 zł",
    Podmiot: "PARD EUROPE",
    NIP: "5223189907",
    Faktura: "FV/214/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,120.50 zł",
    Podmiot: "PARD EUROPE",
    NIP: "5223189907",
    Faktura: "FV/215/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,389.87 zł",
    Podmiot: "PARKDEPOT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZ",
    NIP: "6343007743",
    Faktura: "FV/216/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "1,955.70 zł",
    Podmiot: "PRIMEPOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5322112090",
    Faktura: "FV/217/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,136.50 zł",
    Podmiot: "RELYON RECRUITMENT SPÓŁKA Z OGRANICZONĄ",
    NIP: "5213564769",
    Faktura: "FV/218/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "1,920.03 zł",
    Podmiot: "SAVILLS",
    NIP: "5262771913",
    Faktura: "FV/219/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,362.83 zł",
    Podmiot: "SAVILLS",
    NIP: "5262771913",
    Faktura: "FV/220/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/18/25",
    Kwota: "2,570.70 zł",
    Podmiot: "SAVILLS",
    NIP: "5262771913",
    Faktura: "FV/221/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "6,027.00 zł",
    Podmiot: "SJ GLOBAL LOGIS SPÓŁKA Z OGRANICZONĄ ODP",
    NIP: "8992998275",
    Faktura: "FV/222/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "2,570.70 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/223/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "2,570.70 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/224/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "2,570.70 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/225/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "2,388.25 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/226/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "4,563.30 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/227/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "4,022.10 zł",
    Podmiot: "SGP-SORTINGGROUPPOLANDSPÓŁKAZOGRANICZON",
    NIP: "9492069403",
    Faktura: "FV/228/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "6,949.50 zł",
    Podmiot: "SUNGREEN SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7311717123",
    Faktura: "FV/229/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,078.70 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/230/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "4,169.70 zł",
    Podmiot: "SYNTHOS GREEN ENERGY SPÓŁKA AKCYJNA",
    NIP: "5492454116",
    Faktura: "FV/231/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,415.70 zł",
    Podmiot: "SZYBKA HALA SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "5214032856",
    Faktura: "FV/232/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,489.50 zł",
    Podmiot: "Teatr Żydowski im. Estery Rachel i Idy K",
    NIP: "5250009795",
    Faktura: "FV/233/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,923.70 zł",
    Podmiot: "THERMO SUN SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7010692960",
    Faktura: "FV/234/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "5,153.70 zł",
    Podmiot: 'Bartosz Huras ""Unico""',
    NIP: "5732310435",
    Faktura: "FV/235/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,650.65 zł",
    Podmiot: "UNIDEVELOPMENT",
    NIP: "5213483781",
    Faktura: "FV/236/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,185.70 zł",
    Podmiot: "VATANMED CLINIC POLAND SPÓŁKA Z OGRANICZ",
    NIP: "7011113527",
    Faktura: "FV/237/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "459.20 zł",
    Podmiot: "WLS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNOŚ",
    NIP: "5213906626",
    Faktura: "FV/238/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,554.70 zł",
    Podmiot: "ZAMEK KRÓLEWSKI W WARSZAWIE - MUZEUM. RE",
    NIP: "5260001312",
    Faktura: "FV/239/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "11,439.00 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/240/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "14,291.37 zł",
    Podmiot: "PARISTOBACCOCOMMERCIALSPÓŁKAZOGRANICZON",
    NIP: "5252758733",
    Faktura: "FV/241/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "9,926.10 zł",
    Podmiot: "PARISTOBACCOCOMMERCIALSPÓŁKAZOGRANICZON",
    NIP: "5252758733",
    Faktura: "FV/242/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,650.00 zł",
    Podmiot: "TexoTradeServicesGmbH",
    NIP: "DE348414410",
    Faktura: "FV/243/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "47,373.45 zł",
    Podmiot: "OPERATORCHMURYKRAJOWEJSPÓŁKAZOGRANICZON",
    NIP: "5252775789",
    Faktura: "FV/244/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "45,313.20 zł",
    Podmiot: "EuropeanPeaceFacility–EUMAMUkraineCAT-C",
    NIP: "",
    Faktura: "FV/245/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,206.60 zł",
    Podmiot: "RAIL FORCE ONE POLAND",
    NIP: "5213860350",
    Faktura: "FV/246/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,185.70 zł",
    Podmiot: "GOLDBECK SOLAR POLSKA SPÓŁKA Z OGRANICZO",
    NIP: "7773374410",
    Faktura: "FV/247/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,504.27 zł",
    Podmiot: "GOLDBECK SOLAR POLSKA SPÓŁKA Z OGRANICZO",
    NIP: "7773374410",
    Faktura: "FV/248/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "4,354.20 zł",
    Podmiot: "GOLDBECK SOLAR POLSKA SPÓŁKA Z OGRANICZO",
    NIP: "7773374410",
    Faktura: "FV/249/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,706.00 zł",
    Podmiot: "RESPECTENERGYFLEETSPÓŁKAZOGRANICZONĄODP",
    NIP: "5252864151",
    Faktura: "FV/250/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "4,392.66 zł",
    Podmiot: "Adam Duk",
    NIP: "",
    Faktura: "FV/251/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "3,001.20 zł",
    Podmiot: "BeataMarchel-DobrowolskaPłońsk",
    NIP: "",
    Faktura: "FV/252/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,198.00 zł",
    Podmiot: "Jerzy Nowakowski",
    NIP: "",
    Faktura: "FV/253/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "3,200.00 zł",
    Podmiot: "MARZENA KOŚKA",
    NIP: "",
    Faktura: "FV/254/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "5,578.48 zł",
    Podmiot: "EXCELLENT KONRAD ADAMCZUK",
    NIP: "7123431209",
    Faktura: "FV/255/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "6,785.90 zł",
    Podmiot: "FERCHAU POLAND SPÓŁKA Z OGRANICZONĄ ODPO",
    NIP: "5833157047",
    Faktura: "FV/256/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "3,290.00 zł",
    Podmiot: "FONROCHE LIGHTING SAS",
    NIP: "34749986030",
    Faktura: "FV/257/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "6,820.00 zł",
    Podmiot: "POLMARKUS S.R.O.",
    NIP: "CZ26864606",
    Faktura: "FV/258/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,827.77 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/259/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,827.77 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/260/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "1,906.50 zł",
    Podmiot: "MONTEL Jan Wyszyński",
    NIP: "5311718914",
    Faktura: "FV/261/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "623.00 zł",
    Podmiot: "MOVATOO ASSETS SPÓŁKA Z OGRANICZONĄ ODPO",
    NIP: "5223160252",
    Faktura: "FV/262/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "54,489.00 zł",
    Podmiot: "QUANTA CARS",
    NIP: "5532513487",
    Faktura: "FV/263/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "20,823.90 zł",
    Podmiot: "SONKO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "8961504875",
    Faktura: "FV/264/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "15,979.67 zł",
    Podmiot: "TARTAK BIAŁOBŁOCIE SPÓŁKA Z OGRANICZONĄ",
    NIP: "7671723634",
    Faktura: "FV/265/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,029.50 zł",
    Podmiot: "WIELOBRANŻOWE PRZEDSIĘBIORSTWO INWESTYCY",
    NIP: "5730105694",
    Faktura: "FV/266/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/27/25",
    Kwota: "16,676.34 zł",
    Podmiot: "ZENITH PARTNERS SPÓŁKA Z OGRANICZONĄ ODP",
    NIP: "9372746019",
    Faktura: "FV/267/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "2,583.00 zł",
    Podmiot: "ZEPPELIN POLSKA SPÓŁKA Z OGRANICZONĄ ODP",
    NIP: "5213224223",
    Faktura: "FV/268/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "8,991.30 zł",
    Podmiot: "TURKA INVEST",
    NIP: "5342468080",
    Faktura: "FV/269/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "8/28/25",
    Kwota: "740.00 zł",
    Podmiot: "MAGDALENA ZIÓŁCZYŃSKA",
    NIP: "",
    Faktura: "FV/270/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "3,039.33 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/271/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "4,157.40 zł",
    Podmiot: "DANIEL DARIUSZ CYLC",
    NIP: "",
    Faktura: "FV/272/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/11/25",
    Kwota: "6,420.60 zł",
    Podmiot: "RICHMOND VALENTINE SPÓŁKA Z OGRANICZONĄ",
    NIP: "5252677147",
    Faktura: "FV/273/08/2025",
    Data: "8/28/25",
  },
  {
    Termin: "9/10/25",
    Kwota: "15,985.90 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/136/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/26/25",
    Kwota: "5,875.62 zł",
    Podmiot: "NEXTERIOSPÓŁKAZOGRANICZONĄODPOWIEDZIALN",
    NIP: "6572919109",
    Faktura: "FV/137/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/26/25",
    Kwota: "1,082.40 zł",
    Podmiot: "BILLENNIUM SPÓŁKA AKCYJNA",
    NIP: "5252259585",
    Faktura: "FV/138/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/10/25",
    Kwota: "4,091.25 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/139/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/10/25",
    Kwota: "639.60 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/140/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/10/25",
    Kwota: "3,873.13 zł",
    Podmiot: "PRIMEPOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5322112090",
    Faktura: "FV/141/08/2025",
    Data: "8/27/25",
  },
  {
    Termin: "9/16/25",
    Kwota: "123.00 zł",
    Podmiot: "DAIKIN MANUFACTURING POLAND SPÓŁKA Z OGR",
    NIP: "7272858752",
    Faktura: "FV/129/08/2025",
    Data: "8/26/25",
  },
  {
    Termin: "9/9/25",
    Kwota: "442.80 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/130/08/2025",
    Data: "8/26/25",
  },
  {
    Termin: "9/9/25",
    Kwota: "319.80 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/131/08/2025",
    Data: "8/26/25",
  },
  {
    Termin: "9/9/25",
    Kwota: "555.96 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/132/08/2025",
    Data: "8/26/25",
  },
  {
    Termin: "9/8/25",
    Kwota: "1,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/124/08/2025",
    Data: "8/25/25",
  },
  {
    Termin: "9/8/25",
    Kwota: "319.80 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/125/08/2025",
    Data: "8/25/25",
  },
  {
    Termin: "9/8/25",
    Kwota: "2,669.10 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/126/08/2025",
    Data: "8/25/25",
  },
  {
    Termin: "9/8/25",
    Kwota: "369.00 zł",
    Podmiot: "BUSWIFI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7811927450",
    Faktura: "FV/127/08/2025",
    Data: "8/25/25",
  },
  {
    Termin: "9/8/25",
    Kwota: "713.40 zł",
    Podmiot: "MOVATOO ASSETS SPÓŁKA Z OGRANICZONĄ ODPO",
    NIP: "5223160252",
    Faktura: "FV/128/08/2025",
    Data: "8/25/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "1,428.30 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/114/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "2,071.20 zł",
    Podmiot: "AD02 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "7963026735",
    Faktura: "FV/116/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "4,508.04 zł",
    Podmiot: "ID.POS POLSKA SPÓŁKA Z OGRANICZONĄ ODPOW",
    NIP: "5252925467",
    Faktura: "FV/117/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "2,671.44 zł",
    Podmiot: "Inga Kuśnierz Productions",
    NIP: "6793251822",
    Faktura: "FV/118/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "2,829.00 zł",
    Podmiot: "RUGER POLSKA SPÓŁKA Z OGR",
    NIP: "9542657505",
    Faktura: "FV/119/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "5,062.54 zł",
    Podmiot: "SYNERGIO",
    NIP: "1132906293",
    Faktura: "FV/120/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "2,607.60 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/122/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/5/25",
    Kwota: "2,841.30 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/123/08/2025",
    Data: "8/22/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "1,958.04 zł",
    Podmiot: "RESPECTENERGYFLEETSPÓŁKAZOGRANICZONĄODP",
    NIP: "5252864151",
    Faktura: "FV/104/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "7,591.31 zł",
    Podmiot: "RESPECTENERGYFLEETSPÓŁKAZOGRANICZONĄODP",
    NIP: "5252864151",
    Faktura: "FV/105/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "2,964.13 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/106/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "4,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/107/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "4,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/108/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "1,230.00 zł",
    Podmiot: "ANG 2 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "6912571296",
    Faktura: "FV/109/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "2,460.00 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/110/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "1,050.91 zł",
    Podmiot: "MK BUD SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIAL",
    NIP: "8681967522",
    Faktura: "FV/111/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "144,230.51 zł",
    Podmiot: "VETUCAR SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "5592055775",
    Faktura: "FV/112/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/4/25",
    Kwota: "246.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/113/08/2025",
    Data: "8/21/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "3,922.78 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/100/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "3,929.64 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/101/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "590.40 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/102/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "1,239.84 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/103/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "8/25/25",
    Kwota: "189.35 zł",
    Podmiot: "KRZYSZTOF DOWINYCH",
    NIP: "",
    Faktura: "FV/79/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "123.00 zł",
    Podmiot: "SZYBKA HALA SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "5214032856",
    Faktura: "FV/80/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "246.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/81/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "123.00 zł",
    Podmiot: "MUUB DEVELOPMENT SPÓŁKA Z OGRANICZONĄ OD",
    NIP: "7010289164",
    Faktura: "FV/82/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "8/27/25",
    Kwota: "123.00 zł",
    Podmiot: "ŁUKASZ TRYBURSKI",
    NIP: "",
    Faktura: "FV/83/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "123.00 zł",
    Podmiot: "RADIO NET MEDIA LTD",
    NIP: "GB292540888",
    Faktura: "FV/84/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "123.00 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/85/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "762.19 zł",
    Podmiot: "POLMARKUS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZ",
    NIP: "9691285173",
    Faktura: "FV/86/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "4,600.20 zł",
    Podmiot: "BAGIŃSKI ARTUR TAKARA SUSHI",
    NIP: "5342041772",
    Faktura: "FV/87/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "464.94 zł",
    Podmiot: "CERSANIT",
    NIP: "5640001666",
    Faktura: "FV/88/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "6,490.39 zł",
    Podmiot: "PARD EUROPE",
    NIP: "5223189907",
    Faktura: "FV/89/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/19/25",
    Kwota: "2,009.82 zł",
    Podmiot: "BILLENNIUM SPÓŁKA AKCYJNA",
    NIP: "5252259585",
    Faktura: "FV/90/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "496.51 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/91/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "5,664.77 zł",
    Podmiot: "SCANIA FINANCE POLSKA SPÓŁKA Z OGRANICZO",
    NIP: "5211579028",
    Faktura: "FV/92/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "1,549.80 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/94/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "3,066.84 zł",
    Podmiot: "EXCELLENT KONRAD ADAMCZUK",
    NIP: "7123431209",
    Faktura: "FV/96/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "2,501.82 zł",
    Podmiot: "MK BUD SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIAL",
    NIP: "8681967522",
    Faktura: "FV/97/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "1,515.36 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/98/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/3/25",
    Kwota: "1,126.68 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/99/08/2025",
    Data: "8/20/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "1,795.80 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/61/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "2,398.50 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/62/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "2,398.50 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/63/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "492.00 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/64/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "2,509.20 zł",
    Podmiot: "Pakorent",
    NIP: "1230895797",
    Faktura: "FV/65/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "981.54 zł",
    Podmiot: "GSCS POLAND SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "7010942606",
    Faktura: "FV/66/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "3,257.29 zł",
    Podmiot: "Inga Kuśnierz Productions",
    NIP: "6793251822",
    Faktura: "FV/67/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "1,753.57 zł",
    Podmiot: "ZŁOTY MELON",
    NIP: "5213236491",
    Faktura: "FV/68/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "1,013.52 zł",
    Podmiot: "ZŁOTY MELON",
    NIP: "5213236491",
    Faktura: "FV/69/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "1,172.93 zł",
    Podmiot: "ZŁOTY MELON",
    NIP: "5213236491",
    Faktura: "FV/70/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "615.00 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/71/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "760.14 zł",
    Podmiot: "PREMIUM-CARS SPÓŁKA Z OGRANICZONĄ ODPOWI",
    NIP: "5242892996",
    Faktura: "FV/72/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "600.24 zł",
    Podmiot: "GOLDEN INVESTMENT PAWEŁ GWADERA",
    NIP: "1231077902",
    Faktura: "FV/73/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "331.13 zł",
    Podmiot: "BUSWIFI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7811927450",
    Faktura: "FV/74/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "2,780.33 zł",
    Podmiot: "TURKA INVEST",
    NIP: "5342468080",
    Faktura: "FV/75/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "1,435.00 zł",
    Podmiot: "SOULMATE OLGA NITECKA",
    NIP: "5311703491",
    Faktura: "FV/77/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "9/2/25",
    Kwota: "2,976.60 zł",
    Podmiot: "IWONAAGATAKOŁODZIEJSKAZAKŁADUSŁUGELEKTR",
    NIP: "7571022984",
    Faktura: "FV/78/08/2025",
    Data: "8/19/25",
  },
  {
    Termin: "8/28/25",
    Kwota: "123.00 zł",
    Podmiot: "Pinko Flamingo MARTA MALANOWSKA-ŁYŻNIK",
    NIP: "7761620808",
    Faktura: "FV/48/08/2025",
    Data: "8/14/25",
  },
  {
    Termin: "8/28/25",
    Kwota: "123.00 zł",
    Podmiot: "ANG 2 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "6912571296",
    Faktura: "FV/49/08/2025",
    Data: "8/14/25",
  },
  {
    Termin: "8/25/25",
    Kwota: "123.00 zł",
    Podmiot: "EON GROUP SŁAWOMIR ZDOBYLAK-BARAN",
    NIP: "6921017292",
    Faktura: "FV/40/08/2025",
    Data: "8/11/25",
  },
  {
    Termin: "8/18/25",
    Kwota: "160,900.00 zł",
    Podmiot: "PRZEMYSŁAW PYCH",
    NIP: "",
    Faktura: "FV/42/08/2025",
    Data: "8/11/25",
  },
  {
    Termin: "9/7/25",
    Kwota: "123.00 zł",
    Podmiot: "SKLEPYKOMFORTSPÓŁKAAKCYJNA",
    NIP: "8512991593",
    Faktura: "FV/38/08/2025",
    Data: "8/8/25",
  },
  {
    Termin: "8/21/25",
    Kwota: "5,017.31 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/33/08/2025",
    Data: "8/7/25",
  },
  {
    Termin: "8/20/25",
    Kwota: "69,975.00 zł",
    Podmiot: "VOLKSWAGENFINANCIALSERVICESPOLSKASPÓŁKA",
    NIP: "5252800978",
    Faktura: "FV/21/08/2025",
    Data: "8/6/25",
  },
  {
    Termin: "8/20/25",
    Kwota: "123.00 zł",
    Podmiot: "DOBTELZygmuntDobosz",
    NIP: "5631283607",
    Faktura: "FV/22/08/2025",
    Data: "8/6/25",
  },
  {
    Termin: "8/19/25",
    Kwota: "-246.00 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "KV/3/08/2025",
    Data: "8/5/25",
  },
  {
    Termin: "8/30/25",
    Kwota: "5,070.75 zł",
    Podmiot: "CORABSpółkaAkcyjna",
    NIP: "7390207757",
    Faktura: "FV/304/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "44,291.07 zł",
    Podmiot: "ANG 2 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "6912571296",
    Faktura: "FV/305/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "119,525.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/306/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "120,390.20 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/326/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "107,589.71 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/327/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "134,547.08 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/328/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "5,814.84 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/329/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/14/25",
    Kwota: "-6,832.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "KV/18/07/2025",
    Data: "7/31/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "1,660.50 zł",
    Podmiot: "AD02 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "7963026735",
    Faktura: "FV/147/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "5,768.70 zł",
    Podmiot: "AGENCJA ROZWOJU PRZEMYSŁU SPÓŁKA AKCYJNA",
    NIP: "5260300204",
    Faktura: "FV/149/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "5,768.70 zł",
    Podmiot: "AGENCJA ROZWOJU PRZEMYSŁU SPÓŁKA AKCYJNA",
    NIP: "5260300204",
    Faktura: "FV/150/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "3,259.50 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/160/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/166/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "2,755.20 zł",
    Podmiot: 'DEN-KOZ-""SCAN"" DENIS KOZUB',
    NIP: "6452501749",
    Faktura: "FV/174/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "3,321.00 zł",
    Podmiot: "EON GROUP SŁAWOMIR ZDOBYLAK-BARAN",
    NIP: "6921017292",
    Faktura: "FV/176/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "2,693.70 zł",
    Podmiot: "FARADAGROUPSPÓŁKAZOGRANICZONĄODPOWIEDZI",
    NIP: "7142055285",
    Faktura: "FV/178/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/6/25",
    Kwota: "6,290.00 zł",
    Podmiot: "Adam Duk",
    NIP: "",
    Faktura: "FV/186/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "4,046.70 zł",
    Podmiot: "NEXTERIOSPÓŁKAZOGRANICZONĄODPOWIEDZIALN",
    NIP: "6572919109",
    Faktura: "FV/205/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "2,570.70 zł",
    Podmiot: "NEXTERIOSPÓŁKAZOGRANICZONĄODPOWIEDZIALN",
    NIP: "6572919109",
    Faktura: "FV/206/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/6/25",
    Kwota: "0.60 zł",
    Podmiot: "BeataMarchel-DobrowolskaPłońsk",
    NIP: "",
    Faktura: "FV/221/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "2,078.70 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/233/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "4,292.70 zł",
    Podmiot: "SYNERGIO",
    NIP: "1132906293",
    Faktura: "FV/234/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "4,415.70 zł",
    Podmiot: "SZYBKA HALA SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "5214032856",
    Faktura: "FV/235/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "5,977.80 zł",
    Podmiot: "TARTAK BIAŁOBŁOCIE SPÓŁKA Z OGRANICZONĄ",
    NIP: "7671723634",
    Faktura: "FV/236/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "2,066.40 zł",
    Podmiot: "TARTAK BIAŁOBŁOCIE SPÓŁKA Z OGRANICZONĄ",
    NIP: "7671723634",
    Faktura: "FV/237/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "3,923.70 zł",
    Podmiot: "THERMO SUN SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7010692960",
    Faktura: "FV/239/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "11,439.00 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/254/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "15,069.14 zł",
    Podmiot: "ZENITH PARTNERS SPÓŁKA Z OGRANICZONĄ ODP",
    NIP: "9372746019",
    Faktura: "FV/274/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/6/25",
    Kwota: "3,200.00 zł",
    Podmiot: "MARZENA KOŚKA",
    NIP: "",
    Faktura: "FV/277/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/29/25",
    Kwota: "3,290.00 zł",
    Podmiot: "FONROCHE LIGHTING SAS",
    NIP: "34749986030",
    Faktura: "FV/278/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/25/25",
    Kwota: "4,674.00 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/279/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/13/25",
    Kwota: "550.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/283/07/2025",
    Data: "7/30/25",
  },
  {
    Termin: "8/12/25",
    Kwota: "1,250.75 zł",
    Podmiot: "FINIDA ADVISORY KATARZYNA TWAROWSKA",
    NIP: "9710549846",
    Faktura: "FV/122/07/2025",
    Data: "7/29/25",
  },
  {
    Termin: "8/12/25",
    Kwota: "123.00 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/129/07/2025",
    Data: "7/29/25",
  },
  {
    Termin: "8/12/25",
    Kwota: "123.00 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/137/07/2025",
    Data: "7/29/25",
  },
  {
    Termin: "8/12/25",
    Kwota: "123.00 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/139/07/2025",
    Data: "7/29/25",
  },
  {
    Termin: "8/11/25",
    Kwota: "5,365.26 zł",
    Podmiot: "Inga Kuśnierz Productions",
    NIP: "6793251822",
    Faktura: "FV/119/07/2025",
    Data: "7/28/25",
  },
  {
    Termin: "8/11/25",
    Kwota: "13,035.87 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "NO/2/07/2025",
    Data: "7/28/25",
  },
  {
    Termin: "8/11/25",
    Kwota: "7,829.73 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "NO/3/07/2025",
    Data: "7/28/25",
  },
  {
    Termin: "8/6/25",
    Kwota: "10,770.96 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/100/07/2025",
    Data: "7/23/25",
  },
  {
    Termin: "8/6/25",
    Kwota: "1,168.50 zł",
    Podmiot: "CENTRUM USŁUG WSPÓLNYCH ENERGIA I CIEPŁO",
    NIP: "6343002214",
    Faktura: "FV/101/07/2025",
    Data: "7/23/25",
  },
  {
    Termin: "8/5/25",
    Kwota: "4,571.50 zł",
    Podmiot: "HELLMANNWORLDWIDELOGISTICSPOLSKASPÓŁKAZ",
    NIP: "1230005823",
    Faktura: "FV/72/07/2025",
    Data: "7/22/25",
  },
  {
    Termin: "8/5/25",
    Kwota: "1,233.28 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/79/07/2025",
    Data: "7/22/25",
  },
  {
    Termin: "7/30/25",
    Kwota: "53,039.01 zł",
    Podmiot: "INTEGRATED PROFESSIONAL SOLUTIONS SPÓŁKA",
    NIP: "5272493120",
    Faktura: "FV/61/07/2025",
    Data: "7/16/25",
  },
  {
    Termin: "7/29/25",
    Kwota: "9,267.81 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/59/07/2025",
    Data: "7/15/25",
  },
  {
    Termin: "7/24/25",
    Kwota: "2,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/44/07/2025",
    Data: "7/10/25",
  },
  {
    Termin: "7/23/25",
    Kwota: "678.55 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/40/07/2025",
    Data: "7/9/25",
  },
  {
    Termin: "7/25/25",
    Kwota: "24,200.82 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/33/07/2025",
    Data: "7/8/25",
  },
  {
    Termin: "7/25/25",
    Kwota: "16,924.39 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/34/07/2025",
    Data: "7/8/25",
  },
  {
    Termin: "8/3/25",
    Kwota: "426.69 zł",
    Podmiot: "TIKROWSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "5223102929",
    Faktura: "FV/21/07/2025",
    Data: "7/4/25",
  },
  {
    Termin: "7/17/25",
    Kwota: "8,107.34 zł",
    Podmiot: "YANG SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "5213795167",
    Faktura: "FV/12/07/2025",
    Data: "7/3/25",
  },
  {
    Termin: "7/17/25",
    Kwota: "2,460.00 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/16/07/2025",
    Data: "7/3/25",
  },
  {
    Termin: "7/17/25",
    Kwota: "388.68 zł",
    Podmiot: "YANG SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "5213795167",
    Faktura: "FV/17/07/2025",
    Data: "7/3/25",
  },
  {
    Termin: "7/16/25",
    Kwota: "2,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/9/07/2025",
    Data: "7/2/25",
  },
  {
    Termin: "7/15/25",
    Kwota: "44,291.07 zł",
    Podmiot: "ANG 2 SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "6912571296",
    Faktura: "FV/231/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/14/25",
    Kwota: "4,292.70 zł",
    Podmiot: "SYNERGIO",
    NIP: "1132906293",
    Faktura: "FV/233/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/20/25",
    Kwota: "200.00 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/252/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/14/25",
    Kwota: "91,483.38 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/255/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/20/25",
    Kwota: "1,250.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/262/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/14/25",
    Kwota: "1,537.50 zł",
    Podmiot: "Studio L. Lashes",
    NIP: "5372668978",
    Faktura: "FV/265/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/20/25",
    Kwota: "4,525.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/269/06/2025",
    Data: "6/30/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/106/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "2,755.20 zł",
    Podmiot: 'DEN-KOZ-""SCAN"" DENIS KOZUB',
    NIP: "6452501749",
    Faktura: "FV/118/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "2,078.70 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/179/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "5,977.80 zł",
    Podmiot: "TARTAK BIAŁOBŁOCIE SPÓŁKA Z OGRANICZONĄ",
    NIP: "7671723634",
    Faktura: "FV/182/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "2,066.40 zł",
    Podmiot: "TARTAK BIAŁOBŁOCIE SPÓŁKA Z OGRANICZONĄ",
    NIP: "7671723634",
    Faktura: "FV/183/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "3,923.70 zł",
    Podmiot: "THERMO SUN SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7010692960",
    Faktura: "FV/184/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "3,185.70 zł",
    Podmiot: "YANG SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "5213795167",
    Faktura: "FV/191/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "19,163.40 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/197/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/4/25",
    Kwota: "3,200.00 zł",
    Podmiot: "MARZENA KOŚKA",
    NIP: "",
    Faktura: "FV/212/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/25/25",
    Kwota: "9,569.40 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/214/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "2,829.00 zł",
    Podmiot: "SYNERGIO",
    NIP: "1132906293",
    Faktura: "FV/85/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/11/25",
    Kwota: "3,259.50 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/95/06/2025",
    Data: "6/27/25",
  },
  {
    Termin: "7/2/25",
    Kwota: "648.21 zł",
    Podmiot: "CERSANIT",
    NIP: "5640001666",
    Faktura: "FV/67/06/2025",
    Data: "6/18/25",
  },
  {
    Termin: "7/7/25",
    Kwota: "12,175.67 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/55/06/2025",
    Data: "6/17/25",
  },
  {
    Termin: "7/13/25",
    Kwota: "5,101.66 zł",
    Podmiot: "CORAB GMBH",
    NIP: "DE362099425",
    Faktura: "FV/39/06/2025",
    Data: "6/13/25",
  },
  {
    Termin: "7/3/25",
    Kwota: "6,396.00 zł",
    Podmiot: "URUQU SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5252990909",
    Faktura: "FV/41/06/2025",
    Data: "6/13/25",
  },
  {
    Termin: "6/27/25",
    Kwota: "3,038.10 zł",
    Podmiot: "SYNERGIO",
    NIP: "1132906293",
    Faktura: "FV/45/06/2025",
    Data: "6/13/25",
  },
  {
    Termin: "7/12/25",
    Kwota: "7,999.61 zł",
    Podmiot: "CORAB GMBH",
    NIP: "DE362099425",
    Faktura: "FV/37/06/2025",
    Data: "6/12/25",
  },
  {
    Termin: "6/20/25",
    Kwota: "123.00 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/20/06/2025",
    Data: "6/6/25",
  },
  {
    Termin: "6/19/25",
    Kwota: "123.00 zł",
    Podmiot: "GT RENT FLEET MANAGEMENT SPÓŁKA Z OGRANI",
    NIP: "5222911354",
    Faktura: "FV/17/06/2025",
    Data: "6/5/25",
  },
  {
    Termin: "6/6/25",
    Kwota: "4,317.00 zł",
    Podmiot: "Erik Emre",
    NIP: "",
    Faktura: "FV/249/05/2025",
    Data: "5/30/25",
  },
  {
    Termin: "6/13/25",
    Kwota: "2,460.00 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/253/05/2025",
    Data: "5/30/25",
  },
  {
    Termin: "6/24/25",
    Kwota: "4,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/256/05/2025",
    Data: "5/30/25",
  },
  {
    Termin: "6/13/25",
    Kwota: "3,185.70 zł",
    Podmiot: "YANG SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALNO",
    NIP: "5213795167",
    Faktura: "FV/266/05/2025",
    Data: "5/30/25",
  },
  {
    Termin: "6/13/25",
    Kwota: "269,796.55 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/275/05/2025",
    Data: "5/30/25",
  },
  {
    Termin: "6/12/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/109/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/12/25",
    Kwota: "910.40 zł",
    Podmiot: 'DEN-KOZ-""SCAN"" DENIS KOZUB',
    NIP: "6452501749",
    Faktura: "FV/112/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/28/25",
    Kwota: "9,788.34 zł",
    Podmiot: "ZENITH PARTNERS SPÓŁKA Z OGRANICZONĄ ODP",
    NIP: "9372746019",
    Faktura: "FV/172/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/28/25",
    Kwota: "3,739.00 zł",
    Podmiot: "CORAB GMBH",
    NIP: "DE362099425",
    Faktura: "FV/180/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/12/25",
    Kwota: "16,116.61 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/190/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/25/25",
    Kwota: "9,569.40 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/206/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/5/25",
    Kwota: "3,160.00 zł",
    Podmiot: "MARZENA KOŚKA",
    NIP: "",
    Faktura: "FV/221/05/2025",
    Data: "5/29/25",
  },
  {
    Termin: "6/6/25",
    Kwota: "123.00 zł",
    Podmiot: "SUNLINK SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "1231494681",
    Faktura: "FV/69/05/2025",
    Data: "5/23/25",
  },
  {
    Termin: "6/6/25",
    Kwota: "123.00 zł",
    Podmiot: "B2WED SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIALN",
    NIP: "5170378160",
    Faktura: "FV/77/05/2025",
    Data: "5/23/25",
  },
  {
    Termin: "6/3/25",
    Kwota: "143,249.18 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/52/05/2025",
    Data: "5/20/25",
  },
  {
    Termin: "5/26/25",
    Kwota: "1,230.00 zł",
    Podmiot: "SCANIA FINANCE POLSKA SPÓŁKA Z OGRANICZO",
    NIP: "5211579028",
    Faktura: "FV/22/05/2025",
    Data: "5/12/25",
  },
  {
    Termin: "5/26/25",
    Kwota: "123.00 zł",
    Podmiot: "GT RENT FLEET MANAGEMENT SPÓŁKA Z OGRANI",
    NIP: "5222911354",
    Faktura: "FV/25/05/2025",
    Data: "5/12/25",
  },
  {
    Termin: "5/14/25",
    Kwota: "339.97 zł",
    Podmiot: "THERMO SUN SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7010692960",
    Faktura: "FV/244/04/2025",
    Data: "4/30/25",
  },
  {
    Termin: "5/14/25",
    Kwota: "11,171.35 zł",
    Podmiot: "EXPERCI.IT SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7831899857",
    Faktura: "FV/252/04/2025",
    Data: "4/30/25",
  },
  {
    Termin: "5/14/25",
    Kwota: "4,958.27 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/254/04/2025",
    Data: "4/30/25",
  },
  {
    Termin: "5/14/25",
    Kwota: "61.50 zł",
    Podmiot: "ZESSTOS SPÓŁKA Z OGRANICZONĄ ODPOWIEDZIA",
    NIP: "7481591721",
    Faktura: "FV/260/04/2025",
    Data: "4/30/25",
  },
  {
    Termin: "5/13/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/126/04/2025",
    Data: "4/29/25",
  },
  {
    Termin: "5/8/25",
    Kwota: "2,430.48 zł",
    Podmiot: "UNIQA TOWARZYSTWO UBEZPIECZEŃ SPÓŁKA AKC",
    NIP: "1070006155",
    Faktura: "FV/91/04/2025",
    Data: "4/24/25",
  },
  {
    Termin: "5/2/25",
    Kwota: "123.00 zł",
    Podmiot: "WIELTONSPÓŁKAAKCYJNA",
    NIP: "8992462770",
    Faktura: "FV/70/04/2025",
    Data: "4/18/25",
  },
  {
    Termin: "4/23/25",
    Kwota: "3,516.08 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "NO/1/04/2025",
    Data: "4/9/25",
  },
  {
    Termin: "5/1/25",
    Kwota: "47,065.31 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/8/04/2025",
    Data: "4/1/25",
  },
  {
    Termin: "4/14/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/100/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/14/25",
    Kwota: "615.00 zł",
    Podmiot: "KROTOSKI SPÓŁKA",
    NIP: "7792505735",
    Faktura: "FV/185/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/14/25",
    Kwota: "2,460.01 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/186/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/14/25",
    Kwota: "307.50 zł",
    Podmiot: "EXPERCI.IT SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7831899857",
    Faktura: "FV/213/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/30/25",
    Kwota: "14,563.20 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/214/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/25/25",
    Kwota: "9,450.91 zł",
    Podmiot: "KOWALSKA GLOBAL COMPANY OLIWIA KOWALSKA",
    NIP: "8792749774",
    Faktura: "FV/216/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/14/25",
    Kwota: "392.37 zł",
    Podmiot: "THERMO SUN SPÓŁKA Z OGRANICZONĄ ODPOWIED",
    NIP: "7010692960",
    Faktura: "FV/230/03/2025",
    Data: "3/31/25",
  },
  {
    Termin: "4/9/25",
    Kwota: "393.22 zł",
    Podmiot: "Inga Kuśnierz Productions",
    NIP: "6793251822",
    Faktura: "NO/2/03/2025",
    Data: "3/26/25",
  },
  {
    Termin: "4/8/25",
    Kwota: "1,781.04 zł",
    Podmiot: "PRESTAMO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5020126758",
    Faktura: "FV/70/03/2025",
    Data: "3/25/25",
  },
  {
    Termin: "4/4/25",
    Kwota: "3,111.90 zł",
    Podmiot: "REEDBIRDS  PROSTA SPÓŁKA AKCYJNA",
    NIP: "5273125051",
    Faktura: "FV/53/03/2025",
    Data: "3/21/25",
  },
  {
    Termin: "4/11/25",
    Kwota: "14,060.13 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/31/03/2025",
    Data: "3/12/25",
  },
  {
    Termin: "3/14/25",
    Kwota: "2,324.40 zł",
    Podmiot: "PRESTAMO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5020126758",
    Faktura: "FV/165/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/14/25",
    Kwota: "828.00 zł",
    Podmiot: "REEDBIRDS  PROSTA SPÓŁKA AKCYJNA",
    NIP: "5273125051",
    Faktura: "FV/170/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/30/25",
    Kwota: "25,374.90 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/215/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/14/25",
    Kwota: "7,963.02 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/231/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/30/25",
    Kwota: "1,650.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/249/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/14/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/98/02/2025",
    Data: "2/28/25",
  },
  {
    Termin: "3/13/25",
    Kwota: "123.00 zł",
    Podmiot: "PHU EASTOM Tomasz Górski",
    NIP: "5811715735",
    Faktura: "FV/74/02/2025",
    Data: "2/27/25",
  },
  {
    Termin: "3/28/25",
    Kwota: "3,940.80 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/68/02/2025",
    Data: "2/26/25",
  },
  {
    Termin: "3/28/25",
    Kwota: "512.23 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/70/02/2025",
    Data: "2/26/25",
  },
  {
    Termin: "3/3/25",
    Kwota: "839.99 zł",
    Podmiot: "SEBASTIAN KALAMAŃSKI",
    NIP: "",
    Faktura: "FV/62/02/2025",
    Data: "2/24/25",
  },
  {
    Termin: "3/20/25",
    Kwota: "350.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/50/02/2025",
    Data: "2/18/25",
  },
  {
    Termin: "3/4/25",
    Kwota: "123.00 zł",
    Podmiot: "ALLINTRADERS PROSTA",
    NIP: "6343005951",
    Faktura: "FV/52/02/2025",
    Data: "2/18/25",
  },
  {
    Termin: "2/24/25",
    Kwota: "4,785.78 zł",
    Podmiot: "PRESTAMO SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5020126758",
    Faktura: "FV/25/02/2025",
    Data: "2/10/25",
  },
  {
    Termin: "3/8/25",
    Kwota: "1,649.23 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/12/02/2025",
    Data: "2/6/25",
  },
  {
    Termin: "2/14/25",
    Kwota: "0.33 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/105/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "2,127.90 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/146/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "2,127.90 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/147/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "3,923.70 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/148/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "2,127.90 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/149/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "6,888.00 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/150/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "3,923.70 zł",
    Podmiot: "1.HUBERT GREIFENBERG STREFA RELAKSU 2. H",
    NIP: "6112688128",
    Faktura: "FV/152/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "3/2/25",
    Kwota: "750.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/224/01/2025",
    Data: "1/31/25",
  },
  {
    Termin: "2/19/25",
    Kwota: "1,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/46/01/2025",
    Data: "1/20/25",
  },
  {
    Termin: "2/16/25",
    Kwota: "3,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/45/01/2025",
    Data: "1/17/25",
  },
  {
    Termin: "2/13/25",
    Kwota: "2,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/31/01/2025",
    Data: "1/14/25",
  },
  {
    Termin: "2/9/25",
    Kwota: "1,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/22/01/2025",
    Data: "1/10/25",
  },
  {
    Termin: "1/16/25",
    Kwota: "4,958.27 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "FV/6/01/2025",
    Data: "1/2/25",
  },
  {
    Termin: "1/14/25",
    Kwota: "22,263.51 zł",
    Podmiot: "KROTOSKI SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "7282687625",
    Faktura: "DP 50/12/2024",
    Data: "12/31/24",
  },
  {
    Termin: "1/13/25",
    Kwota: "2,939.70 zł",
    Podmiot: "Coppo-Tech Bartosz Stachowski",
    NIP: "6991861099",
    Faktura: "FV/110/12/2024",
    Data: "12/30/24",
  },
  {
    Termin: "1/29/25",
    Kwota: "3,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/204/12/2024",
    Data: "12/30/24",
  },
  {
    Termin: "1/1/25",
    Kwota: "2,160.29 zł",
    Podmiot: "TARCZA SPRAWIEDLIWOŚCI SPÓŁKA Z OGRANICZ",
    NIP: "9522253242",
    Faktura: "FV/63/12/2024",
    Data: "12/18/24",
  },
  {
    Termin: "1/15/25",
    Kwota: "2,000.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/51/12/2024",
    Data: "12/16/24",
  },
  {
    Termin: "1/15/25",
    Kwota: "4,526.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/53/12/2024",
    Data: "12/16/24",
  },
  {
    Termin: "1/15/25",
    Kwota: "6,832.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/54/12/2024",
    Data: "12/16/24",
  },
  {
    Termin: "1/10/25",
    Kwota: "600.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/42/12/2024",
    Data: "12/11/24",
  },
  {
    Termin: "1/9/25",
    Kwota: "2,326.30 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/33/12/2024",
    Data: "12/10/24",
  },
  {
    Termin: "1/8/25",
    Kwota: "220.00 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/27/12/2024",
    Data: "12/9/24",
  },
  {
    Termin: "12/19/24",
    Kwota: "1,230.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/19/12/2024",
    Data: "12/5/24",
  },
  {
    Termin: "1/2/25",
    Kwota: "4,010.94 zł",
    Podmiot: "PANEK",
    NIP: "CZ08264031",
    Faktura: "FV/10/12/2024",
    Data: "12/3/24",
  },
  {
    Termin: "12/16/24",
    Kwota: "11,830.00 zł",
    Podmiot: "POWSZECHNY ZAKŁAD UBEZPIECZEŃ SPÓŁKA AKC",
    NIP: "5260251049",
    Faktura: "NO/1/12/2024",
    Data: "12/2/24",
  },
  {
    Termin: "12/13/24",
    Kwota: "4,920.00 zł",
    Podmiot: "MS Stage Crew Michał Starszak",
    NIP: "6922522709",
    Faktura: "FV/209/11/2024",
    Data: "11/29/24",
  },
  {
    Termin: "11/29/24",
    Kwota: "1,972.10 zł",
    Podmiot: "MS Stage Crew Michał Starszak",
    NIP: "6922522709",
    Faktura: "FV/44/11/2024",
    Data: "11/15/24",
  },
  {
    Termin: "11/29/24",
    Kwota: "110.70 zł",
    Podmiot: "MS Stage Crew Michał Starszak",
    NIP: "6922522709",
    Faktura: "FV/45/11/2024",
    Data: "11/15/24",
  },
  {
    Termin: "11/27/24",
    Kwota: "123.00 zł",
    Podmiot: "MS Stage Crew Michał Starszak",
    NIP: "6922522709",
    Faktura: "FV/24/11/2024",
    Data: "11/13/24",
  },
  {
    Termin: "11/21/24",
    Kwota: "123.00 zł",
    Podmiot: "NL CAR",
    NIP: "5273074827",
    Faktura: "FV/12/11/2024",
    Data: "11/7/24",
  },
  {
    Termin: "11/21/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/13/11/2024",
    Data: "11/7/24",
  },
  {
    Termin: "11/14/24",
    Kwota: "1,567.00 zł",
    Podmiot: "MS Stage Crew Michał Starszak",
    NIP: "6922522709",
    Faktura: "FV/170/10/2024",
    Data: "10/31/24",
  },
  {
    Termin: "11/14/24",
    Kwota: "228.53 zł",
    Podmiot: "ANDORIASPÓŁKAZOGRANICZONĄODPOWIEDZIALNO",
    NIP: "5512302511",
    Faktura: "FV/257/10/2024",
    Data: "10/31/24",
  },
  {
    Termin: "11/14/24",
    Kwota: "3,677.70 zł",
    Podmiot: "ANDORIASPÓŁKAZOGRANICZONĄODPOWIEDZIALNO",
    NIP: "5512302511",
    Faktura: "FV/87/10/2024",
    Data: "10/31/24",
  },
  {
    Termin: "11/7/24",
    Kwota: "4,016.77 zł",
    Podmiot: "NL CAR",
    NIP: "5273074827",
    Faktura: "FV/66/10/2024",
    Data: "10/24/24",
  },
  {
    Termin: "10/31/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/55/10/2024",
    Data: "10/17/24",
  },
  {
    Termin: "10/29/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/41/10/2024",
    Data: "10/15/24",
  },
  {
    Termin: "10/24/24",
    Kwota: "1,348.33 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/35/10/2024",
    Data: "10/10/24",
  },
  {
    Termin: "10/23/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/29/10/2024",
    Data: "10/9/24",
  },
  {
    Termin: "10/23/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/33/10/2024",
    Data: "10/9/24",
  },
  {
    Termin: "10/21/24",
    Kwota: "1,632.33 zł",
    Podmiot: "NL CAR",
    NIP: "5273074827",
    Faktura: "FV/20/10/2024",
    Data: "10/7/24",
  },
  {
    Termin: "10/21/24",
    Kwota: "123.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/22/10/2024",
    Data: "10/7/24",
  },
  {
    Termin: "10/16/24",
    Kwota: "246.00 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/5/10/2024",
    Data: "10/2/24",
  },
  {
    Termin: "10/14/24",
    Kwota: "2,890.50 zł",
    Podmiot: "TC MEDIA",
    NIP: "5213977081",
    Faktura: "FV/192/09/2024",
    Data: "9/30/24",
  },
  {
    Termin: "10/14/24",
    Kwota: "3,677.70 zł",
    Podmiot: "ANDORIASPÓŁKAZOGRANICZONĄODPOWIEDZIALNO",
    NIP: "5512302511",
    Faktura: "FV/81/09/2024",
    Data: "9/30/24",
  },
  {
    Termin: "9/13/24",
    Kwota: "3,677.70 zł",
    Podmiot: "ANDORIASPÓŁKAZOGRANICZONĄODPOWIEDZIALNO",
    NIP: "5512302511",
    Faktura: "FV/88/08/2024",
    Data: "8/30/24",
  },
  {
    Termin: "8/7/24",
    Kwota: "1,149.03 zł",
    Podmiot: "GEMSO DYSTRYBUCJA SPÓŁKA Z OGRANICZONĄ O",
    NIP: "5273029175",
    Faktura: "FV/231/07/2024",
    Data: "7/24/24",
  },
  {
    Termin: "8/5/24",
    Kwota: "5,425.92 zł",
    Podmiot: "GEMSO DYSTRYBUCJA SPÓŁKA Z OGRANICZONĄ O",
    NIP: "5273029175",
    Faktura: "FV/219/07/2024",
    Data: "7/22/24",
  },
  {
    Termin: "8/1/24",
    Kwota: "-123.00 zł",
    Podmiot: "A i M - TRAK Michał Nowakowski",
    NIP: "8241243688",
    Faktura: "KV/9/07/2024",
    Data: "7/18/24",
  },
  {
    Termin: "7/22/24",
    Kwota: "430.50 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/183/07/2024",
    Data: "7/8/24",
  },
  {
    Termin: "7/22/24",
    Kwota: "1,230.00 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/184/07/2024",
    Data: "7/8/24",
  },
  {
    Termin: "7/15/24",
    Kwota: "2,583.00 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/20/07/2024",
    Data: "7/1/24",
  },
  {
    Termin: "7/12/24",
    Kwota: "4,249.24 zł",
    Podmiot: "INKSEARCHSPÓŁKAZOGRANICZONĄODPOWIEDZIAL",
    NIP: "5213835872",
    Faktura: "FV/82/06/2024",
    Data: "6/28/24",
  },
  {
    Termin: "7/9/24",
    Kwota: "123.00 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/60/06/2024",
    Data: "6/25/24",
  },
  {
    Termin: "7/1/24",
    Kwota: "123.00 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/35/06/2024",
    Data: "6/17/24",
  },
  {
    Termin: "6/19/24",
    Kwota: "2,673.00 zł",
    Podmiot: "BAK-NET-BUD SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "5252931901",
    Faktura: "FV/5/06/2024",
    Data: "6/5/24",
  },
  {
    Termin: "6/14/24",
    Kwota: "2,918.79 zł",
    Podmiot: "GEMSO DYSTRYBUCJA SPÓŁKA Z OGRANICZONĄ O",
    NIP: "5273029175",
    Faktura: "FV/106/05/2024",
    Data: "5/31/24",
  },
  {
    Termin: "6/14/24",
    Kwota: "1,000.00 zł",
    Podmiot: "INKSEARCHSPÓŁKAZOGRANICZONĄODPOWIEDZIAL",
    NIP: "5213835872",
    Faktura: "FV/116/05/2024",
    Data: "5/31/24",
  },
  {
    Termin: "6/14/24",
    Kwota: "3,567.00 zł",
    Podmiot: "BAK-NET-BUD SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "5252931901",
    Faktura: "FV/79/05/2024",
    Data: "5/31/24",
  },
  {
    Termin: "6/14/24",
    Kwota: "2,583.00 zł",
    Podmiot: "CENTRUM-OZE SPÓŁKA Z OGRANICZONĄ ODPOWIE",
    NIP: "8212663152",
    Faktura: "FV/83/05/2024",
    Data: "5/31/24",
  },
  {
    Termin: "4/30/24",
    Kwota: "696.60 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "FV/56/04/2024",
    Data: "4/16/24",
  },
  {
    Termin: "4/23/24",
    Kwota: "33,196.17 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "FV/28/04/2024",
    Data: "4/9/24",
  },
  {
    Termin: "4/12/24",
    Kwota: "3,378.40 zł",
    Podmiot: "MARPOINT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5272911445",
    Faktura: "FV/144/03/2024",
    Data: "3/29/24",
  },
  {
    Termin: "4/12/24",
    Kwota: "33,197.70 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "FV/176/03/2024",
    Data: "3/29/24",
  },
  {
    Termin: "3/14/24",
    Kwota: "32,018.55 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "FV/200/2/2024",
    Data: "2/29/24",
  },
  {
    Termin: "3/13/24",
    Kwota: "4.00 zł",
    Podmiot: "MARPOINT SPÓŁKA Z OGRANICZONĄ ODPOWIEDZI",
    NIP: "5272911445",
    Faktura: "FV/125/2/2024",
    Data: "2/28/24",
  },
  {
    Termin: "3/11/24",
    Kwota: "3,828.35 zł",
    Podmiot: "Kamil Kuźnicki-Agent Nieruchomości",
    NIP: "6612386063",
    Faktura: "FV/68/2/2024",
    Data: "2/26/24",
  },
  {
    Termin: "3/11/24",
    Kwota: "2,712.56 zł",
    Podmiot: "ŁUKASZDYMEKLUCKYMEDIA",
    NIP: "8481645883",
    Faktura: "FV/69/2/2024",
    Data: "2/26/24",
  },
  {
    Termin: "3/11/24",
    Kwota: "4,738.78 zł",
    Podmiot: "ŁUKASZDYMEKLUCKYMEDIA",
    NIP: "8481645883",
    Faktura: "FV/70/2/2024",
    Data: "2/26/24",
  },
  {
    Termin: "3/6/24",
    Kwota: "369.00 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "FV/44/2/2024",
    Data: "2/21/24",
  },
  {
    Termin: "2/16/24",
    Kwota: "7,597.07 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "FV/4/2/2024",
    Data: "2/2/24",
  },
  {
    Termin: "2/14/24",
    Kwota: "2,583.00 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "160/01/RAC/2024",
    Data: "1/31/24",
  },
  {
    Termin: "2/14/24",
    Kwota: "185.32 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "175/01/RAC/2024",
    Data: "1/31/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "6,765.00 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "115/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "1,431.55 zł",
    Podmiot: "Kamil Kuźnicki-Agent Nieruchomości",
    NIP: "6612386063",
    Faktura: "122/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "2,468.20 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "146/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "2,468.20 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "148/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "5,707.20 zł",
    Podmiot: "ŁUKASZDYMEKLUCKYMEDIA",
    NIP: "8481645883",
    Faktura: "62/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "5,768.70 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "84/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/12/24",
    Kwota: "6,765.00 zł",
    Podmiot: "SPEKWORKERSISPÓŁKAZOGRANICZONĄODPOWIEDZ",
    NIP: "5783157765",
    Faktura: "86/01/RAC/2024",
    Data: "1/29/24",
  },
  {
    Termin: "2/5/24",
    Kwota: "4,605.76 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "30/01/RAC/2024",
    Data: "1/22/24",
  },
  {
    Termin: "2/5/24",
    Kwota: "3,130.03 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "31/01/RAC/2024",
    Data: "1/22/24",
  },
  {
    Termin: "1/10/24",
    Kwota: "6,886.77 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "101/12/RAC/2023",
    Data: "12/27/23",
  },
  {
    Termin: "1/10/24",
    Kwota: "5,707.20 zł",
    Podmiot: "ŁUKASZDYMEKLUCKYMEDIA",
    NIP: "8481645883",
    Faktura: "107/12/RAC/2023",
    Data: "12/27/23",
  },
  {
    Termin: "1/10/24",
    Kwota: "2,583.00 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "162/12/RAC/2023",
    Data: "12/27/23",
  },
  {
    Termin: "1/10/24",
    Kwota: "4,710.90 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "86/12/RAC/2023",
    Data: "12/27/23",
  },
  {
    Termin: "1/5/24",
    Kwota: "670.52 zł",
    Podmiot: "ŁUKASZDYMEKLUCKYMEDIA",
    NIP: "8481645883",
    Faktura: "49/12/RAC/2023",
    Data: "12/22/23",
  },
  {
    Termin: "12/12/23",
    Kwota: "4,710.90 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "120/11/RAC/2023",
    Data: "11/28/23",
  },
  {
    Termin: "12/12/23",
    Kwota: "6,427.65 zł",
    Podmiot: "NOVEQSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚC",
    NIP: "8992833031",
    Faktura: "137/11/RAC/2023",
    Data: "11/28/23",
  },
  {
    Termin: "12/12/23",
    Kwota: "2,583.00 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "165/11/RAC/2023",
    Data: "11/28/23",
  },
  {
    Termin: "12/14/23",
    Kwota: "0.01 zł",
    Podmiot: 'MARIUSZ RUPA P.H.U.S. ""LEKTOR""',
    NIP: "7881327755",
    Faktura: "FV/BL/233/23/D308/S",
    Data: "11/15/23",
  },
  {
    Termin: "11/27/23",
    Kwota: "468.36 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "14/11/RAC/2023",
    Data: "11/13/23",
  },
  {
    Termin: "11/17/23",
    Kwota: "1,497.31 zł",
    Podmiot: "Głowiński Tadeusz",
    NIP: "",
    Faktura: "FV/UP/880/23/D306/S",
    Data: "11/13/23",
  },
  {
    Termin: "11/30/23",
    Kwota: "0.01 zł",
    Podmiot: "MMS Sławomir Pawlusiński",
    NIP: "7631308774",
    Faktura: "FV/BL/223/23/D308/S",
    Data: "10/31/23",
  },
  {
    Termin: "11/29/23",
    Kwota: "0.01 zł",
    Podmiot: "DONAUCHEM POLSKA SPÓŁKA Z OGRANICZONĄ OD",
    NIP: "7811704862",
    Faktura: "FV/BL/219/23/D308/S",
    Data: "10/30/23",
  },
  {
    Termin: "11/10/23",
    Kwota: "2,583.00 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "157/10/RAC/2023",
    Data: "10/27/23",
  },
  {
    Termin: "10/27/23",
    Kwota: "470.60 zł",
    Podmiot: "My Food For Every Mood - Paulina Pawłows",
    NIP: "9720933931",
    Faktura: "FV/UP/820/23/D306/S",
    Data: "10/20/23",
  },
  {
    Termin: "10/27/23",
    Kwota: "3,352.50 zł",
    Podmiot: "Bergin Magdalena",
    NIP: "",
    Faktura: "FV/UP/822/23/D306/S",
    Data: "10/20/23",
  },
  {
    Termin: "10/24/23",
    Kwota: "1,162.12 zł",
    Podmiot: "Bergin Magdalena",
    NIP: "",
    Faktura: "FV/UP/804/23/D306/S",
    Data: "10/17/23",
  },
  {
    Termin: "10/24/23",
    Kwota: "8,854.35 zł",
    Podmiot: "Balbuza Katarzyna",
    NIP: "",
    Faktura: "FV/UP/806/23/D306/S",
    Data: "10/17/23",
  },
  {
    Termin: "10/23/23",
    Kwota: "130.95 zł",
    Podmiot: "Elektropoz Anna Drzewiecka",
    NIP: "7792005062",
    Faktura: "FV/UP/787/23/D306/S",
    Data: "10/9/23",
  },
  {
    Termin: "10/13/23",
    Kwota: "3,538.28 zł",
    Podmiot: "AGENCJA REKLAMOWA BOOTELKA GRZEGORZ JARM",
    NIP: "7811521311",
    Faktura: "FV/UP/786/23/D306/S",
    Data: "10/6/23",
  },
  {
    Termin: "10/11/23",
    Kwota: "1,635.90 zł",
    Podmiot: "MODULORWIELGOLASSPÓŁKAZOGRANICZONĄODPOW",
    NIP: "5273021877",
    Faktura: "117/09/RAC/2023",
    Data: "9/27/23",
  },
  {
    Termin: "10/10/23",
    Kwota: "6,736.74 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "30/09/RAC/2023",
    Data: "9/26/23",
  },
  {
    Termin: "10/10/23",
    Kwota: "4,511.56 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "31/09/RAC/2023",
    Data: "9/26/23",
  },
  {
    Termin: "10/9/23",
    Kwota: "1,713.80 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "27/09/RAC/2023",
    Data: "9/25/23",
  },
  {
    Termin: "9/11/23",
    Kwota: "6,826.50 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "109/08/RAC/2023",
    Data: "8/28/23",
  },
  {
    Termin: "9/11/23",
    Kwota: "2,337.00 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "117/08/RAC/2023",
    Data: "8/28/23",
  },
  {
    Termin: "9/11/23",
    Kwota: "5,694.90 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "126/08/RAC/2023",
    Data: "8/28/23",
  },
  {
    Termin: "8/10/23",
    Kwota: "2,337.00 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "120/07/RAC/2023",
    Data: "7/27/23",
  },
  {
    Termin: "8/10/23",
    Kwota: "6,826.50 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "134/07/RAC/2023",
    Data: "7/27/23",
  },
  {
    Termin: "8/10/23",
    Kwota: "5,694.90 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "138/07/RAC/2023",
    Data: "7/27/23",
  },
  {
    Termin: "8/2/23",
    Kwota: "567.00 zł",
    Podmiot: 'ŻŁOBEK ""MARYSIEŃKA"" HANNA ANDRZEJEWSKA',
    NIP: "7871325051",
    Faktura: "FV/BL/131/23/D308/S",
    Data: "7/26/23",
  },
  {
    Termin: "7/14/23",
    Kwota: "1,500.19 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "136/06/RAC/2023",
    Data: "6/30/23",
  },
  {
    Termin: "7/12/23",
    Kwota: "2,337.00 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "113/06/RAC/2023",
    Data: "6/28/23",
  },
  {
    Termin: "7/12/23",
    Kwota: "5,694.90 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "130/06/RAC/2023",
    Data: "6/28/23",
  },
  {
    Termin: "6/12/23",
    Kwota: "2,337.00 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "111/05/RAC/2023",
    Data: "5/29/23",
  },
  {
    Termin: "6/12/23",
    Kwota: "2,755.59 zł",
    Podmiot: "MOZELLSPÓŁKAZOGRANICZONĄODPOWIEDZIALNOŚ",
    NIP: "7010589133",
    Faktura: "121/05/RAC/2023",
    Data: "5/29/23",
  },
  {
    Termin: "5/10/23",
    Kwota: "900.00 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "121/04/RAC/2023",
    Data: "4/26/23",
  },
  {
    Termin: "4/19/23",
    Kwota: "479.70 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "1/04/RAC/2023",
    Data: "4/5/23",
  },
  {
    Termin: "4/14/23",
    Kwota: "3,505.50 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "136/03/RAC/2023",
    Data: "3/31/23",
  },
  {
    Termin: "3/10/23",
    Kwota: "2,424.86 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "110/02/RAC/2023",
    Data: "2/24/23",
  },
  {
    Termin: "2/9/23",
    Kwota: "3,505.50 zł",
    Podmiot: "MWGROUPMICHAŁWIĘZOWSKI",
    NIP: "9512260097",
    Faktura: "124/01/RAC/2023",
    Data: "1/26/23",
  },
  {
    Termin: "2/9/23",
    Kwota: "2,829.00 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "130/01/RAC/2023",
    Data: "1/26/23",
  },
  {
    Termin: "1/11/23",
    Kwota: "2,829.00 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "155/12/RAC/2022",
    Data: "12/28/22",
  },
  {
    Termin: "12/12/22",
    Kwota: "2,829.00 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "161/11/RAC/2022",
    Data: "11/28/22",
  },
  {
    Termin: "11/9/22",
    Kwota: "912.59 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "141/10/RAC/2022",
    Data: "10/26/22",
  },
  {
    Termin: "11/9/22",
    Kwota: "2,208.05 zł",
    Podmiot: "SUPPORTMANAGEMENTMICHAŁOSMULSKI",
    NIP: "8281316011",
    Faktura: "163/10/RAC/2022",
    Data: "10/26/22",
  },
  {
    Termin: "2/24/22",
    Kwota: "199.99 zł",
    Podmiot: "ALIOR LEASING SPÓŁKA Z OGRANICZONĄ ODPOW",
    NIP: "5223027866",
    Faktura: "FV/I/14/22/D304/S",
    Data: "2/10/22",
  },
  {
    Termin: "10/12/21",
    Kwota: "27.98 zł",
    Podmiot: "Elektropoz Anna Drzewiecka",
    NIP: "7792005062",
    Faktura: "FV/BL/66/21/D308/S",
    Data: "9/13/21",
  },
];

const unpaidDocuments = async () => {
  console.log("start unpaidDocuments");

  try {
    const newData = [];
    for (const doc of dataFromRAC) {
      const [checkFac] = await connect_SQL.query(
        `

        SELECT NUMER_FV FROM company_windykacja.company_documents WHERE
        FIRMA = 'RAC' AND NUMER_FV = ?
        `,
        [doc.Faktura]
      );

      if (!checkFac.length) {
        const query = `SELECT  kpu.nazwa AS KONTRAHENT, rozdata.kwota,  kpu.nip, rozdata.dnazwa AS NUMER_FV,  CONVERT(VARCHAR(10), rozdata.data, 23) AS DATA_WYST_FV,  CONVERT(VARCHAR(10), rozdata.termin, 23) AS TERMIN_FV 
FROM FK_Rent_SK.FK.fk_rozdata AS rozdata
 LEFT JOIN FK_Rent_SK.FK.fk_kontrahenci kpu ON rozdata.kontrahent = kpu.pozycja
WHERE (dSymbol = '${doc.Faktura}') AND  kontrahent IS NOT NULL`;
        const findDoc = await msSqlQuery(query);
        newData.push(...findDoc);
      }
    }
    const changeData = newData.map((item) => {
      return {
        NUMER_FV: item.NUMER_FV,
        BRUTTO: item.kwota,
        NETTO: item.kwota / 1.23,
        DZIAL: "RAC",
        DO_ROZLICZENIA: 0,
        DATA_FV: item.DATA_WYST_FV,
        TERMIN: item.TERMIN_FV,
        KONTRAHENT: item.KONTRAHENT,
        DORADCA: "Brak danych",
        NR_REJESTRACYJNY: null,
        NR_SZKODY: null,
        UWAGI_Z_FAKTURY: null,
        TYP_PLATNOSCI: "PRZELEW",
        NIP: item.nip,
        VIN: null,
        NR_AUTORYZACJI: null,
        KOREKTA: null,
        FIRMA: "RAC",
      };
    });
    for (const doc of changeData) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_windykacja.company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.NUMER_FV,
          doc.BRUTTO,
          doc.NETTO,
          doc.DZIAL,
          doc.DO_ROZLICZENIA,
          doc.DATA_FV,
          doc.TERMIN,
          doc.KONTRAHENT,
          doc.DORADCA,
          doc.NR_REJESTRACYJNY,
          doc.NR_SZKODY || null,
          doc.UWAGI_Z_FAKTURY,
          doc.TYP_PLATNOSCI,
          doc.NIP,
          doc.VIN,
          doc.NR_AUTORYZACJI || null,
          doc.KOREKTA,
          doc.FIRMA,
        ]
      );
    }
    console.log("finish unpaidDocuments");
  } catch (error) {
    console.error(error);
  }
};

const organizationStructure = async () => {
  console.log("start organizationStructure");
  try {
    await connect_SQL.query(
      `INSERT INTO company_join_items (DEPARTMENT, COMPANY, LOCALIZATION, AREA, OWNER, GUARDIAN) VALUES (?, ?, ?, ?, ?, ?)`,
      [
        "RAC",
        "RAC",
        "RAC",
        "RAC",
        JSON.stringify(["Brak danych"]),
        JSON.stringify(["Brak danych"]),
      ]
    );
    console.log("finish organizationStructure");
  } catch (error) {
    console.error(error);
  }
};

const twoDaysDocs = async () => {
  try {
    const twoDaysAgo = "2025-09-07";

    const query = `    
    SELECT  
    [faktn_fakt_nr_caly] AS NUMER_FV,
    SUM([faktp_og_brutto]) AS BRUTTO,
    SUM([faktp_og_netto]) AS NETTO,
    SUM([faktn_zaplata_kwota]) AS DO_ROZLICZENIA,
    CONVERT(VARCHAR(10), MIN([dataWystawienia]), 23) AS DATA_FV,
    CONVERT(VARCHAR(10), MIN([terminPlatnosci]), 23) AS TERMIN,
    MAX([kl_nazwa]) AS KONTRAHENT,
    MAX([faktn_wystawil]) AS DORADCA,
    NULL AS NR_REJESTRACYJNY,
    NULL AS UWAGI_Z_FAKTURY,
    MAX([typSprzedazy]) AS TYP_PLATNOSCI,
    MAX([kl_nip]) AS NIP   ,
    'RAC' AS MARKER
FROM [RAPDB].[dbo].[RAC_zestawieniePrzychodow]
   WHERE [dataWystawienia]> '${twoDaysAgo}'
GROUP BY [faktn_fakt_nr_caly];
    `;
    const documents = await msSqlQuery(query);

    const addDep = addDepartment(documents);

    console.log(addDep);
  } catch (error) {
    console.error(error);
  }
};

const prepareRac = async () => {
  try {
    // await addRacCompany();
    // await getRacData();
    // await getRacDataTime();
    // await settlementsRAC();
    // await tableColumnsForRAC();
    // await organizationStructure();
    // await unpaidDocuments();
    // await twoDaysDocs();
    console.log("prepare RAC");
  } catch (error) {
    console.error(error);
  }
};

const copy_fk_raport_KRT = async () => {
  try {
    await connect_SQL.query("TRUNCATE testy_windykacja.company_fk_raport_KRT");

    const [reports] = await connect_SQL.query(`
    INSERT INTO testy_windykacja.company_fk_raport_KRT (
      BRAK_DATY_WYSTAWIENIA_FV,
      CZY_SAMOCHOD_WYDANY_AS,
      CZY_W_KANCELARI,
      DATA_ROZLICZENIA_AS,
      DATA_WYDANIA_AUTA,
      DATA_WYSTAWIENIA_FV,
      DO_ROZLICZENIA_AS,
      DZIAL,
      ETAP_SPRAWY,
      HISTORIA_ZMIANY_DATY_ROZLICZENIA,
      ILE_DNI_NA_PLATNOSC_FV,
      INFORMACJA_ZARZAD,
      JAKA_KANCELARIA,
      KONTRAHENT,
      KWOTA_DO_ROZLICZENIA_FK,
      KWOTA_WPS,
      LOKALIZACJA,
      NR_DOKUMENTU,
      DORADCA,
      NR_KLIENTA,
      OBSZAR,
      OPIEKUN_OBSZARU_CENTRALI,
      OPIS_ROZRACHUNKU,
      OSTATECZNA_DATA_ROZLICZENIA,
      OWNER,
      PRZEDZIAL_WIEKOWANIE,
      PRZETER_NIEPRZETER,
      RODZAJ_KONTA,
      ROZNICA,
      TERMIN_PLATNOSCI_FV,
      TYP_DOKUMENTU,
      TYP_PLATNOSCI,
      VIN,
      FIRMA
    )
    SELECT
      BRAK_DATY_WYSTAWIENIA_FV,
      CZY_SAMOCHOD_WYDANY_AS,
      CZY_W_KANCELARI,
      DATA_ROZLICZENIA_AS,
      DATA_WYDANIA_AUTA,
      DATA_WYSTAWIENIA_FV,
      DO_ROZLICZENIA_AS,
      DZIAL,
      ETAP_SPRAWY,
      HISTORIA_ZMIANY_DATY_ROZLICZENIA,
      ILE_DNI_NA_PLATNOSC_FV,
      INFORMACJA_ZARZAD,
      JAKA_KANCELARIA,
      KONTRAHENT,
      KWOTA_DO_ROZLICZENIA_FK,
      KWOTA_WPS,
      LOKALIZACJA,
      NR_DOKUMENTU,
      DORADCA,
      NR_KLIENTA,
      OBSZAR,
      OPIEKUN_OBSZARU_CENTRALI,
      OPIS_ROZRACHUNKU,
      OSTATECZNA_DATA_ROZLICZENIA,
      OWNER,
      PRZEDZIAL_WIEKOWANIE,
      PRZETER_NIEPRZETER,
      RODZAJ_KONTA,
      ROZNICA,
      TERMIN_PLATNOSCI_FV,
      TYP_DOKUMENTU,
      TYP_PLATNOSCI,
      VIN,
      FIRMA
    FROM company_windykacja.company_fk_raport_KRT
  `);

    console.log(reports);
    console.log("reports");
  } catch (error) {
    console.error(error);
  }
};
const copy_fk_accountancy_KRT = async () => {
  try {
    await connect_SQL.query(
      "TRUNCATE testy_windykacja.company_raportFK_KRT_accountancy"
    );

    const [reports] = await connect_SQL.query(`
    INSERT INTO testy_windykacja.company_raportFK_KRT_accountancy (
      NUMER_FV,
      KONTRAHENT,
      NR_KONTRAHENTA,
      DO_ROZLICZENIA,
      TERMIN_FV,
      KONTO,
      TYP_DOKUMENTU,
      DZIAL,
      FIRMA
    )
    SELECT
       NUMER_FV,
      KONTRAHENT,
      NR_KONTRAHENTA,
      DO_ROZLICZENIA,
      TERMIN_FV,
      KONTO,
      TYP_DOKUMENTU,
      DZIAL,
      FIRMA
    FROM company_windykacja.company_raportFK_KRT_accountancy
  `);

    console.log(reports);
    console.log("reports");
  } catch (error) {
    console.error(error);
  }
};

const checkAccountancyData = async (req, res) => {
  try {
    const accountancyData = await getAccountancyDataMsSQL("KRT", res);
    const test = accountancyData.map((item) => {
      if (item.NUMER === "FV/BL/48/25/A/D78") {
        console.log(item);
      }
    });
    // console.log(accountancyData);
  } catch (error) {
    console.error(error);
  }
};

const generateHistoryDocumentsRepair = async (company) => {
  try {
    const [raportDate] = await connect_SQL.query(
      `SELECT DATE FROM  company_fk_updates_date WHERE title = 'generate' AND COMPANY = ?`,
      [company]
    );
    const [markDocuments] = await connect_SQL.query(
      `SELECT NUMER_FV, COMPANY FROM company_mark_documents WHERE RAPORT_FK = 1 AND COMPANY = ?`,
      [company]
    );

    for (item of markDocuments) {
      // sprawdzam czy dokument ma wpisy histori w tabeli management_decision_FK
      const [getDoc] = await connect_SQL.query(
        `SELECT * FROM company_management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ? AND COMPANY = ?`,
        [item.NUMER_FV, raportDate[0].DATE, company]
      );

      //szukam czy jest wpis histori w tabeli history_fk_documents
      const [getDocHist] = await connect_SQL.query(
        `SELECT HISTORY_DOC FROM company_history_management WHERE NUMER_FV = ? AND COMPANY = ?`,
        [item.NUMER_FV, company]
      );
      // console.log(getDocHist, " - ", item);

      if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
        console.log(item);
        console.log(getDocHist[0].HISTORY_DOC);
      }

      //jesli nie ma historycznych wpisów tworzę nowy
      if (!getDocHist.length) {
        const newHistory = {
          info: `1 raport utworzono ${raportDate[0].DATE}`,
          historyDate: [],
          historyText: [],
        };

        // Przechodzimy przez każdy obiekt w getDoc i dodajemy wartości do odpowiednich tablic
        getDoc.forEach((doc) => {
          if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
            newHistory.historyDate.push(
              ...doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            );
          }
          if (doc.INFORMACJA_ZARZAD) {
            newHistory.historyText.push(...doc.INFORMACJA_ZARZAD);
          }
        });

        // await connect_SQL.query(
        //   `INSERT INTO company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
        //   [item.NUMER_FV, JSON.stringify([newHistory]), company]
        // );
      } else {
        const newHistory = {
          info: `${getDocHist[0].HISTORY_DOC.length + 1} raport utworzono ${
            raportDate[0].DATE
          }`,
          historyDate: [],
          historyText: [],
        };
        getDoc.forEach((doc) => {
          if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
            newHistory.historyDate.push(
              ...doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA
            );
          }
          if (doc.INFORMACJA_ZARZAD) {
            newHistory.historyText.push(...doc.INFORMACJA_ZARZAD);
          }
        });
        const prepareArray = [...getDocHist[0].HISTORY_DOC, newHistory];

        if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
          console.log(item);
          console.log(prepareArray);
        }

        // await connect_SQL.query(
        //   `UPDATE company_history_management SET HISTORY_DOC = ? WHERE NUMER_FV = ? AND COMPANY = ?`,
        //   [JSON.stringify(prepareArray), item.NUMER_FV, company]
        // );
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const repairManagementDecision = async () => {
  try {
    await connect_SQL.query(
      "TRUNCATE company_windykacja.company_history_management"
    );
    const [result] = await connect_SQL.query(
      "INSERT INTO company_windykacja.company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) SELECT NUMER_FV, HISTORY_DOC, COMPANY FROM testy_windykacja.company_history_management"
    );

    console.log(result);

    // const test = result.map((item) => {
    //   if (item.NUMER_FV === "FV/UP/696/25/V/D6") {
    //     console.log(item);
    //   }
    // });
  } catch (error) {
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
  generatePassword,
  repairHistory,
  repairManagementDecisionFK,
  usersDepartmentsCompany,
  testAddDocumentToDatabase,
  addDocToHistory,
  getOwnersMail,
  prepareToNewCompany,
  getRacData,
  getRacDataTime,
  settlementsRAC,
  prepareRac,
  copy_fk_raport_KRT,
  checkAccountancyData,
  copy_fk_accountancy_KRT,
  generateHistoryDocumentsRepair,
  repairManagementDecision,
};
