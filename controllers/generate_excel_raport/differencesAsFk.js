const ExcelJS = require("exceljs");
const { logEvents } = require("../../middleware/logEvents");

const columnsOrder = [
  "Faktura",
  "Data wystawienia fv",
  "Termin płatności",
  "Kwota brutto",
  "Kontrahent",
  "Do rozliczenia AS",
  "Do rozliczenia FK",
  "Opis rozrachunku",
  "Data rozliczenia AS",
  "Dział",
  "Obszar",
  "Firma",
];

const columnsName = [
  {
    accessorKey: "NUMER_FV",
    header: "Faktura",
  },
  {
    accessorKey: "DATA_FV",
    header: "Data wystawienia fv",
  },
  {
    accessorKey: "TERMIN",
    header: "Termin płatności",
  },
  {
    accessorKey: "BRUTTO",
    header: "Kwota brutto",
  },
  {
    accessorKey: "KONTR",
    header: "Kontrahent",
  },
  {
    accessorKey: "OPIS_ROZRACHUNKU",
    header: "Opis rozrachunku",
  },
  {
    accessorKey: "AS_DO_ROZLICZENIA",
    header: "Do rozliczenia AS",
  },

  {
    accessorKey: "FK_DO_ROZLICZENIA",
    header: "Do rozliczenia FK",
  },
  {
    accessorKey: "DATA_ROZL_AS",
    header: "Data rozliczenia AS",
  },
  {
    accessorKey: "DZIAL",
    header: "Dział",
  },
  {
    accessorKey: "AREA",
    header: "Obszar",
  },
  {
    accessorKey: "COMPANY",
    header: "Firma",
  },
];

const differencesAsFk = async (cleanData) => {
  const startRow = 2;

  try {
    const changeNameColumns = cleanData.map((doc) => {
      const update = doc.data.map((item) => {
        const newItem = {};
        for (const column of columnsName) {
          if (item[column.accessorKey] !== undefined) {
            newItem[column.header] = item[column.accessorKey];
          } else {
            newItem[column.accessorKey] = item[column.accessorKey];
          }
        }

        // Zamiana pustych wartości 'Należność' na 0
        if (
          "Należność" in newItem &&
          (newItem["Należność"] === null ||
            newItem["Należność"] === undefined ||
            newItem["Należność"] === "")
        ) {
          newItem["Należność"] = 0;
        }

        return newItem;
      });

      return {
        name: doc.name,
        data: update,
      };
    });

    const workbook = new ExcelJS.Workbook();

    changeNameColumns.forEach((sheet) => {
      const worksheet = workbook.addWorksheet(sheet.name);

      if (sheet.data && sheet.data.length > 0) {
        // Dodanie pustych wierszy nad nagłówkiem
        for (let i = 0; i < startRow - 1; i++) {
          worksheet.addRow([]);
        }

        const headers = columnsOrder.filter((column) =>
          sheet.data[0].hasOwnProperty(column)
        );

        // Dodanie wiersza nagłówków
        worksheet.addRow(["Lp", ...headers]);

        // 🔽 Sortowanie malejąco po kolumnie "Do rozliczenia AS"
        sheet.data.sort((a, b) => {
          const valA = parseFloat(a["Do rozliczenia AS"]) || 0;
          const valB = parseFloat(b["Do rozliczenia AS"]) || 0;
          return valB - valA; // malejąco
        });
        // 🔼

        // Dodanie danych
        sheet.data.forEach((row, index) => {
          const rowData = [
            index + 1,
            ...headers.map((header) => row[header] ?? ""),
          ];
          worksheet.addRow(rowData);
        });

        // Formatowanie nagłówków
        const headerRow = worksheet.getRow(startRow);
        headerRow.font = { bold: true, size: 10 };
        headerRow.alignment = {
          horizontal: "center",
          vertical: "middle",
          wrapText: true,
        };
        headerRow.eachCell((cell) => {
          cell.font = { bold: true, size: 10 };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "cacaca" },
          };
        });

        const lpColumn = worksheet.getColumn(1);
        lpColumn.width = 10;
        lpColumn.alignment = { horizontal: "center", vertical: "middle" };

        headers.forEach((header, columnIndex) => {
          const column = worksheet.getColumn(columnIndex + 2);
          const headerCell = worksheet.getCell(startRow, columnIndex + 2);
          headerCell.font = { bold: true };
          headerCell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };

          const excelStartRow = startRow + 1;
          const excelEndRow = worksheet.rowCount;

          column.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          column.width = header === "Kontrahent" ? 40 : 25;

          const extraCellBorder = {
            top: { style: "thin" },
            left: { style: "thin" },
            bottom: { style: "thin" },
            right: { style: "thin" },
          };

          if (header === "Faktura") {
            headerCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "a1ff8a" },
            };
            const sumCell = worksheet.getCell(1, column.number);
            sumCell.value = {
              formula: `SUBTOTAL(103,B${excelStartRow}:B${excelEndRow})`,
            };
            sumCell.numFmt = "#,##0";
            sumCell.font = { bold: true };
            sumCell.alignment = { horizontal: "center", vertical: "middle" };
            sumCell.border = extraCellBorder;
            sumCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "8acaff" },
            };
          }

          if (header === "Kwota brutto") {
            column.numFmt = "#,##0.00";
          }

          if (header === "Do rozliczenia AS") {
            column.numFmt = "#,##0.00";
            headerCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "8ac700" },
            };
            const sumCell = worksheet.getCell(1, column.number);
            sumCell.value = {
              formula: `SUBTOTAL(109,G${excelStartRow}:G${excelEndRow})`,
            };
            sumCell.numFmt = "#,##0.00 zł";
            sumCell.font = { bold: true };
            sumCell.alignment = { horizontal: "center", vertical: "middle" };
            sumCell.border = extraCellBorder;
            sumCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FF00FF" },
            };
          }

          if (header === "Do rozliczenia FK") {
            column.numFmt = "#,##0.00";
            headerCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "00c777" },
            };
            const sumCell = worksheet.getCell(1, column.number);
            sumCell.value = {
              formula: `SUBTOTAL(109,H${excelStartRow}:H${excelEndRow})`,
            };
            sumCell.numFmt = "#,##0.00 zł";
            sumCell.font = { bold: true };
            sumCell.alignment = { horizontal: "center", vertical: "middle" };
            sumCell.border = extraCellBorder;
            sumCell.fill = {
              type: "pattern",
              pattern: "solid",
              fgColor: { argb: "FFFF00" },
            };
          }

          if (header === "Opis rozrachunku") {
            column.width = 40;
          }
        });

        // Formatowanie wierszy danych
        worksheet.eachRow({ includeEmpty: true }, (row, rowIndex) => {
          if (rowIndex > startRow) {
            row.eachCell({ includeEmpty: true }, (cell) => {
              cell.font = { size: 10 };
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            });
          }
        });

        worksheet.autoFilter = {
          from: "A2",
          to: worksheet.getColumn(headers.length + 1).letter + "2",
        };

        worksheet.views = [
          {
            state: "frozen",
            xSplit: 2,
            ySplit: startRow,
            topLeftCell: "C3",
            activeCell: "C3",
          },
        ];
      }
    });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (err) {
    console.error("Błąd podczas generowania pliku Excel:", err);
    throw err;
  }
};

module.exports = {
  differencesAsFk,
};
