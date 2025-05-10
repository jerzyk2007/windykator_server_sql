const { logEvents } = require("../middleware/logEvents");
const { getDataDocuments } = require("./documentsController");
const { connect_SQL } = require("../config/dbConn");
const ExcelJS = require('exceljs');
const path = require('path');

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
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
const getExcelRaport = async (data) => {
  if (!Array.isArray(data) || data.length === 0) {
    console.error('Tablica danych jest pusta lub niepoprawna');
    return;
  }

  const workbook = new ExcelJS.Workbook();
  const worksheet = workbook.addWorksheet('Dane');

  // Nagłówki
  const headers = Object.keys(data[0]);
  worksheet.columns = headers.map((key) => ({
    header: key,
    key: key,
    width: 20,
  }));

  // Dodanie danych
  data.forEach(item => worksheet.addRow(item));

  // Dodanie filtrowania do pierwszego wiersza
  worksheet.autoFilter = {
    from: {
      row: 1,
      column: 1,
    },
    to: {
      row: 1,
      column: headers.length,
    },
  };

  // Zablokowanie pierwszego wiersza (nagłówków)
  worksheet.views = [
    {
      state: 'frozen',
      ySplit: 1,
    },
  ];

  // Dodanie obramowania do wszystkich komórek z danymi
  worksheet.eachRow((row, rowNumber) => {
    row.eachCell((cell) => {
      cell.border = {
        top: { style: 'thin' },
        left: { style: 'thin' },
        bottom: { style: 'thin' },
        right: { style: 'thin' },
      };
    });
  });

  // Zapis do bufora
  const buffer = await workbook.xlsx.writeBuffer();
  return buffer;
};


// pobiera dane do raportu z obszarów
const getRaportArea = async (req, res) => {

  const { raportData } = req.body;

  try {

    const query = `SELECT  
     C_D.NUMER_FV, 
  C_D.DATA_FV, 
  C_D.TERMIN, 
  ROUND(C_D.BRUTTO, 2) AS BRUTTO, 
  ROUND(IFNULL(C_S.NALEZNOSC, 0), 2) AS NALEZNOSC, 
  C_D.KONTRAHENT, 
  C_D.NIP, 
  C_S_D.DATA_ROZL_AS, 
  C_J_I.AREA, 
  DATEDIFF(NOW(), C_D.TERMIN) AS ILE_DNI_PO_TERMINIE, 
  CASE 
    WHEN C_R_D_H.NUMER_FV IS NOT NULL THEN 'TAK'
    ELSE 'NIE'
  END AS CZY_PRZEKAZANO_DO_WP, 
  DATEDIFF(C_D.TERMIN, C_D.DATA_FV) AS ILE_DNI_NA_PLATNOSC, 
  C_D.TYP_PLATNOSCI, 
  DATEDIFF(C_S_D.DATA_ROZL_AS, C_D.TERMIN) AS PLATNOSC_PO_TERMINIE,
  C_D.TYP_PLATNOSCI, 
  C_D.DZIAL
FROM 
  company_documents AS C_D
LEFT JOIN company_join_items AS C_J_I 
  ON C_D.DZIAL = C_J_I.DEPARTMENT
LEFT JOIN company_rubicon_data_history AS C_R_D_H 
  ON C_D.NUMER_FV = C_R_D_H.NUMER_FV
LEFT JOIN company_settlements AS C_S 
  ON C_D.NUMER_FV = C_S.NUMER_FV 
LEFT JOIN company_settlements_description AS C_S_D 
  ON C_S_D.NUMER = C_D.NUMER_FV 
WHERE 
  C_D.FIRMA = 'KRT'
  AND C_D.DATA_FV BETWEEN ? AND ?
  AND (C_J_I.AREA IN (?) OR C_J_I.AREA IS NULL)
`;


    //     const query = `SELECT C_D.NUMER_FV, C_D.DATA_FV, C_D.TERMIN, ROUND(C_D.BRUTTO, 2) AS BRUTTO,;
    // ROUND(IFNULL(C_S.NALEZNOSC, 0), 2) AS NALEZNOSC, C_D.KONTRAHENT, C_D.NIP, C_S_D.DATA_ROZL_AS, C_J_I.AREA, 
    // datediff(NOW(), C_D.TERMIN) AS ILE_DNI_PO_TERMINIE, 
    // CASE 
    //   WHEN C_R_D_H.NUMER_FV IS NOT NULL THEN 'TAK'
    //   ELSE 'NIE'
    // END AS CZY_PRZEKAZANO_DO_WP, 
    // datediff(C_D.TERMIN, C_D.DATA_FV ) AS ILE_DNI_NA_PLATNOSC, C_D.TYP_PLATNOSCI, datediff( C_S_D.DATA_ROZL_AS, C_D.TERMIN) AS PLATNOSC_PO_TERMINIE,
    // C_D.TYP_PLATNOSCI, C_D.DZIAL
    // FROM company_documents AS C_D
    // LEFT JOIN company_join_items AS C_J_I ON C_D.DZIAL = C_J_I.DEPARTMENT
    // LEFT JOIN company_rubicon_data_history AS C_R_D_H ON C_D.NUMER_FV = C_R_D_H.NUMER_FV
    // LEFT JOIN company_settlements AS C_S ON C_D.NUMER_FV = C_S.NUMER_FV AND C_D.FIRMA = C_S.COMPANY
    // JOIN company_settlements_description AS C_S_D 
    //   ON C_S_D.NUMER = C_D.NUMER_FV AND C_S_D.COMPANY = C_D.FIRMA
    // WHERE C_D.FIRMA IN (?)
    //   AND C_D.DATA_FV BETWEEN ? AND ?
    //   AND C_J_I.AREA IN (?)`;


    const [result] = await connect_SQL.query(query, [
      raportData.docDateFrom, raportData.docDateTo, raportData.areas]);

    const convertToDateIfPossible = (value, addDays = 0) => {
      const datePattern = /^\d{4}-\d{2}-\d{2}$/;

      if (typeof value === 'string' && datePattern.test(value)) {
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

    const filteredData = result.map(item => {

      return {
        ...item,
        NUMER_FV: item.NUMER_FV,
        DATA_FV: convertToDateIfPossible(item.DATA_FV),
        TERMIN: convertToDateIfPossible(item.TERMIN),
        TERMIN_8: convertToDateIfPossible(item.TERMIN, 8),
        BRUTTO: item.BRUTTO,
        NALEZNOSC: item.NALEZNOSC,
        KONTRAHENT: item.KONTRAHENT,
        NIP: item?.NIP ? item.NIP : " ",
        DATA_ROZL_AS: convertToDateIfPossible(item.DATA_ROZL_AS),
        AREA: item.AREA,
        ILE_DNI_PO_TERMINIE: item.NALEZNOSC !== 0 ? item.ILE_DNI_PO_TERMINIE : 0,
        CZY_PRZEKAZANO_DO_WP: item.CZY_PRZEKAZANO_DO_WP,
        ILE_DNI_NA_PLATNOSC: item.ILE_DNI_NA_PLATNOSC,
        TYP_PLATNOSCI: item?.TYP_PLATNOSCI ? item.TYP_PLATNOSCI : " ",
        CZY_FV_ROZLICZONA: item.NALEZNOSC === 0 ? "NIE" : "TAK",
        PLATNOSC_PO_TERMINIE: item?.PLATNOSC_PO_TERMINIE ? item.PLATNOSC_PO_TERMINIE : " ",
        CZY_FV_ROZLICZONA: item.NALEZNOSC === 0 ? "TAK" : "NIE"
      };
    });


    const excelBuffer = await getExcelRaport(filteredData);

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', 'attachment; filename=raport.xlsx');
    res.send(excelBuffer);
    // res.end();
  }
  catch (error) {
    logEvents(
      `raportsController, getRaportArea: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getDataRaport,
  getRaportArea
};
