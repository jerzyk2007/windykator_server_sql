const { logEvents } = require("../middleware/logEvents");
const { getDataDocuments } = require("./documentsController");
const { connect_SQL } = require("../config/dbConn");
const { generateExcelRaport } = require("./generateExcelRaport");
// const ExcelJS = require("exceljs");
// const path = require("path");

// pobiera dane do tabeli Raportu w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getDataRaport = async (req, res) => {
  const { id_user } = req.params;
  try {
    const result = await getDataDocuments(id_user, "actual");
    res.json({ data: result.data, permission: result.permission });
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

    console.log(filteredData);
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
      "SELECT username, usersurname, userlogin, departments FROM company_users"
    );
    const filteredDeps = accounts.map((item) => {
      return {
        ...item,
        departments: item.departments.map(
          (acc) => `${acc.department}-${acc.company}`
        ),
      };
    });

    if (data.length && accounts.length) {
      const structure = findMail.map(({ id_join_items, ...rest }) => rest);

      return res.json({ structure, accounts: filteredDeps });
    } else {
      return res.json({ structure: [], accounts: [] });
    }
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

    const { departments = [] } = findUser[0] || {};

    // dopisuje do zapytania dostęp tylko do działow zadeklarowanych
    const sqlCondition =
      departments?.length > 0
        ? `(${departments
            .map(
              (dep) =>
                `D.DZIAL = '${dep.department}' AND D.FIRMA ='${dep.company}' `
            )
            .join(" OR ")})`
        : null;

    const [dataReport] = await connect_SQL.query(
      `SELECT CD.*, D.NUMER_FV,  D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, D.DORADCA, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM company_documents AS D LEFT JOIN company_settlements as S ON D.NUMER_FV = S.NUMER_FV AND D.FIRMA = S.COMPANY LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN company_control_documents AS CD ON D.NUMER_FV = CD.NUMER_FV LEFT JOIN company_join_items AS JI ON D.DZIAL = JI.department LEFT JOIN company_rubicon_data AS R ON R.NUMER_FV = D.NUMER_FV WHERE JI.AREA = 'BLACHARNIA' AND S.NALEZNOSC > 0 AND DA.JAKA_KANCELARIA_TU IS NULL AND R.FIRMA_ZEWNETRZNA IS NULL AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY) AND  ${sqlCondition}`
    );
    if (dataReport.length) {
      const cleanedData = dataReport.map(
        ({ id_control_documents, ...rest }) => rest
      );
      res.json(cleanedData);
    } else {
      res.json([]);
    }
  } catch (error) {
    logEvents(
      `raportsController, getRaportDocumentsControlBL: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

const getRaportDifferncesAsFk = async (req, res) => {
  const { id_user } = req.params;
  try {
    const documents = await getDataDocuments(id_user, "different");
    const filteredData = documents?.data
      ?.map((doc) => {
        if (doc.ROZNICA_AS_FK === "TAK") {
          return {
            NUMER_FV: doc.NUMER_FV,
            DATA_FV: doc.DATA_FV,
            TERMIN: doc.TERMIN,
            BRUTTO: doc.BRUTTO,
            KONTR: doc.KONTRAHENT,
            AS_DO_ROZLICZENIA: doc.DO_ROZLICZENIA,
            FK_DO_ROZLICZENIA: doc.FK_DO_ROZLICZENIA,
            DZIAL: doc.DZIAL,
          };
        }
      })
      .filter(Boolean);

    const excelBuffer = await generateExcelRaport(filteredData);

    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", "attachment; filename=raport.xlsx");
    res.send(excelBuffer);
    res.end();
  } catch (error) {
    logEvents(
      `raportsController, getRaportDifferncesAsFk: ${error}`,
      "reqServerErrors.txt"
    );
  }
};

module.exports = {
  getDataRaport,
  getRaportArea,
  getStructureOrganization,
  getRaportDocumentsControlBL,
  getRaportDifferncesAsFk,
};
