const ExcelJS = require("exceljs");
const { logEvents } = require("../../middleware/logEvents");

const columnsOrder = [
  "smf_stan_na_dzien",
  "smf_typ",
  "smf_numer",
  "dsymbol",
  "kwota_platności",
  "data_platnosci",
  "kwota_faktury",
  "naleznosc",
  "smf_data_otwarcia_rozrachunku",
];

const columnsName = [
  {
    accessorKey: "smf_stan_na_dzien",
    header: "smf_stan_na_dzien",
  },
  {
    accessorKey: "smf_typ",
    header: "smf_typ",
  },
  {
    accessorKey: "smf_numer",
    header: "smf_numer",
  },
  {
    accessorKey: "dsymbol",
    header: "dsymbol",
  },
  {
    accessorKey: "kwota_platności",
    header: "kwota_platności",
  },
  {
    accessorKey: "data_platnosci",
    header: "data_platnosci",
  },
  {
    accessorKey: "kwota_faktury",
    header: "kwota_faktury",
  },
  {
    accessorKey: "naleznosc",
    header: "naleznosc",
  },
  {
    accessorKey: "smf_data_otwarcia_rozrachunku",
    header: "smf_data_otwarcia_rozrachunku",
  },
];

const lawStatement = async (data) => {
  const cleanData = [
    {
      name: "Zestawienie",
      data,
    },
  ];
  // od którego wiersza mają się zaczynać dane w arkuszu
  const startRow = 1;
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
        // Dodaj 5 pustych wierszy na początku arkusza
        for (let i = 0; i < startRow - 1; i++) {
          worksheet.addRow([]);
        }

        // Użyj tablicy columnsOrder, aby uporządkować nagłówki
        const headers = columnsOrder.filter((column) =>
          sheet.data[0].hasOwnProperty(column)
        );

        // Dodaj nagłówki w 6. wierszu, z kolumną 'Lp' na początku
        worksheet.addRow(["Lp", ...headers]);

        // Dodaj dane z każdego obiektu jako wiersze, zaczynając od 1 w kolumnie 'Lp'
        sheet.data.forEach((row, index) => {
          const rowData = [
            index + 1,
            ...headers.map((header) => row[header] || ""),
          ]; // Dodaj numer porządkowy
          worksheet.addRow(rowData);
        });

        worksheet.columns.forEach((column) => {
          let maxLength = 0;
          column.eachCell({ includeEmpty: true }, (cell) => {
            const cellValue = cell.value ? cell.value.toString() : "";
            maxLength = Math.max(maxLength, cellValue.length);
          });
          column.width = Math.min(maxLength + 5, 28); // max 28 znaków
        });

        // Stylizowanie nagłówków
        const headerRow = worksheet.getRow(startRow);
        // headerRow.font = { bold: true, size: 10, color: { argb: "8acaff" } }; // biała czcionka
        // headerRow.alignment = {
        //   horizontal: "center",
        //   vertical: "middle",
        //   wrapText: true,
        // };
        headerRow.eachCell((cell) => {
          // Upewniamy się, że wartość nagłówka jest tekstem
          if (cell.value !== null && cell.value !== undefined) {
            cell.value = cell.value.toString();
          }
        });
        headerRow.height = 30;
        // Stylizacja dla kolumny 'Lp'
        const lpColumn = worksheet.getColumn(1); // Kolumna 'Lp' to zawsze pierwsza kolumna
        lpColumn.width = 10; // Szerokość kolumny
        lpColumn.alignment = { horizontal: "center", vertical: "middle" }; // Wyśrodkowanie

        // Stylizowanie kolumn na podstawie ich nazw, pomijając 'Lp'
        headers.forEach((header, columnIndex) => {
          const column = worksheet.getColumn(columnIndex + 2); // Kolumna 'Lp' ma indeks 1, więc zaczynamy od 2
          const headerCell = worksheet.getCell(startRow, columnIndex + 2);
          headerCell.font = { bold: true }; // Pogrubienie czcionki
          headerCell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          column.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };

          //   if (header === "smf_stan_na_dzien") {
          //     column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
          //       if (rowNumber === startRow) return; // pomijamy nagłówek
          //       if (cell.value) {
          //         const dateObj = new Date(cell.value);
          //         const formatted = `${dateObj.getFullYear()}-${String(
          //           dateObj.getMonth() + 1
          //         ).padStart(2, "0")}-${String(dateObj.getDate()).padStart(
          //           2,
          //           "0"
          //         )}\n${String(dateObj.getHours()).padStart(2, "0")}:${String(
          //           dateObj.getMinutes()
          //         ).padStart(2, "0")}:${String(dateObj.getSeconds()).padStart(
          //           2,
          //           "0"
          //         )}`;
          //         cell.value = formatted;
          //         cell.alignment = {
          //           wrapText: true,
          //           horizontal: "center",
          //           vertical: "top",
          //         };

          //         // Dodaj kolor dla co drugiego wiersza
          //         if (rowNumber % 2 === 0) {
          //           cell.fill = {
          //             type: "pattern",
          //             pattern: "solid",
          //             fgColor: { argb: "C0E6F5" }, // jasnoniebieski
          //           };
          //         }
          //       }
          //     });
          //     column.width = 22;
          //   }
          if (header === "smf_stan_na_dzien") {
            column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
              if (rowNumber === startRow) return; // pomijamy nagłówek
              if (cell.value) {
                const date = new Date(cell.value);

                // Odejmij 2 godziny
                date.setHours(date.getHours() - 2);

                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, "0");
                const day = String(date.getDate()).padStart(2, "0");
                const hours = String(date.getHours()).padStart(2, "0");
                const minutes = String(date.getMinutes()).padStart(2, "0");
                const seconds = String(date.getSeconds()).padStart(2, "0");

                // Tworzymy string jako tekst w Excelu
                cell.value = `${year}-${month}-${day}\n${hours}:${minutes}:${seconds}`;

                cell.alignment = {
                  wrapText: true,
                  horizontal: "center",
                  vertical: "top",
                };

                // Kolor co drugiego wiersza
                if (rowNumber % 2 === 0) {
                  cell.fill = {
                    type: "pattern",
                    pattern: "solid",
                    fgColor: { argb: "C0E6F5" },
                  };
                }
              }
            });
            column.width = 22;
          }

          if (
            header === "kwota_platności" ||
            header === "kwota_faktury" ||
            header === "naleznosc"
          ) {
            column.numFmt = "#,##0.00";
            column.eachCell({ includeEmpty: true }, (cell, rowNumber) => {
              if (rowNumber === startRow) return; // pomijamy nagłówek
              if (
                cell.value === null ||
                cell.value === undefined ||
                cell.value === ""
              ) {
                cell.value = 0;
              }
            });
          }
        });

        worksheet.eachRow({ includeEmpty: true }, (row, rowIndex) => {
          // Sprawdzamy, czy jesteśmy w wierszach od 6 w górę
          if (rowIndex >= startRow) {
            row.eachCell({ includeEmpty: true }, (cell) => {
              // Jeśli to nie jest wiersz nagłówka (np. 6), zastosuj standardową stylizację
              cell.font = { size: 10 }; // Ustawienie czcionki na rozmiar 10

              // Ustawienie cienkiego obramowania dla każdej komórki
              cell.border = {
                top: { style: "thin" },
                left: { style: "thin" },
                bottom: { style: "thin" },
                right: { style: "thin" },
              };
            });
          }
        });

        worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
          if (rowNumber <= startRow) return; // pomijamy nagłówek
          if (rowNumber % 2 === 0) {
            // co drugi wiersz
            row.eachCell({ includeEmpty: true }, (cell) => {
              // Nie nadpisujemy kolumny z datą/godziną (zawiera \n)
              if (
                !(
                  cell.value &&
                  typeof cell.value === "string" &&
                  cell.value.includes("\n")
                )
              ) {
                cell.fill = {
                  type: "pattern",
                  pattern: "solid",
                  fgColor: { argb: "C0E6F5" }, // jasnoniebieski
                };
              }
            });
          }
        });

        headerRow.eachCell((cell) => {
          cell.font = { bold: true, size: 12, color: { argb: "ffffff" } };
          cell.alignment = {
            horizontal: "center",
            vertical: "middle",
            wrapText: true,
          };
          cell.fill = {
            type: "pattern",
            pattern: "solid",
            fgColor: { argb: "156082" }, // granat
          };
        });

        // Ustawienie autofiltrowania od wiersza 6 (nagłówki) dla całego zakresu
        worksheet.autoFilter = {
          from: "A1", // Pierwsza kolumna (Lp)
          to: worksheet.getColumn(headers.length + 1).letter + "1", // Ostatnia kolumna na podstawie liczby kolumn
        };

        // Blokowanie 5 pierwszych wierszy, aby wiersz 6 (nagłówki) został widoczny
        worksheet.views = [
          {
            state: "frozen",
            xSplit: 2,
            ySplit: startRow, // Zablokowanie do wiersza 6, aby nagłówki zostały widoczne
            topLeftCell: "C2",
            activeCell: "C2",
          },
        ];
      }
    });

    // Zapisz plik Excel
    // workbook.xlsx.writeBuffer().then((buffer) => {
    //   saveAs(new Blob([buffer]), "Struktura organizacji.xlsx");
    // });

    const buffer = await workbook.xlsx.writeBuffer();
    return buffer;
  } catch (error) {
    logEvents(`lawStatement, lawStatement: ${error}`, "reqServerErrors.txt");
  }
};

module.exports = {
  lawStatement,
};
