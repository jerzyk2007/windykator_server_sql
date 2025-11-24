const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const cron = require("node-cron");
const { logEvents } = require("../middleware/logEvents");
const { addDepartment, documentsType } = require("./manageDocumentAddition");
const { checkDate, checkTime } = require("./manageDocumentAddition");
const {
  addDocumentToDatabaseQuery,
  updateDocZaLQuery,
  updateCarReleaseDatesQuery,
  updateSettlementsQuery,
  updateSettlementDescriptionQuery,
  accountancyFKData,
} = require("./sqlQueryForGetDataFromMSSQL");

const today = new Date();
today.setDate(today.getDate() - 2); // Odejmujemy 2 dni
const twoDaysAgo = today.toISOString().split("T")[0];
// const twoDaysAgo = "2024-10-01";

// zamienia na krótki format daty
const formatDate = (date) => {
  if (date instanceof Date) {
    return date.toISOString().split("T")[0]; // Wyciąga tylko część daty, np. "2024-11-08"
  }
  return date;
};

//pobieram dokumenty z bazy mssql AS
const addDocumentToDatabase = async (type) => {
  const query = addDocumentToDatabaseQuery(type, twoDaysAgo);

  try {
    const documents = await msSqlQuery(query);

    // dodaje nazwy działów
    const addDep = addDepartment(documents);

    addDep.forEach((row) => {
      row.DATA_WYSTAWIENIA = formatDate(row.DATA_WYSTAWIENIA);
      row.DATA_ZAPLATA = formatDate(row.DATA_ZAPLATA);
    });

    for (const doc of addDep) {
      await connect_SQL.query(
        "INSERT IGNORE INTO company_documents (NUMER_FV, BRUTTO, NETTO, DZIAL, DO_ROZLICZENIA, DATA_FV, TERMIN, KONTRAHENT, DORADCA, NR_REJESTRACYJNY, NR_SZKODY, UWAGI_Z_FAKTURY, TYP_PLATNOSCI, NIP, VIN, NR_AUTORYZACJI, KOREKTA, FIRMA) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
        [
          doc.NUMER,
          doc.WARTOSC_BRUTTO,
          doc.WARTOSC_NETTO,
          doc.DZIAL,
          doc.WARTOSC_NAL || 0,
          doc.DATA_WYSTAWIENIA,
          doc.DATA_ZAPLATA,
          doc.KONTR_NAZWA,
          doc.PRZYGOTOWAL ? doc.PRZYGOTOWAL : "Brak danych",
          doc.REJESTRACJA,
          doc.NR_SZKODY || null,
          doc.UWAGI,
          doc.TYP_PLATNOSCI || null,
          doc.KONTR_NIP || null,
          doc.NR_NADWOZIA,
          doc.NR_AUTORYZACJI || null,
          doc.KOREKTA_NUMER,
          type,
        ]
      );
    }

    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, addDocumentToDatabase: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

// pobieram fv zaliczkowe, nazwy i kwoty dla KRT i KEM
const updateDocZal = async (companies) => {
  try {
    // const companies = ['KRT', 'KEM', 'RAC'];

    // const documents = (
    //   await Promise.all(
    //     companies.map(async (company) => {
    //       const docs = await msSqlQuery(updateDocZaLQuery(company));
    //       return docs.map((doc) => ({ ...doc, COMPANY: company }));
    //     })
    //   )
    // ).flat();

    const documents = (
      await Promise.all(
        companies.map(async (company) => {
          if (company === "RAC") {
            return [];
          }
          const docs = await msSqlQuery(updateDocZaLQuery(company));
          return docs.map((doc) => ({ ...doc, COMPANY: company }));
        })
      )
    ).flat();

    await connect_SQL.query("TRUNCATE TABLE company_fv_zaliczkowe");

    // //     // // Teraz przygotuj dane do wstawienia
    const values = documents.map((item) => [
      item.NUMER_FV,
      item.FV_ZALICZKOWA,
      item.WARTOSC_BRUTTO,
      item.COMPANY,
    ]);

    // Przygotowanie zapytania SQL z wieloma wartościami
    const query = `
          INSERT IGNORE INTO company_fv_zaliczkowe 
            ( NUMER_FV, FV_ZALICZKOWA, KWOTA_BRUTTO, COMPANY) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?)").join(", ")}
        `;

    //     // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, updateDocZal: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

// aktualizuję daty wydania dla KRT, KEM i innych
const updateCarReleaseDates = async (companies) => {
  const twoDaysAgo = "2024-01-01";
  try {
    // const companies = ['KRT', 'KEM', 'RAC'];

    const carReleaseDates = (
      await Promise.all(
        companies.map(async (company) => {
          if (company === "RAC") {
            // dla RAC nic nie robimy, zwracamy pustą tablicę
            return [];
          }

          // tylko dla pozostałych firm wykonuje się zapytanie
          const docs = await msSqlQuery(
            updateCarReleaseDatesQuery(company, twoDaysAgo)
          );
          return docs.map((doc) => ({ ...doc, COMPANY: company }));
        })
      )
    ).flat();

    const queryMySql = `
    SELECT fv.id_document, fv.NUMER_FV, fv.FIRMA
    FROM company_documents as fv 
    LEFT JOIN company_documents_actions as da ON fv.id_document = da.document_id 
    LEFT JOIN company_join_items as ji ON fv.DZIAL = ji.department 
    WHERE da.DATA_WYDANIA_AUTA IS  NULL AND (ji.area='SAMOCHODY NOWE' OR ji.area='SAMOCHODY UŻYWANE') AND fv.NUMER_FV LIKE '%FV%'`;

    const [findDoc] = await connect_SQL.query(queryMySql);

    const filteredFindDoc = findDoc
      .filter((doc) =>
        carReleaseDates.some(
          (car) => car.NUMER === doc.NUMER_FV && car.COMPANY === doc.FIRMA
        )
      )
      .map((doc) => {
        const carDate = carReleaseDates.find(
          (car) => car.NUMER === doc.NUMER_FV && car.COMPANY === doc.FIRMA
        );
        return {
          ...doc,
          DATA_WYDANIA: carDate?.DATA_WYDANIA
            ? formatDate(carDate.DATA_WYDANIA)
            : null,
        };
      });

    for (const doc of filteredFindDoc) {
      // wstawia lub aktualizuje
      await connect_SQL.query(
        `INSERT INTO company_documents_actions (document_id, DATA_WYDANIA_AUTA)
         VALUES (?, ?)
         ON DUPLICATE KEY UPDATE DATA_WYDANIA_AUTA = ?`,
        [doc.id_document, doc.DATA_WYDANIA, doc.DATA_WYDANIA]
      );
    }

    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, updateCarReleaseDates: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

const updateSettlements = async (companies) => {
  try {
    const settlementsData = await Promise.all(
      companies.map(async (company) => {
        const rows = await msSqlQuery(updateSettlementsQuery(company));
        let mapped = [];
        if (company !== "RAC") {
          mapped = rows.map((item) => ({
            NUMER_FV: item.OPIS.split(" ")[0],
            DATA_FV: item.DATA_FV,
            DO_ROZLICZENIA: -item.WARTOSC_SALDO,
            COMPANY: company,
          }));
        } else {
          mapped = rows.map((item) => {
            return {
              NUMER_FV: item.dsymbol,
              DATA_FV: item.termin,
              DO_ROZLICZENIA: item["płatność"],
              COMPANY: "RAC",
            };
          });
        }
        const merged = Object.values(
          mapped.reduce((acc, item) => {
            if (acc[item.NUMER_FV]) {
              acc[item.NUMER_FV].DO_ROZLICZENIA += item.DO_ROZLICZENIA;
            } else {
              acc[item.NUMER_FV] = { ...item };
            }
            return acc;
          }, {})
        );
        return merged;
      })
    );

    const checkDuplicate = settlementsData.flat();

    // Najpierw wyczyść tabelę settlements
    await connect_SQL.query("TRUNCATE TABLE company_settlements");

    // Teraz przygotuj dane do wstawienia
    const values = checkDuplicate.map((item) => [
      item.NUMER_FV,
      item.DATA_FV,
      item.DO_ROZLICZENIA,
      item.COMPANY,
    ]);

    const query = `
       INSERT IGNORE INTO company_settlements
         ( NUMER_FV, DATA_FV, NALEZNOSC, COMPANY) 
       VALUES 
         ${values.map(() => "(?, ?, ?, ?)").join(", ")}
     `;
    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, uspdateSettlements: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

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

      // const values = accountancyData.map((item) => [
      //   item["dsymbol"],
      //   item["płatność"],
      //   company,
      // ]);

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

// pobranie opisów rozrachunków dla KRT
const updateSettlementDescriptionCompany = async (company) => {
  try {
    const settlementDescription = await msSqlQuery(
      updateSettlementDescriptionQuery(company)
    );

    const updatedSettlements = Object.values(
      settlementDescription.reduce((acc, item) => {
        // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
        const formattedAmount =
          typeof item.WARTOSC_OPERACJI === "number" &&
          !isNaN(item.WARTOSC_OPERACJI)
            ? item.WARTOSC_OPERACJI.toLocaleString("pl-PL", {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
                useGrouping: true,
              })
            : "brak danych";

        // Pomijanie wpisów, jeśli wszystkie dane są null lub brak danych
        if (
          item.DATA_OPERACJI === null &&
          item.NUMER_OPIS === null &&
          formattedAmount === "brak danych"
        ) {
          return acc;
        }

        const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;
        const newDataRozliczenia = new Date(item.DATA_ROZLICZENIA);
        const DATA_OPERACJI = item.DATA_OPERACJI;

        if (!acc[item.NUMER_FV]) {
          // Jeśli jeszcze nie ma wpisu dla tego NUMER_FV, tworzymy nowy obiekt
          acc[item.NUMER_FV] = {
            NUMER_FV: item.NUMER_FV,
            DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
            OPIS_ROZRACHUNKU: [description],
            COMPANY: company,
          };
        } else {
          // Jeśli już istnieje obiekt, dodajemy opis
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);

          // Porównujemy daty i aktualizujemy na najnowszą (najbliższą dzisiejszej)
          const currentDataRozliczenia = new Date(
            acc[item.NUMER_FV].DATA_ROZLICZENIA
          );
          if (
            new Date(DATA_OPERACJI) > newDataRozliczenia &&
            !item.DATA_ROZLICZENIA
          ) {
            acc[item.NUMER_FV].DATA_ROZLICZENIA = null;
          } else if (newDataRozliczenia > currentDataRozliczenia) {
            acc[item.NUMER_FV].DATA_ROZLICZENIA = item.DATA_ROZLICZENIA;
          }

          // Sortowanie opisów według daty
          acc[item.NUMER_FV].OPIS_ROZRACHUNKU.sort((a, b) => {
            const dateA = new Date(a.split(" - ")[0]);
            const dateB = new Date(b.split(" - ")[0]);
            return dateB - dateA;
          });
        }

        return acc;
      }, {})
    );
    return updatedSettlements;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, updateSettlementDescription_${company}: ${error}`,
      "reqServerErrors.txt"
    );
  }
};
// pobranie opisów rozrachunków dla KEM
// const updateSettlementDescriptionKEM = async () => {
//   const queryMsSql = `SELECT
//      CASE
//           WHEN CHARINDEX(' ', tr.[OPIS]) > 0 THEN LEFT(tr.[OPIS], CHARINDEX(' ', tr.[OPIS]) - 1)
//           ELSE tr.[OPIS]
//       END AS NUMER_FV,
//   rozl.[OPIS] AS NUMER_OPIS,
//   CONVERT(VARCHAR(10), tr.[DATA_ROZLICZENIA], 23) AS [DATA_ROZLICZENIA],
//   CONVERT(VARCHAR(10), rozl.[DATA], 23) AS DATA_OPERACJI,
//   rozl.[WARTOSC_SALDO] AS WARTOSC_OPERACJI
//   FROM     [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].TRANSDOC AS tr
//   LEFT JOIN    [AS3_PRACA_KROTOSKI_ELECTROMOBILITY].[dbo].[TRANSDOC] AS rozl   ON rozl.[TRANSDOC_EXT_PARENT_ID] = tr.[TRANSDOC_ID]
//   WHERE rozl.[WARTOSC_SALDO] IS NOT NULL`;

//   try {
//     const settlementDescription = await msSqlQuery(queryMsSql);

//     const updatedSettlements = Object.values(
//       settlementDescription.reduce((acc, item) => {
//         // Sprawdzenie, czy WARTOSC_OPERACJI jest liczbą, jeśli nie to przypisanie pustego pola
//         const formattedAmount = (typeof item.WARTOSC_OPERACJI === 'number' && !isNaN(item.WARTOSC_OPERACJI))
//           ? item.WARTOSC_OPERACJI.toLocaleString('pl-PL', {
//             minimumFractionDigits: 2,
//             maximumFractionDigits: 2,
//             useGrouping: true
//           })
//           : 'brak danych';

//         // Pomijanie wpisów, jeśli wszystkie dane są null lub brak danych
//         if (item.DATA_OPERACJI === null && item.NUMER_OPIS === null && formattedAmount === 'brak danych') {
//           return acc;
//         }

//         const description = `${item.DATA_OPERACJI} - ${item.NUMER_OPIS} - ${formattedAmount}`;
//         const newDataRozliczenia = new Date(item.DATA_ROZLICZENIA);
//         const DATA_OPERACJI = item.DATA_OPERACJI;

//         if (!acc[item.NUMER_FV]) {
//           // Jeśli jeszcze nie ma wpisu dla tego NUMER_FV, tworzymy nowy obiekt
//           acc[item.NUMER_FV] = {
//             NUMER_FV: item.NUMER_FV,
//             DATA_ROZLICZENIA: item.DATA_ROZLICZENIA,
//             OPIS_ROZRACHUNKU: [description],
//             COMPANY: 'KEM'
//           };
//         } else {
//           // Jeśli już istnieje obiekt, dodajemy opis
//           acc[item.NUMER_FV].OPIS_ROZRACHUNKU.push(description);

//           // Porównujemy daty i aktualizujemy na najnowszą (najbliższą dzisiejszej)
//           const currentDataRozliczenia = new Date(acc[item.NUMER_FV].DATA_ROZLICZENIA);
//           if (new Date(DATA_OPERACJI) > newDataRozliczenia && !item.DATA_ROZLICZENIA) {
//             acc[item.NUMER_FV].DATA_ROZLICZENIA = null;
//           } else if (newDataRozliczenia > currentDataRozliczenia) {
//             acc[item.NUMER_FV].DATA_ROZLICZENIA = item.DATA_ROZLICZENIA;
//           }

//           // Sortowanie opisów według daty
//           acc[item.NUMER_FV].OPIS_ROZRACHUNKU.sort((a, b) => {
//             const dateA = new Date(a.split(' - ')[0]);
//             const dateB = new Date(b.split(' - ')[0]);
//             return dateB - dateA;
//           });
//         }

//         return acc;
//       }, {})
//     );
//     return updatedSettlements;
//   }
//   catch (error) {
//     logEvents(`getDataFromMSSQL, updateSettlementDescriptionKEM: ${error}`, "reqServerErrors.txt");
//   }
// };

// aktualizacja opisów rozrachunków
// const updateSettlementDescription = async (companies) => {
const updateSettlementDescription = async () => {
  const companies = ["KRT", "KEM"];
  const allData = await Promise.all(
    companies.map((company) => updateSettlementDescriptionCompany(company))
  );

  // const allData = await Promise.all(
  //   companies.map((company) => {
  //     if (company === "RAC") {
  //       // dla RAC nic nie robimy, zwracamy pustą tablicę
  //       return [];
  //     }
  //     return updateSettlementDescriptionCompany(company);
  //   })
  // );

  // Sprawdzenie czy wszystkie wyniki są prawidłowe (czy nie ma np. null lub undefined)
  const isValid = allData.every(
    (data) => Array.isArray(data) && data.length >= 0
  );

  if (!isValid) {
    return false;
  }

  // Łączenie wszystkich danych w jedną tablicę
  const updatedSettlements = allData.flat();

  try {
    //dodawanie do mysql dużych pakietów danych, podzielonych na części
    const batchInsert = async (connection, data, batchSize = 1000) => {
      for (let i = 0; i < data.length; i += batchSize) {
        const batch = data.slice(i, i + batchSize);

        const values = batch.map((item) => [
          item.COMPANY,
          item.NUMER_FV,
          JSON.stringify(item.OPIS_ROZRACHUNKU),
          item.DATA_ROZLICZENIA,
        ]);

        const query = `
          INSERT IGNORE INTO company_settlements_description 
            (COMPANY, NUMER, OPIS_ROZRACHUNKU, DATA_ROZL_AS) 
          VALUES 
            ${values.map(() => "(?, ?, ?, ?)").join(", ")}
        `;

        await connection.query(query, values.flat());
      }
    };

    try {
      await connect_SQL.query("TRUNCATE TABLE company_settlements_description");
      await batchInsert(connect_SQL, updatedSettlements);
    } catch (error) {
      logEvents(
        `getDataFromMSSQL, updateSettlementDescription, addMany settlements description: ${error}`,
        "reqServerErrors.txt"
      );
    }
    return true;
  } catch (error) {
    logEvents(
      `getDataFromMSSQL, updateSettlementDescription: ${error}`,
      "reqServerErrors.txt"
    );
    return false;
  }
};

//uruchamiam po kolei aktualizację faktur dla KRT, KEM, RAC
const updateDocuments = async (companies) => {
  try {
    // const resultKRT = await addDocumentToDatabase("KRT");
    // const resultKEM = await addDocumentToDatabase("KEM");
    // const resultRAC = await addDocumentToDatabase("RAC");

    // const success = resultKRT && resultKEM && resultRAC;

    const results = await Promise.all(
      companies.map((company) => addDocumentToDatabase(company))
    );

    const success = results.every((result) => result);

    connect_SQL.query(
      "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        success ? "Zaktualizowano." : "Błąd aktualizacji",
        "Faktury",
      ]
    );
  } catch (error) {
    logEvents(
      `getDataFromMSSQL - updateCarReleaseDates (KRT/KEM): ${error}`,
      "reqServerErrors.txt"
    );
  }
};

//wykonuje po kolei aktualizację danych i zapisuje daty i statusy
const updateData = async () => {
  // wylogowanie wszytskich użytkowników
  await connect_SQL.query("UPDATE company_users SET refreshToken = null");

  // const companies = ["RAC"];
  const companies = ["KRT", "KEM", "RAC"];

  try {
    const [getUpdatesData] = await connect_SQL.query(
      "SELECT DATA_NAME, DATE, HOUR, UPDATE_SUCCESS FROM company_updates"
    );

    const filteredUpdatesData = getUpdatesData.filter(
      (item) =>
        item.DATA_NAME !== "Rubicon" &&
        item.DATA_NAME !== "BeCared" &&
        item.DATA_NAME !== "Dokumenty Raportu FK - KRT" &&
        item.DATA_NAME !== "Dokumenty Raportu FK - KEM" &&
        item.DATA_NAME !== "Dokumenty Raportu FK - RAC"
    );

    const updateProgress = filteredUpdatesData.map((item) => {
      return {
        ...item,
        DATE: "",
        HOUR: "",
        UPDATE_SUCCESS: "Trwa aktualizacja ...",
      };
    });
    for (const item of updateProgress) {
      const queryUpdate = `
      UPDATE company_updates
      SET
      DATA_NAME = '${item.DATA_NAME}',
      DATE = '${item.DATE}',
        HOUR = '${item.HOUR}',
        UPDATE_SUCCESS = '${item.UPDATE_SUCCESS}'
      WHERE
        DATA_NAME = '${item.DATA_NAME}'
    `;
      await connect_SQL.query(queryUpdate);
    }

    // // dodanie faktur do DB
    updateDocuments(companies);

    // dodanie faktur zaliczkowych
    updateDocZal(companies);

    // dodanie dat wydania samochodów
    updateCarReleaseDates(companies)
      .then((result) => {
        connect_SQL.query(
          "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
          [
            checkDate(new Date()),
            checkTime(new Date()),
            result ? "Zaktualizowano." : "Błąd aktualizacji",
            "Wydania samochodów",
          ]
        );
      })
      .catch((error) => {
        logEvents(
          `getDataFromMSSQL - updateCarReleaseDates, getData: ${error}`,
          "reqServerErrors.txt"
        );
      });

    // aktualizacja rozrachunków
    updateSettlements(companies)
      .then((result) => {
        connect_SQL.query(
          "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
          [
            checkDate(new Date()),
            checkTime(new Date()),
            result ? "Zaktualizowano." : "Błąd aktualizacji",
            "Rozrachunki",
          ]
        );
      })
      .catch((error) => {
        logEvents(
          `getDataFromMSSQL - updateSettlements, getData: ${error}`,
          "reqServerErrors.txt"
        );
      });

    // aktualizacja rozliczeń Symfonia
    updateFKSettlements(companies)
      .then((result) => {
        connect_SQL.query(
          "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
          [
            checkDate(new Date()),
            checkTime(new Date()),
            result ? "Zaktualizowano." : "Błąd aktualizacji",
            "Rozliczenia Symfonia",
          ]
        );
      })
      .catch((error) => {
        logEvents(
          `getDataFromMSSQL - updateSettlements, getData: ${error}`,
          "reqServerErrors.txt"
        );
      });

    // aktualizacja opisu rozrachunków
    updateSettlementDescription(companies)
      .then((result) => {
        connect_SQL.query(
          "UPDATE company_updates SET DATE = ?, HOUR = ?, UPDATE_SUCCESS = ? WHERE DATA_NAME = ?",
          [
            checkDate(new Date()),
            checkTime(new Date()),
            result ? "Zaktualizowano." : "Błąd aktualizacji",
            "Opisy rozrachunków",
          ]
        );
      })
      .catch((error) => {
        logEvents(
          `getDataFromMSSQL - updateSettlementDescription, getData: ${error}`,
          "reqServerErrors.txt"
        );
      });
  } catch (error) {
    logEvents(`getDataFromMSSQL , getData: ${error}`, "reqServerErrors.txt");
  }
};

cron.schedule("30 06 * * *", updateData, {
  timezone: "Europe/Warsaw",
});

module.exports = {
  updateData,
  updateDocuments,
  updateSettlementDescription,
  addDocumentToDatabase,
  updateDocZal,
  updateCarReleaseDates,
  updateSettlements,
  updateSettlementDescriptionCompany,
};
