const ExcelJS = require("exceljs");

const columnsOrder = [
    "Numer FV",
    "Numer Sprawy Votum",
    "Brutto",
    "Nr rejestracyjny",
    "Nr szkody",
    "Należność",
    "Opis rozrachunku",
    "Data rozl. AS",
];

const columnsName = [
    {
        accessorKey: "NUMER_FV",
        header: "Numer FV"
    },
    {
        accessorKey: "NUMER_SPRAWY_BECARED",
        header: "Numer Sprawy Votum"
    },
    {
        accessorKey: "FV_BRUTTO",
        header: "Brutto"
    },
    {
        accessorKey: "NR_REJESTRACYJNY",
        header: "Nr rejestracyjny"
    },
    {
        accessorKey: "NR_SZKODY",
        header: "Nr szkody"
    },
    {
        accessorKey: "FV_NALEZNOSC",
        header: "Należność"
    },
    {
        accessorKey: "OPIS_ROZRACHUNKU",
        header: "Opis rozrachunku"
    },
    {
        accessorKey: "DATA_ROZL_AS",
        header: "Data rozl. AS"
    },
];

const generateExcelRaport = async (dataVotum) => {
    const cleanData = [{
        name: "Votum",
        data: dataVotum
    }];
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

                // Zamiana pustych wartości 'Należność' na 0
                if ('Należność' in newItem && (newItem['Należność'] === null || newItem['Należność'] === undefined || newItem['Należność'] === '')) {
                    newItem['Należność'] = 0;
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
                for (let i = 0; i < startRow - 1; i++) {
                    worksheet.addRow([]);
                }

                const headers = columnsOrder.filter((column) =>
                    sheet.data[0].hasOwnProperty(column)
                );

                worksheet.addRow(['Lp', ...headers]);

                sheet.data.forEach((row, index) => {
                    const rowData = [index + 1, ...headers.map((header) => {
                        if (header === 'Należność') {
                            // Ustaw jawnie wartość liczbową
                            const val = row[header];
                            return typeof val === 'number' ? val : 0;
                        }
                        return row[header] ?? '';
                    })];

                    worksheet.addRow(rowData);
                });

                const headerRow = worksheet.getRow(startRow);
                headerRow.font = { bold: true, size: 10 };
                headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, size: 10 };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'cacaca' },
                    };
                });

                const lpColumn = worksheet.getColumn(1);
                lpColumn.width = 10;
                lpColumn.alignment = { horizontal: 'center', vertical: 'middle' };

                headers.forEach((header, columnIndex) => {
                    const column = worksheet.getColumn(columnIndex + 2);
                    const headerCell = worksheet.getCell(startRow, columnIndex + 2);
                    headerCell.font = { bold: true };
                    headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    column.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    column.width = header === 'Opis rozrachunku' ? 50 : 25;

                    if (header === 'Należność') {
                        column.numFmt = '#,##0.00';
                    }
                });

                // Formatowanie wierszy danych (także 'Należność')
                worksheet.eachRow({ includeEmpty: true }, (row, rowIndex) => {
                    if (rowIndex > startRow) {
                        row.eachCell({ includeEmpty: true }, (cell, colNumber) => {
                            cell.font = { size: 10 };
                            cell.border = {
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' },
                            };

                            const header = headers[colNumber - 2]; // colNumber - 2, bo col 1 to 'Lp'
                            if (header === 'Należność') {
                                cell.numFmt = '#,##0.00';
                                if (cell.value === null || cell.value === undefined || cell.value === '') {
                                    cell.value = 0;
                                }
                            }
                        });
                    }
                });

                worksheet.autoFilter = {
                    from: 'A1',
                    to: worksheet.getColumn(headers.length + 1).letter + '1',
                };

                worksheet.views = [{
                    state: 'frozen',
                    xSplit: 2,
                    ySplit: startRow,
                    topLeftCell: 'C2',
                    activeCell: 'C2',
                }];
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;

    } catch (err) {
        console.error('Błąd generowania excela:', err);
    }
};


module.exports = {
    generateExcelRaport
};