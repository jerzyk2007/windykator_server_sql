const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { verifyUserTableConfig } = require("./usersController");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const { generatePassword, documentsType } = require("./manageDocumentAddition");
const { addDepartment } = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");

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
    const index = mailArray.indexOf("brak@danych.brak");
    if (index !== -1) {
      mailArray.splice(index, 1);
    }
    console.log(mailArray.join("; "));
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

const createLawTable = async () => {
  try {
    //  await connect_SQL.query(
    //   "CREATE TABLE company_fk_settlements (  id_company_fk_settlements INT NOT NULL AUTO_INCREMENT,   NUMER_FV VARCHAR(255) NOT NULL,   DO_ROZLICZENIA DECIMAL(12,2) NOT NULL,   FIRMA VARCHAR(10) NOT NULL,   PRIMARY KEY (id_company_fk_settlements),   UNIQUE (id_company_fk_settlements))"
    // );
  } catch (error) {
    console.error(error);
  }
};

const changeOldUserPewrmissions = async () => {
  try {
    const permissions = { Pracownik: true, Kancelaria: false };

    await connect_SQL.query("UPDATE company_users SET permissions = ? ", [
      JSON.stringify(permissions),
    ]);
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    const companies = ["KRT", "KEM", "RAC"];

    // await addRoleRaports();

    // await getOwnersMail("KRT");
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repairAdvisersName,
  createAccounts,
  generatePassword,
  repairHistory,
  repairManagementDecisionFK,
  generateHistoryDocumentsRepair,
  repairManagementDecision,
  repair,
};
