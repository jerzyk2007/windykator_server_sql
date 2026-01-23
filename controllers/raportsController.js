const { logEvents } = require("../middleware/logEvents");
const { getDataDocuments } = require("./documentsController");
const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { differencesAsFk } = require("./generate_excel_raport/differencesAsFk");
const {
  organizationStructure,
} = require("./generate_excel_raport/organizationStructure");
const {
  documentsControlBL,
} = require("./generate_excel_raport/documentsControlBL");
const { lawStatement } = require("./generate_excel_raport/lawStatement");
const { documentsType } = require("./manageDocumentAddition");

// pobiera dane do tabeli Raportu w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getDataRaport = async (req, res) => {
  const { id_user, profile } = req.params;
  try {
    const result = await getDataDocuments(id_user, "actual", profile);
    res.json({ data: result.data });
  } catch (error) {
    logEvents(
      `raportsController, getDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

//generuje plik excel
// const getExcelRaport = async (data) => {
//   if (!Array.isArray(data) || data.length === 0) {
//     console.error("Tablica danych jest pusta lub niepoprawna");
//     return;
//   }

//   const workbook = new ExcelJS.Workbook();
//   const worksheet = workbook.addWorksheet("Dane");

//   // Nagłówki
//   const headers = Object.keys(data[0]);
//   worksheet.columns = headers.map((key) => ({
//     header: key,
//     key: key,
//     width: 20,
//   }));

//   // Dodanie danych
//   data.forEach((item) => worksheet.addRow(item));

//   // Dodanie filtrowania do pierwszego wiersza
//   worksheet.autoFilter = {
//     from: {
//       row: 1,
//       column: 1,
//     },
//     to: {
//       row: 1,
//       column: headers.length,
//     },
//   };

//   // Zablokowanie pierwszego wiersza (nagłówków)
//   worksheet.views = [
//     {
//       state: "frozen",
//       ySplit: 1,
//     },
//   ];

//   // Dodanie obramowania do wszystkich komórek z danymi
//   worksheet.eachRow((row, rowNumber) => {
//     row.eachCell((cell) => {
//       cell.border = {
//         top: { style: "thin" },
//         left: { style: "thin" },
//         bottom: { style: "thin" },
//         right: { style: "thin" },
//       };
//     });
//   });

//   // Zapis do bufora
//   const buffer = await workbook.xlsx.writeBuffer();
//   return buffer;
// };

// nowy zrobiony na chwile dla Marty
const getRaportArea = async (req, res) => {
  try {
    const query = `
SELECT CD.NUMER_FV, CDA.NUMER_SPRAWY_BECARED, CD.BRUTTO, CD.NR_REJESTRACYJNY, CD.NR_SZKODY, IFNULL(CS.NALEZNOSC, 0) AS FV_NALEZNOSC, CSD.OPIS_ROZRACHUNKU, CSD.DATA_ROZL_AS
FROM company_windykacja.company_documents AS CD
LEFT JOIN company_windykacja.company_join_items AS CJI ON CD.DZIAL = CJI.DEPARTMENT
LEFT JOIN company_windykacja.company_settlements_description AS CSD ON CD.NUMER_FV = CSD.NUMER
LEFT JOIN company_windykacja.company_settlements AS CS ON CD.NUMER_FV = CS.NUMER_FV
LEFT JOIN company_documents_actions AS CDA ON CD.id_document = CDA.document_id 
WHERE CJI.AREA = "BLACHARNIA" AND DATA_ROZL_AS >= '2025-01-01' AND CD.DATA_FV < '2024-01-01' AND CD.NUMER_FV LIKE 'FV%' AND CDA.NUMER_SPRAWY_BECARED IS NOT NULL
`;

    const [result] = await connect_SQL.query(query);

    const convertToDateIfPossible = (value, addDays = 0) => {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (typeof value === "string" && datePattern.test(value)) {
        const date = new Date(value);
        if (!isNaN(date.getTime())) {
          // Dodaj dni jeśli podano
          date.setDate(date.getDate() + addDays);
          return date;
        }
      }

      // Zwróć "BRAK", jeśli niepoprawna data
      return "BRAK";
    };

    const filteredData = result.map((item) => {
      return {
        ...item,
        FV_NALEZNOSC: item.FV_NALEZNOSC ? item.FV_NALEZNOSC : 0,
        OPIS_ROZRACHUNKU: Array.isArray(item.OPIS_ROZRACHUNKU)
          ? item.OPIS_ROZRACHUNKU.join("\n\n")
          : "NULL",
        DATA_ROZL_AS: convertToDateIfPossible(item.DATA_ROZL_AS),
      };
    });

    // const excelBuffer = await generateExcelRaport(filteredData);

    // res.setHeader(
    //   "Content-Type",
    //   "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    // );
    // res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    // res.send(excelBuffer);
    // res.end();
  } catch (error) {
    logEvents(
      `raportsController, getRaportArea: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera dane struktury orgaznizacji
const getStructureOrganization = async (req, res) => {
  try {
    const [data] = await connect_SQL.query(
      "SELECT * FROM company_join_items ORDER BY department"
    );
    const findMail = await Promise.all(
      data.map(async (item) => {
        const ownerMail = await Promise.all(
          item.OWNER.map(async (own) => {
            const [mail] = await connect_SQL.query(
              `SELECT OWNER_MAIL FROM company_owner_items WHERE owner = ?`,
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

    const [accounts] = await connect_SQL.query(
      "SELECT username, usersurname, userlogin, departments, permissions FROM company_users"
    );

    // const filteredDeps = accounts.map((item) => {
    //   return {
    //     ...item,
    //     departments: item.departments.map(
    //       (acc) => `${acc.department}-${acc.company}`
    //     ),
    //   };
    // });

    const structure = findMail.map(({ id_join_items, ...rest }) => rest);
    const structureData = structure.map((item) => {
      return {
        area: item.AREA,
        company: item.COMPANY,
        department: item.DEPARTMENT,
        localization: item.LOCALIZATION,
        owner: Array.isArray(item.OWNER) ? item.OWNER.join("\n") : item.OWNER,
        guardian: Array.isArray(item.GUARDIAN)
          ? item.GUARDIAN.join("\n")
          : item.GUARDIAN,
        mail: Array.isArray(item.MAIL) ? item.MAIL.join("\n") : item.MAIL,
      };
    });

    const accountsData = accounts.map((item) => {
      return {
        usersurname: item.usersurname,
        username: item.username,
        userlogin: item.userlogin,
        departments: Array.isArray(item.departments[item.permissions])
          ? item.departments[item.permissions]
              .map((d) => `${d.department}-${d.company}`)
              .join(", ")
          : item.departments[item.permissions],
      };
    });

    const sortedAccountsData = accountsData.sort((a, b) => {
      // Porównaj 'usersurname' w obu obiektach
      if (a.usersurname < b.usersurname) {
        return -1; // Jeśli a jest mniejsze niż b, a pojawi się wcześniej
      }
      if (a.usersurname > b.usersurname) {
        return 1; // Jeśli a jest większe niż b, b pojawi się wcześniej
      }
      return 0; // Jeśli są równe, pozostaw porządek bez zmian
    });

    const addObject = [
      { name: "struktura", data: structureData },
      { name: "konta", data: sortedAccountsData },
    ];

    const excelBuffer = await organizationStructure(addObject);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    res.send(excelBuffer);
    res.end();
  } catch (error) {
    logEvents(
      `raportsController, getStructureOrganization: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const getRaportDocumentsControlBL = async (req, res) => {
  try {
    const refreshToken = req.cookies.jwt;

    const [findUser] = await connect_SQL.query(
      "SELECT  permissions, username, usersurname, departments FROM company_users WHERE refreshToken = ?",
      [refreshToken]
    );
    const { departments = [], permissions = "" } = findUser[0] || {};

    // dopisuje do zapytania dostęp tylko do działow zadeklarowanych
    const sqlCondition =
      departments[permissions]?.length > 0
        ? `(${departments[permissions]
            .map(
              (dep) =>
                `D.DZIAL = '${dep.department}' AND D.FIRMA ='${dep.company}' `
            )
            .join(" OR ")})`
        : null;

    const [dataReport] = await connect_SQL.query(
      `SELECT CD.*, D.NUMER_FV,  D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, D.DORADCA, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM company_documents AS D LEFT JOIN company_settlements as S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_control_documents AS CD ON D.NUMER_FV = CD.NUMER_FV LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department LEFT JOIN company_rubicon_data AS R ON R.NUMER_FV = D.NUMER_FV WHERE JI.AREA = 'BLACHARNIA' AND S.NALEZNOSC > 0 AND DA.JAKA_KANCELARIA_TU IS NULL AND R.FIRMA_ZEWNETRZNA IS NULL AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND (DA.DZIALANIA != 'WINDYKACJA WEWNĘTRZNA' OR DA.DZIALANIA IS NULL) AND  ${sqlCondition}`
    );
    const cleanedData = dataReport.map(
      ({ id_control_documents, ...rest }) => rest
    );
    const filteredData = cleanedData.map((item) => {
      // const uwagi =
      //   Array.isArray(item.KANAL_KOMUNIKACJI) && item?.KANAL_KOMUNIKACJI?.length
      //     ? item.KANAL_KOMUNIKACJI.length === 1
      //       ? item.KANAL_KOMUNIKACJI[0]
      //       : `Ilość poprzednich wpisów - ${
      //           item.KANAL_KOMUNIKACJI.length - 1
      //         }\n\n${item.KANAL_KOMUNIKACJI[item.KANAL_KOMUNIKACJI.length - 1]}`
      //     : " ";

      const formatEntry = ({ date, username, note }) =>
        [date, username, note].filter(Boolean).join(" - ");

      const uwagi =
        Array.isArray(item.KANAL_KOMUNIKACJI) && item.KANAL_KOMUNIKACJI.length
          ? item.KANAL_KOMUNIKACJI.length === 1
            ? formatEntry(item.KANAL_KOMUNIKACJI[0])
            : `Ilość poprzednich wpisów - ${
                item.KANAL_KOMUNIKACJI.length - 1
              }\n\n${formatEntry(
                item.KANAL_KOMUNIKACJI[item.KANAL_KOMUNIKACJI.length - 1]
              )}`
          : " ";

      return {
        BRUTTO: item.BRUTTO ? item.BRUTTO : 0,
        CONTROL_DOW_REJ: item.CONTROL_DOW_REJ ? item.CONTROL_DOW_REJ : " ",
        CONTROL_DECYZJA: item.CONTROL_DECYZJA ? item.CONTROL_DECYZJA : " ",
        CONTROL_FV: item.CONTROL_FV ? item.CONTROL_FV : " ",
        CONTROL_ODPOWIEDZIALNOSC: item.CONTROL_ODPOWIEDZIALNOSC
          ? item.CONTROL_ODPOWIEDZIALNOSC
          : " ",
        CONTROL_PLATNOSC_VAT: item.CONTROL_PLATNOSC_VAT
          ? item.CONTROL_PLATNOSC_VAT
          : " ",
        CONTROL_POLISA: item.CONTROL_POLISA ? item.CONTROL_POLISA : " ",
        CONTROL_PR_JAZ: item.CONTROL_PR_JAZ ? item.CONTROL_PR_JAZ : " ",
        CONTROL_UPOW: item.CONTROL_UPOW ? item.CONTROL_UPOW : " ",
        KANAL_KOMUNIKACJI: uwagi,
        CONTROL_BRAK_DZIALAN_OD_OST: item.CONTROL_BRAK_DZIALAN_OD_OST
          ? item.CONTROL_BRAK_DZIALAN_OD_OST
          : " ",
        DZIAL: item.DZIAL ? item.DZIAL : " ",
        ILE_DNI_NA_PLATNOSC: item.ILE_DNI_NA_PLATNOSC
          ? item.ILE_DNI_NA_PLATNOSC
          : " ",
        ILE_DNI_PO_TERMINIE: item.ILE_DNI_PO_TERMINIE
          ? item.ILE_DNI_PO_TERMINIE
          : " ",
        KONTRAHENT: item.KONTRAHENT ? item.KONTRAHENT : " ",
        DORADCA: item.DORADCA ? item.DORADCA : " ",
        NALEZNOSC: item.NALEZNOSC ? item.NALEZNOSC : 0,
        NUMER_FV: item.NUMER_FV ? item.NUMER_FV : " ",
        NR_SZKODY: item.NR_SZKODY ? item.NR_SZKODY : " ",
      };
    });

    const resultArray = filteredData.reduce((acc, item) => {
      let area = item.DZIAL; // Pobieramy wartość DZIAL z obiektu

      // Zamieniamy wszystkie '/' na '-'
      area = area.replace(/\//g, "-"); // Zastępujemy '/' myślnikiem

      // Sprawdzamy, czy już mamy obiekt z takim DZIAL w wynikowej tablicy
      const existingGroup = acc.find((group) => group.name === area);

      if (existingGroup) {
        // Jeśli grupa już istnieje, dodajemy obiekt do tej grupy
        existingGroup.data.push(item);
      } else {
        // Jeśli grupa nie istnieje, tworzymy nową z danym DZIAL
        acc.push({ name: area, data: [item] });
      }

      return acc;
    }, []);

    const addObject = [
      { name: "Blacharnie", data: filteredData },
      ...resultArray,
    ];
    // const sortedData = addObject.sort((a, b) => a.name.localeCompare(b.name));
    const sortedData = addObject
      .map((item) => ({
        ...item,
        data: item.data.sort(
          (a, b) => a.ILE_DNI_PO_TERMINIE - b.ILE_DNI_PO_TERMINIE
        ),
      }))
      .sort((a, b) => a.name.localeCompare(b.name));

    const excelBuffer = await documentsControlBL(sortedData);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    res.send(excelBuffer);
    res.end();
  } catch (error) {
    logEvents(
      `raportsController, getRaportDocumentsControlBL: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

// szukam poprzedniego dnia roboczego w poniedziałek dszukam piątku, w piątek czwartku itd
const getPreviousBusinessDayString = () => {
  const today = new Date();
  const day = today.getDay();
  const result = new Date(today);

  switch (day) {
    case 1: // poniedziałek → piątek
      result.setDate(today.getDate() - 3);
      break;
    case 0: // niedziela → piątek
      result.setDate(today.getDate() - 2);
      break;
    case 6: // sobota → piątek
      result.setDate(today.getDate() - 1);
      break;
    default: // pozostałe dni → poprzedni dzień
      result.setDate(today.getDate() - 1);
  }

  // Zwracamy czysty string YYYY-MM-DD
  return result.toISOString().split("T")[0];
};

// const getRaportDifferncesAsFkAnia_Julia = (docData) => {
//   const filteredData = docData
//     ?.filter((doc) => documentsType(doc.NUMER_FV) === "Faktura")
//     .map((doc) => {
//       // if (doc.DO_ROZLICZENIA > 0 && doc.FK_DO_ROZLICZENIA === 0) {
//       if (doc.DO_ROZLICZENIA > 0) {
//         return {
//           NUMER_FV: doc.NUMER_FV,
//           DATA_FV: doc.DATA_FV,
//           TERMIN: doc.TERMIN,
//           BRUTTO: doc.BRUTTO,
//           KONTR: doc.KONTRAHENT,
//           AS_DO_ROZLICZENIA: doc.DO_ROZLICZENIA,
//           FK_DO_ROZLICZENIA: doc.FK_DO_ROZLICZENIA,
//           DZIAL: doc.DZIAL,
//           AREA: doc.AREA,
//           COMPANY: doc.FIRMA,
//         };
//       }
//     })
//     .filter(Boolean);

//   // --- krok 1: sprawdź unikalne wartości ---
//   const uniqueDZIAL = [...new Set(filteredData.map((d) => d.DZIAL))];
//   const uniqueAREA = [...new Set(filteredData.map((d) => d.AREA))];
//   const uniqueCOMPANY = [...new Set(filteredData.map((d) => d.COMPANY))];

//   // --- krok 2: usuń klucze, które mają tylko jedną unikalną wartość ---
//   const finalData = filteredData.map((d) => {
//     const obj = { ...d };
//     if (uniqueDZIAL.length === 1) delete obj.DZIAL;
//     if (uniqueAREA.length === 1) delete obj.AREA;
//     if (uniqueCOMPANY.length === 1) delete obj.COMPANY;
//     return obj;
//   });
//   return finalData;
// };

const getRaportDifferncesAsFk = async (req, res) => {
  const { id_user, profile } = req.params;
  try {
    const documents = await getDataDocuments(id_user, "different", profile);
    const prevBusinessDayStr = getPreviousBusinessDayString();
    const rawData = documents?.data || [];

    const prepareData = (data) => {
      if (!data || data.length === 0) return [];

      const mapped = data.map((doc) => ({
        NUMER_FV: doc.NUMER_FV,
        DATA_FV: doc.DATA_FV,
        TERMIN: doc.TERMIN,
        BRUTTO: doc.BRUTTO,
        KONTR: doc.KONTRAHENT,
        AS_DO_ROZLICZENIA: doc.DO_ROZLICZENIA,
        FK_DO_ROZLICZENIA: doc.FK_DO_ROZLICZENIA,
        DZIAL: doc.DZIAL,
        AREA: doc.AREA,
        COMPANY: doc.FIRMA,
      }));

      const uniqueDZIAL = [...new Set(mapped.map((d) => d.DZIAL))];
      const uniqueAREA = [...new Set(mapped.map((d) => d.AREA))];
      const uniqueCOMPANY = [...new Set(mapped.map((d) => d.COMPANY))];

      return mapped.map((d) => {
        const obj = { ...d };
        if (uniqueDZIAL.length === 1) delete obj.DZIAL;
        if (uniqueAREA.length === 1) delete obj.AREA;
        if (uniqueCOMPANY.length === 1) delete obj.COMPANY;
        return obj;
      });
    };

    // --- GRUPA 1: AS = 0 (Rozliczone w AS, ale w FK jeszcze wisi) ---
    const dataAsZero = rawData.filter((doc) => {
      return (
        documentsType(doc.NUMER_FV) === "Faktura" &&
        doc.DATA_FV < prevBusinessDayStr &&
        doc.FK_DO_ROZLICZENIA > 0 &&
        doc.DO_ROZLICZENIA === 0
      );
    });

    // --- GRUPA 2: FK = 0 (Rozliczone w FK, ale w AS jeszcze wisi) ---
    const dataFkZero = rawData.filter((doc) => {
      return (
        documentsType(doc.NUMER_FV) === "Faktura" &&
        doc.DATA_FV < prevBusinessDayStr &&
        doc.DO_ROZLICZENIA > 0 &&
        doc.FK_DO_ROZLICZENIA === 0
      );
    });

    // --- GRUPA 3: Różnice (Wszystkie niezgodności, ale bez obustronnych zer) ---
    const dataDifferences = rawData.filter((doc) => {
      return (
        documentsType(doc.NUMER_FV) === "Faktura" &&
        doc.DATA_FV < prevBusinessDayStr &&
        // Warunek: oba muszą być różne od zera
        doc.DO_ROZLICZENIA !== 0 &&
        doc.FK_DO_ROZLICZENIA !== 0
      );
    });

    const noFiltres = rawData.filter((doc) => {
      return (
        documentsType(doc.NUMER_FV) === "Faktura" &&
        doc.DATA_FV < prevBusinessDayStr
      );
    });

    const cleanData = [
      { name: "AS = 0", data: prepareData(dataAsZero) },
      { name: "FK = 0", data: prepareData(dataFkZero) },
      { name: "Różnice", data: prepareData(dataDifferences) },
      { name: "Brak filtrów", data: prepareData(noFiltres) },
    ];

    const excelBuffer = await differencesAsFk(cleanData);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    res.send(excelBuffer);
    res.end();
  } catch (error) {
    logEvents(`documentsController: ${error}`, "reqServerErrors.txt");
    return res.status(500).json({ error: "Błąd serwera" });
  }
};

const getRaportLawStatement = async (req, res) => {
  try {
    // 1. wyczyszczenie tabeli
    await msSqlQuery(`TRUNCATE TABLE [rapdb].[dbo].[fkkomandytowams]`);

    // 2. wstawienie danych
    await msSqlQuery(`
    INSERT INTO [rapdb].[dbo].[fkkomandytowams]
    SELECT DISTINCT 
      GETDATE() AS smf_stan_na_dzien,
      'N' AS smf_typ,
      r.dsymbol AS smf_numer,
      r1.dsymbol,
      r1.kwota AS kwota_platności,
      CAST(r1.data AS date) AS data_platnosci,
      r.kwota AS kwota_faktury,
      CAST(
        CASE WHEN r.strona = 0 THEN r.kwota ELSE r.kwota * (-1) END
        + SUM(ISNULL(CASE WHEN r1.strona = 0 THEN r1.kwota ELSE r1.kwota * (-1) END, 0)) OVER (PARTITION BY r.id)
        AS money
      ) AS naleznosc,
      CAST(r.dataokr AS date) AS smf_data_otwarcia_rozrachunku
    FROM [fkkomandytowa].[FK].[rozrachunki] r
    LEFT JOIN [fkkomandytowa].[FK].[rozrachunki] r1 
      ON r.id = r1.transakcja 
      AND ISNULL(r1.czyrozliczenie, 0) = 1 
      AND ISNULL(r1.dataokr, 0) <= GETDATE()
    WHERE 
      r.czyrozliczenie = 0
      AND CAST(r.dataokr AS date) BETWEEN '2001-01-01' AND GETDATE()
      AND r.dsymbol IN (SELECT faktura FROM [rapdb].[dbo].[faktms]);
  `);

    // 3. pobranie danych (jeśli naprawdę potrzebujesz je wyświetlić)
    const dataFK = await msSqlQuery(`
    SELECT * FROM [rapdb].[dbo].[fkkomandytowams];
  `);

    const excelBuffer = await lawStatement(dataFK);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    res.send(excelBuffer);
    res.end();

    res.end();
  } catch (error) {
    logEvents(
      `raportsController, getRaportLawStatement: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

module.exports = {
  getDataRaport,
  getStructureOrganization,
  getRaportDocumentsControlBL,
  getRaportDifferncesAsFk,
  getRaportLawStatement,
};
