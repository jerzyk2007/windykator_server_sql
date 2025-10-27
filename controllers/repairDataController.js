const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const {
  generatePassword,
  documentsType,
  addDepartment,
} = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");
const { getAccountancyDataMsSQL } = require("./fkRaportController");

// naprawa/zamiana imienia i nazwiska dla Doradców - zamiana miejscami imienia i nazwiska
const repairAdvisersName = async (req, res) => {
  try {
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

// const repairHistory = async () => {
//   try {
//     const [dataHistory] = await connect_SQL.query(
//       "SELECT * FROM company_windykacja.company_history_management"
//     );

//     const test = dataHistory.map((item) => {
//       if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
//         console.log(item);
//       }
//     });

//     const targetDate = "2025-09-11";

//     const filteredDataHistory = dataHistory.map((doc) => {
//       return {
//         ...doc,
//         HISTORY_DOC: doc.HISTORY_DOC.filter(
//           (historyItem) => !historyItem.info.includes(`utworzono ${targetDate}`)
//         ),
//       };
//     });

//     const test2 = filteredDataHistory.map((item) => {
//       if (item.NUMER_FV === "FV/UBL/134/25/A/D78") {
//         console.log(item);
//       }
//     });
//     await connect_SQL.query(
//       "TRUNCATE company_windykacja.company_history_management"
//     );

//     for (const doc of filteredDataHistory) {
//       // console.log(doc);
//       await connect_SQL.query(
//         `INSERT INTO company_windykacja.company_history_management (NUMER_FV, HISTORY_DOC, COMPANY) VALUES (?, ?, ?)`,
//         [doc.NUMER_FV, JSON.stringify(doc.HISTORY_DOC), doc.COMPANY]
//       );
//     }
//     console.log("nic");

//   } catch (err) {
//     console.error(err);
//   }
// };

// const repairManagementDecisionFK = async () => {
//   try {
//     const [getDateDecision] = await connect_SQL.query(
//       "SELECT * FROM management_decision_FK"
//     );

//     // łączę dane z management_decision_FK HISTORIA_ZMIANY_DATY_ROZLICZENIA i INFORMACJA_ZARZADw jeden obiekt
//     // const merged = [];

//     // getDateDecision.forEach(item => {
//     //     const existing = merged.find(el =>
//     //         el.NUMER_FV === item.NUMER_FV &&
//     //         el.WYKORZYSTANO_RAPORT_FK === item.WYKORZYSTANO_RAPORT_FK
//     //     );

//     //     if (existing) {
//     //         // Uzupełnij brakujące pola tylko jeśli są null
//     //         if (!existing.INFORMACJA_ZARZAD && item.INFORMACJA_ZARZAD) {
//     //             existing.INFORMACJA_ZARZAD = item.INFORMACJA_ZARZAD;
//     //         }

//     //         if (!existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA && item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
//     //             existing.HISTORIA_ZMIANY_DATY_ROZLICZENIA = item.HISTORIA_ZMIANY_DATY_ROZLICZENIA;
//     //         }
//     //     } else {
//     //         // Brak duplikatu, dodaj nowy obiekt
//     //         merged.push({ ...item });
//     //     }
//     // });
//     // console.log(merged);
//     // console.log(getDateDecision);

//     const groupedMap = new Map();

//     for (const item of getDateDecision) {
//       const key = `${item.NUMER_FV}|${item.WYKORZYSTANO_RAPORT_FK}`;

//       if (!groupedMap.has(key)) {
//         groupedMap.set(key, {
//           NUMER_FV: item.NUMER_FV,
//           WYKORZYSTANO_RAPORT_FK: item.WYKORZYSTANO_RAPORT_FK,
//           INFORMACJA_ZARZAD: [],
//           HISTORIA_ZMIANY_DATY_ROZLICZENIA: [],
//         });
//       }

//       const group = groupedMap.get(key);

//       if (item.INFORMACJA_ZARZAD) {
//         group.INFORMACJA_ZARZAD.push(item.INFORMACJA_ZARZAD);
//       }

//       if (item.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
//         group.HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(
//           item.HISTORIA_ZMIANY_DATY_ROZLICZENIA
//         );
//       }
//     }

//     const result = Array.from(groupedMap.values());
//     // const test2 = result.map(item => {

//     //     if (item.NUMER_FV === 'FV/UP/5189/24/A/D86') {
//     //         console.log(item);

//     //     }
//     // });

//     for (const doc of result) {
//       await connect_SQL.query(
//         `INSERT INTO management_date_description_FK (NUMER_FV, WYKORZYSTANO_RAPORT_FK, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA) VALUES (?, ?, ?, ?)`,
//         [
//           doc.NUMER_FV,
//           doc.WYKORZYSTANO_RAPORT_FK,
//           JSON.stringify(doc.INFORMACJA_ZARZAD),
//           JSON.stringify(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA),
//         ]
//       );
//     }
//   } catch (err) {
//     console.error(err);
//   }
// };

//do wyciągnięcia maili ownerów
// const getOwnersMail = async (company) => {
//   try {
//     const [owners] = await connect_SQL.query(
//       `SELECT OWNER FROM company_join_items
//             WHERE COMPANY = ?`,
//       [company]
//     );

//     const uniqueOwners = [...new Set(owners.flatMap((obj) => obj.OWNER))].sort(
//       (a, b) => a.localeCompare(b, "pl", { sensitivity: "base" })
//     );

//     let mailArray = [];
//     for (const owner of uniqueOwners) {
//       const [mailOwner] = await connect_SQL.query(
//         `SELECT OWNER_MAIL FROM company_owner_items
//             WHERE OWNER = ?`,
//         [owner]
//       );
//       // console.log(owner);
//       mailArray.push(mailOwner[0].OWNER_MAIL);
//     }
//     const index = mailArray.indexOf("brak@danych.brak");
//     if (index !== -1) {
//       mailArray.splice(index, 1);
//     }
//     console.log(mailArray.join("; "));
//   } catch (error) {
//     console.error(error);
//   }
// };

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

//przygotowanie do KRD

const prepareKRD = async () => {
  try {
    const [result] = await connect_SQL.query(`
  ALTER TABLE company_documents_actions 
  ADD COLUMN KRD VARCHAR(45) NULL
`);
    console.log("Kolumna KRD dodana:", result);
  } catch (error) {
    console.error(error);
  }
};

const checkAdminUsers = async () => {
  try {
    const [result] = await connect_SQL.query("SELECT * FROM company_users");
    console.log(result);

    for (const user of result) {
      if (user.roles?.Admin) {
        console.log(user.userlogin);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const reportFK_RAC = async () => {
  try {
    await connect_SQL.query(`
              CREATE TABLE company_raportFK_RAC_accountancy
        LIKE company_raportFK_KEM_accountancy;
              `);

    await connect_SQL.query(`
          CREATE TABLE company_fk_raport_RAC
    LIKE company_fk_raport_KEM;
          `);

    const data = [
      {
        title: "accountancy",
        company: "RAC",
      },
      {
        title: "generate",
        company: "RAC",
      },
      {
        title: "raport",
        company: "RAC",
      },
    ];

    for (const doc of data) {
      await connect_SQL.query(
        "INSERT INTO company_fk_updates_date (TITLE, COMPANY) VALUES (?, ?)",
        [doc.title, doc.company]
      );
    }

    await connect_SQL.query(
      "CREATE TABLE company_fk_settlements (  id_company_fk_settlements INT NOT NULL AUTO_INCREMENT,   NUMER_FV VARCHAR(255) NOT NULL,   DO_ROZLICZENIA DECIMAL(12,2) NOT NULL,   FIRMA VARCHAR(10) NOT NULL,   PRIMARY KEY (id_company_fk_settlements),   UNIQUE (id_company_fk_settlements))"
    );

    console.log("rac");
  } catch (error) {
    console.error(error);
  }
};

const as_fk = async (companies) => {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // miesiące 0–11
    const dd = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${yyyy}-${mm}-${dd}`;
    for (const company of companies) {
      const queryMS = accountancyFKData(company, formattedDate);
      const accountancyData = await msSqlQuery(queryMS);

      await connect_SQL.query(
        "DELETE FROM company_fk_settlements WHERE FIRMA = ?",
        [company]
      );

      const values = accountancyData.map((item) => [
        item["dsymbol"],
        item["płatność"],
        company,
      ]);

      const query = `
         INSERT IGNORE INTO company_fk_settlements
        (NUMER_FV,  DO_ROZLICZENIA, FIRMA) 
         VALUES 
        ${values.map(() => "( ?, ?, ?)").join(", ")}
    `;

      await connect_SQL.query(query, values.flat());
    }
  } catch (error) {
    console.error(error);
  }
};

const repair_mysql = async () => {
  try {
    const [result] = await connect_SQL.query(`
  SELECT CONCAT(
    'ALTER TABLE \`', table_name, 
    '\` CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_polish_ci;'
  ) AS sql_command
  FROM information_schema.tables
  WHERE table_schema = 'company_windykacja';
`);
    // Wykonaj każdą komendę ALTER TABLE
    for (const row of result) {
      const sql = row.sql_command;
      console.log("Wykonuję:", sql);
      await connect_SQL.query(sql);
    }
  } catch (error) {
    console.error(error);
  }
};

const getRaportDifferncesAsFk = async () => {
  try {
    const documents = await getDataDocuments(117, "different");

    for (doc of documents.data) {
      if (doc.NUMER_FV === "FV/AD/F/30/25/A/D72") {
        console.log(doc);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

// do naprawy rozliczeń symfoni do różnic
const updateFKSettlements = async (companies) => {
  try {
    const today = new Date();
    const yyyy = today.getFullYear();
    const mm = String(today.getMonth() + 1).padStart(2, "0"); // miesiące 0–11
    const dd = String(today.getDate()).padStart(2, "0");
    const formattedDate = `${yyyy}-${mm}-${dd}`;
    for (const company of companies) {
      const queryMS = accountancyFKData(company, formattedDate);
      const accountancyData = await msSqlQuery(queryMS);

      await connect_SQL.query(
        "DELETE FROM company_fk_settlements WHERE FIRMA = ?",
        [company]
      );

      const values1 = accountancyData.map((item) => [
        item["dsymbol"],
        item["płatność"],
        company,
      ]);

      const values = accountancyData
        .filter((item) => documentsType(item["dsymbol"]) === "Faktura")
        .map((item) => [item["dsymbol"], item["płatność"], company]);

      const query = `
         INSERT IGNORE INTO company_fk_settlements
        (NUMER_FV,  DO_ROZLICZENIA, FIRMA) 
         VALUES 
        ${values.map(() => "( ?, ?, ?)").join(", ")}
    `;

      await connect_SQL.query(query, values.flat());
    }
    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, updateFKSettlements: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

// dodanie nowej roli Raports
const addRoleRaports = async () => {
  try {
    await connect_SQL.query(
      "UPDATE company_settings SET ROLES = ? WHERE id_setting = 1",
      [
        JSON.stringify([
          {
            Start: 1,
            User: 100,
            Editor: 110,
            Controller: 120,
            DNiKN: 150,
            FK_KRT: 200,
            FK_KEM: 201,
            FK_RAC: 202,
            Nora: 300,
            Raports: 400,
            Admin: 1000,
            SuperAdmin: 2000,
          },
        ]),
      ]
    );

    const [roles] = await connect_SQL.query("SELECT * FROM company_settings");
    for (const role of roles) {
      console.log(role.roles);
    }
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

// generuję historię decyzji i ostatecznej daty rozliczenia
const generateHistoryDocuments = async (company) => {
  try {
    const [raportDate] = await connect_SQL.query(
      `SELECT DATE FROM  company_fk_updates_date WHERE title = 'raport' AND COMPANY = ?`,
      [company]
    );

    const [markDocuments] = await connect_SQL.query(
      `SELECT NUMER_FV, COMPANY FROM company_mark_documents WHERE RAPORT_FK = 1 AND COMPANY = ?`,
      [company]
    );

    for (item of markDocuments) {
      if (item.NUMER_FV === "FV/UP/626/25/S/D6") {
        console.log(item);
      }
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

        // await connect_SQL.query(
        //   `UPDATE company_history_management SET HISTORY_DOC = ? WHERE NUMER_FV = ? AND COMPANY = ?`,
        //   [JSON.stringify(prepareArray), item.NUMER_FV, company]
        // );
      }
    }
  } catch (error) {
    logEvents(
      `fKRaport, generateHistoryDocuments: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const checkHistory = async () => {
  const docs = [
    {
      "NR DOKUMENTU": "FV/UP/1770/25/V/D6",
    },
    {
      "NR DOKUMENTU": "FV/UBL/791/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/MN/12848/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/MN/12846/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/MN/13475/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/UP/1388/25/S/D66",
    },
    {
      "NR DOKUMENTU": "FV/UBL/336/25/A/D78",
    },
    {
      "NR DOKUMENTU": "FV/UBL/926/25/A/D8",
    },
    {
      "NR DOKUMENTU": "FV/UBL/335/25/A/D78",
    },
    {
      "NR DOKUMENTU": "FV/MN/15667/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15666/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15656/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/UP/1629/25/A/D6",
    },
    {
      "NR DOKUMENTU": "FV/UP/1328/25/V/D126",
    },
    {
      "NR DOKUMENTU": "FV/UP/3607/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/MN/12760/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/UP/2845/25/A/D36",
    },
    {
      "NR DOKUMENTU": "FV/UBL/347/25/S/D148",
    },
    {
      "NR DOKUMENTU": "FV/UBL/163/25/P/D98",
    },
    {
      "NR DOKUMENTU": "FV/MN/15550/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15561/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15576/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15297/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/M/INT/11191/25/A/D27",
    },
    {
      "NR DOKUMENTU": "FV/UP/3782/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/UP/2941/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/M/524/25/V/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15491/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15490/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15617/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15609/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15691/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15690/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/15689/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/13924/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/M/1715/25/P/D97",
    },
    {
      "NR DOKUMENTU": "FV/MN/15775/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/16035/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/14455/25/A/D447",
    },
    {
      "NR DOKUMENTU": "NO/6/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/14946/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/I/377/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/UP/2349/25/S/D146",
    },
    {
      "NR DOKUMENTU": "FV/UP/4305/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/UP/2350/25/S/D146",
    },
    {
      "NR DOKUMENTU": "FV/I/203/25/V/D2",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/697/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/UP/4407/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/UP/2183/25/V/D6",
    },
    {
      "NR DOKUMENTU": "FV/UP/832/25/D/D66",
    },
    {
      "NR DOKUMENTU": "FV/AN/SPZ/16/25/V/D3",
    },
    {
      "NR DOKUMENTU": "FV/AN/SPZ/13/25/V/D3",
    },
    {
      "NR DOKUMENTU": "FV/UP/4185/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/AN/303/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/AN/F/826/25/A/D72",
    },
    {
      "NR DOKUMENTU": "FV/M/571/25/V/D67",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/275/25/A/D111",
    },
    {
      "NR DOKUMENTU": "FV/AN/282/25/V/D2",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/238/25/V/D51",
    },
    {
      "NR DOKUMENTU": "FV/I/174/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/UBL/687/25/A/D8",
    },
    {
      "NR DOKUMENTU": "FV/UP/368/25/D/D6",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/394/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/274/25/A/D111",
    },
    {
      "NR DOKUMENTU": "FV/UP/819/25/D/D66",
    },
    {
      "NR DOKUMENTU": "FV/UP/3195/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/UBL/284/25/S/D148",
    },
    {
      "NR DOKUMENTU": "FV/UBL/244/25/V/D118",
    },
    {
      "NR DOKUMENTU": "FV/M/536/25/V/D57",
    },
    {
      "NR DOKUMENTU": "FV/I/F/111/25/A/D72",
    },
    {
      "NR DOKUMENTU": "FV/UP/3081/25/A/D36",
    },
    {
      "NR DOKUMENTU": "FV/LS/26/25/X/D89",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/391/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/390/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/397/25/A/D31",
    },
    {
      "NR DOKUMENTU": "FV/UP/3329/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/BL/30/25/V/D118",
    },
    {
      "NR DOKUMENTU": "FV/UBL/738/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/UBL/111/25/S/D68",
    },
    {
      "NR DOKUMENTU": "FV/I/12/25/X/D69",
    },
    {
      "NR DOKUMENTU": "FV/I/14/25/X/D79",
    },
    {
      "NR DOKUMENTU": "FV/UP/1608/25/A/D46",
    },
    {
      "NR DOKUMENTU": "FV/UP/2682/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/UP/1636/25/A/D46",
    },
    {
      "NR DOKUMENTU": "FV/UP/1634/25/A/D46",
    },
    {
      "NR DOKUMENTU": "FV/I/343/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/I/25/25/X/D84",
    },
    {
      "NR DOKUMENTU": "FV/I/258/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/AN/198/25/D/D65",
    },
    {
      "NR DOKUMENTU": "FV/UP/2652/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/MN/12607/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/UP/1925/25/A/D116",
    },
    {
      "NR DOKUMENTU": "FV/UBL/330/25/A/D78",
    },
    {
      "NR DOKUMENTU": "FV/UBL/821/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/WS/14/25/A/D78",
    },
    {
      "NR DOKUMENTU": "FV/UBL/907/25/A/D8",
    },
    {
      "NR DOKUMENTU": "FV/UBL/166/25/V/D68",
    },
    {
      "NR DOKUMENTU": "FV/UBL/165/25/V/D68",
    },
    {
      "NR DOKUMENTU": "FV/UBL/492/25/V/D58",
    },
    {
      "NR DOKUMENTU": "FV/UBL/841/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/UBL/168/25/V/D68",
    },
    {
      "NR DOKUMENTU": "FV/UP/2951/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/UP/626/25/S/D6",
    },
    {
      "NR DOKUMENTU": "FV/UBL/141/25/V/D68",
    },
    {
      "NR DOKUMENTU": "FV/UBL/324/25/V/D8",
    },
    {
      "NR DOKUMENTU": "FV/MN/14236/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/MN/12461/25/A/D447",
    },
    {
      "NR DOKUMENTU": "FV/UBL/816/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/UP/1361/25/S/D66",
    },
    {
      "NR DOKUMENTU": "FV/UBL/686/25/A/D8",
    },
    {
      "NR DOKUMENTU": "FV/UBL/136/25/V/D68",
    },
    {
      "NR DOKUMENTU": "FV/UBL/482/25/V/D58",
    },
    {
      "NR DOKUMENTU": "FV/UP/613/25/S/D6",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/658/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/268/25/A/D111",
    },
    {
      "NR DOKUMENTU": "FV/UBL/345/25/A/D118",
    },
    {
      "NR DOKUMENTU": "FV/UBL/878/25/A/D8",
    },
    {
      "NR DOKUMENTU": "FV/UP/1922/25/V/D6",
    },
    {
      "NR DOKUMENTU": "FV/I/F/127/25/V/D52",
    },
    {
      "NR DOKUMENTU": "FV/I/F/124/25/V/D62",
    },
    {
      "NR DOKUMENTU": "FV/AD/17/25/V/D61",
    },
    {
      "NR DOKUMENTU": "FV/M/572/25/V/D67",
    },
    {
      "NR DOKUMENTU": "FV/M/265/25/A/D117",
    },
    {
      "NR DOKUMENTU": "FV/M/INT/11962/25/A/D27",
    },
    {
      "NR DOKUMENTU": "FV/I/358/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/695/25/A/D71",
    },
    {
      "NR DOKUMENTU": "FV/AD/38/25/A/D71",
    },
    {
      "NR DOKUMENTU": "FV/UP/4279/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/537/25/A/D1",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/533/25/V/D2",
    },
    {
      "NR DOKUMENTU": "FV/UP/1463/25/S/D66",
    },
    {
      "NR DOKUMENTU": "FV/BL/7/25/S/D68",
    },
    {
      "NR DOKUMENTU": "FV/UP/3422/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/M/124/25/S/D67",
    },
    {
      "NR DOKUMENTU": "FV/UP/1292/25/S/D56",
    },
    {
      "NR DOKUMENTU": "FV/MN/15807/25/S/D7",
    },
    {
      "NR DOKUMENTU": "FV/UP/781/25/D/D66",
    },
    {
      "NR DOKUMENTU": "FV/UP/4134/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/AN/F/530/25/S/D172",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/538/25/A/D1",
    },
    {
      "NR DOKUMENTU": "FV/I/46/25/S/D141",
    },
    {
      "NR DOKUMENTU": "FV/UP/3408/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/UP/1703/25/A/D46",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/634/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/I/167/25/P/D91",
    },
    {
      "NR DOKUMENTU": "FV/ST/7/25/X/D4",
    },
    {
      "NR DOKUMENTU": "FV/UP/1976/25/A/D116",
    },
    {
      "NR DOKUMENTU": "FV/UP/3878/25/A/D76",
    },
    {
      "NR DOKUMENTU": "FV/UP/1970/25/A/D116",
    },
    {
      "NR DOKUMENTU": "FV/AN/F/741/25/A/D72",
    },
    {
      "NR DOKUMENTU": "FV/UG/910/25/P/D96",
    },
    {
      "NR DOKUMENTU": "FV/I/190/25/V/D2",
    },
    {
      "NR DOKUMENTU": "FV/I/240/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/204/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/199/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/211/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/244/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/208/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/213/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/207/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/220/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/234/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/191/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/209/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/212/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/194/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/233/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/224/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/225/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/228/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/195/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/197/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/206/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/221/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/193/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/222/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/239/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/210/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/223/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/201/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/202/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/235/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/217/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/230/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/229/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/232/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/242/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/200/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/227/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/216/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/238/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/241/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/192/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/198/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/203/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/215/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/205/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/231/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/196/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/236/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/214/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/218/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/226/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/I/219/25/X/D14",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/605/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/UBL/291/25/V/D118",
    },
    {
      "NR DOKUMENTU": "FV/AD/12/25/D/D5",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/631/25/A/D81",
    },
    {
      "NR DOKUMENTU": "FV/AN/F/717/25/A/D72",
    },
    {
      "NR DOKUMENTU": "FV/UP/2945/25/A/D36",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/681/25/A/D71",
    },
    {
      "NR DOKUMENTU": "FV/I/164/25/A/D71",
    },
    {
      "NR DOKUMENTU": "FV/UP/2898/25/V/D66",
    },
    {
      "NR DOKUMENTU": "FV/UP/1262/25/S/D56",
    },
    {
      "NR DOKUMENTU": "FV/UP/1263/25/S/D56",
    },
    {
      "NR DOKUMENTU": "FV/ZAL/528/25/A/D1",
    },
    {
      "NR DOKUMENTU": "FV/UBL/666/25/A/D38",
    },
    {
      "NR DOKUMENTU": "FV/UP/1345/25/S/D66",
    },
    {
      "NR DOKUMENTU": "FV/M/INT/46/25/A/D37",
    },
    {
      "NR DOKUMENTU": "FV/I/104/25/A/D1",
    },
  ];
  try {
    for (const doc of docs) {
      const [result] = await connect_SQL.query(
        "SELECT * FROM company_windykacja.company_history_management WHERE NUMER_FV = ?",
        [doc["NR DOKUMENTU"]]
      );
      if (result.length) {
        console.log(result[0].id_history_fk_documents);
        //   const [deleteDoc] = await connect_SQL.query(
        //     "DELETE FROM company_windykacja.company_history_management WHERE id_history_fk_documents = ?",
        //     [result[0].id_history_fk_documents]
        //   );
        //   console.log(deleteDoc);
      }
    }
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    const companies = ["KRT", "KEM", "RAC"];

    // await addRoleRaports();

    // await getOwnersMail("KRT");

    // await generateHistoryDocuments("KRT");

    // await checkHistory();

    // await getAccountancyDataMsSQL("KRT");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repairAdvisersName,
  createAccounts,
  generatePassword,
  generateHistoryDocumentsRepair,
  repairManagementDecision,
  repair,
};
