const ExcelJS = require("exceljs");

const columnsOrder = [
    "TYP DOKUMENTU",
    "NR DOKUMENTU",
    "DZIAŁ",
    "LOKALIZACJA",
    "KONTRAHENT",
    "KONTROLA",
    "POZOSTAŁA KWOTA DO ROZLICZENIA W FK",
    "POZOSTAŁA KWOTA DO ROZLICZENIA W AS3",
    "RÓŻNICA MIĘDZY FK A AS3",
    "HISTORIA DECYZJI",
    "DECYZJA BIZNES",
    "OSTATECZNA DATA ROZLICZENIA",
    "ILE ZMIAN OST DATY ROZL.",
    "DATA ROZLICZENIA AS",
    "OPIS ROZRACHUNKU",
    "DATA WYSTAWIENIA FAKTURY",
    "BRAK DATY WYSTAWIENIA FV",
    "TERMIN PŁATNOŚCI FV",
    "PRZEDZIAŁ WIEKOWANIE",
    "ILE DNI NA PLATNOŚĆ NA FV",
    "KONTO",
    "PRZETERMINOWANE / NIEPRZETERMINOWANE",
    "TYP PŁATNOŚCI",
    "JAKA KANCELARIA",
    "ETAP SPRAWY",
    "KWOTA WPS",
    "CZY KANCELARIA TAK/ NIE",
    "DORADCA",
    "OBSZAR",
    "NR VIN",
    "CZY SAMOCHÓD WYDANY TAK/NIE",
    "DATA WYDANIA AUTA W AS3",
    "OWNER",
    "NR KLIENTA",
    "OPIEKUN OBSZARU CENTRALI",
];

const columnsName = [
    {
        accessorKey: "TYP_DOKUMENTU",
        header: "TYP DOKUMENTU"
    },
    {
        accessorKey: "NR_DOKUMENTU",
        header: "NR DOKUMENTU"
    },
    {
        accessorKey: "DZIAL",
        header: "DZIAŁ"
    },
    {
        accessorKey: "LOKALIZACJA",
        header: "LOKALIZACJA"
    },
    {
        accessorKey: "KONTRAHENT",
        header: "KONTRAHENT"
    },
    {
        accessorKey: "KWOTA_DO_ROZLICZENIA_FK",
        header: "POZOSTAŁA KWOTA DO ROZLICZENIA W FK"
    },
    {
        accessorKey: "DO_ROZLICZENIA_AS",
        header: "POZOSTAŁA KWOTA DO ROZLICZENIA W AS3"
    },
    {
        accessorKey: "ROZNICA",
        header: "RÓŻNICA MIĘDZY FK A AS3"
    },
    {
        accessorKey: "KONTROLA_DOC",
        header: "KONTROLA"
    },
    {
        accessorKey: "INFORMACJA_ZARZAD",
        header: "DECYZJA BIZNES"
    },
    {
        accessorKey: "OSTATECZNA_DATA_ROZLICZENIA",
        header: "OSTATECZNA DATA ROZLICZENIA"
    },
    {
        accessorKey: "HISTORIA_ZMIANY_DATY_ROZLICZENIA",
        header: "ILE ZMIAN OST DATY ROZL."
    },
    {
        accessorKey: "DATA_ROZLICZENIA_AS",
        header: "DATA ROZLICZENIA AS"
    },
    {
        accessorKey: "OPIS_ROZRACHUNKU",
        header: "OPIS ROZRACHUNKU"
    },
    {
        accessorKey: "DATA_WYSTAWIENIA_FV",
        header: "DATA WYSTAWIENIA FAKTURY"
    },
    {
        accessorKey: "BRAK_DATY_WYSTAWIENIA_FV",
        header: "BRAK DATY WYSTAWIENIA FV"
    },
    {
        accessorKey: "TERMIN_PLATNOSCI_FV",
        header: "TERMIN PŁATNOŚCI FV"
    },
    {
        accessorKey: "TYP_PLATNOSCI",
        header: "TYP PŁATNOŚCI"
    },
    {
        accessorKey: "PRZEDZIAL_WIEKOWANIE",
        header: "PRZEDZIAŁ WIEKOWANIE"
    },
    {
        accessorKey: "ILE_DNI_NA_PLATNOSC_FV",
        header: "ILE DNI NA PLATNOŚĆ NA FV"
    },
    {
        accessorKey: "RODZAJ_KONTA",
        header: "KONTO"
    },
    {
        accessorKey: "PRZETER_NIEPRZETER",
        header: "PRZETERMINOWANE / NIEPRZETERMINOWANE"
    },
    {
        accessorKey: "JAKA_KANCELARIA",
        header: "JAKA KANCELARIA"
    },
    {
        accessorKey: "ETAP_SPRAWY",
        header: "ETAP SPRAWY"
    },
    {
        accessorKey: "KWOTA_WPS",
        header: "KWOTA WPS"
    },
    {
        accessorKey: "CZY_W_KANCELARI",
        header: "CZY KANCELARIA TAK/ NIE"
    },
    {
        accessorKey: "OBSZAR",
        header: "OBSZAR"
    },
    {
        accessorKey: "DORADCA_FV",
        header: "DORADCA"
    },
    {
        accessorKey: "VIN",
        header: "NR VIN"
    },
    {
        accessorKey: "CZY_SAMOCHOD_WYDANY_AS",
        header: "CZY SAMOCHÓD WYDANY TAK/NIE"
    },
    {
        accessorKey: "DATA_WYDANIA_AUTA",
        header: "DATA WYDANIA AUTA W AS3"
    },
    {
        accessorKey: "OWNER",
        header: "OWNER"
    },
    {
        accessorKey: "NR_KLIENTA",
        header: "NR KLIENTA"
    },
    {
        accessorKey: "OPIEKUN_OBSZARU_CENTRALI",
        header: "OPIEKUN OBSZARU CENTRALI"
    },
    {
        accessorKey: "HISTORIA_WPISÓW_W_RAPORCIE",
        header: "HISTORIA DECYZJI"
    },
];


const getExcelRaport = async (cleanData, raportInfo) => {

    // od którego wiersza mają się zaczynać dane w arkuszu
    const startRow = 6;
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
                worksheet.addRow(['Lp', ...headers]);

                // Dodaj dane z każdego obiektu jako wiersze, zaczynając od 1 w kolumnie 'Lp'
                sheet.data.forEach((row, index) => {
                    const rowData = [index + 1, ...headers.map((header) => row[header] || '')]; // Dodaj numer porządkowy
                    // worksheet.addRow(rowData);
                    const newRow = worksheet.addRow(rowData);
                    newRow.height = 40; // 
                });

                // Stylizowanie nagłówków
                const headerRow = worksheet.getRow(startRow);
                headerRow.font = { bold: true, size: 10 }; // Ustawienie pogrubionej czcionki o rozmiarze 10
                headerRow.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, size: 10 };
                    cell.fill = {
                        type: 'pattern',
                        pattern: 'solid',
                        fgColor: { argb: 'cacaca' }, // Kolor tła (np. żółty)
                    };
                });


                // Stylizacja dla kolumny 'Lp'
                const lpColumn = worksheet.getColumn(1); // Kolumna 'Lp' to zawsze pierwsza kolumna
                lpColumn.width = 10; // Szerokość kolumny
                lpColumn.alignment = { horizontal: 'center', vertical: 'middle' }; // Wyśrodkowanie

                // Stylizowanie kolumn na podstawie ich nazw, pomijając 'Lp'
                headers.forEach((header, columnIndex) => {
                    const column = worksheet.getColumn(columnIndex + 2); // Kolumna 'Lp' ma indeks 1, więc zaczynamy od 2
                    const headerCell = worksheet.getCell(startRow, columnIndex + 2);
                    headerCell.font = { bold: true }; // Pogrubienie czcionki
                    headerCell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    const excelStartRow = startRow + 1;
                    const excelEndRow = worksheet.rowCount;
                    column.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };
                    column.width = 15;

                    const extraCellBorder = {
                        top: { style: 'thin' },
                        left: { style: 'thin' },
                        bottom: { style: 'thin' },
                        right: { style: 'thin' },
                    };

                    // Stylizacja dla różnych kolumn
                    if (header === 'TYP DOKUMENTU') {
                        column.width = 20;
                        const countCell1 = worksheet.getCell(1, column.number);
                        countCell1.value = "Data zestawienia:";
                        countCell1.border = extraCellBorder;

                        const countCell2 = worksheet.getCell(2, column.number);
                        countCell2.value = "Wiekowanie na dzień:";
                        countCell2.border = extraCellBorder;

                        const countCell3 = worksheet.getCell(3, column.number);
                        countCell3.value = "Nazwa zestawienia:";
                        countCell3.border = extraCellBorder;
                    }

                    else if (header === 'NR DOKUMENTU') {
                        headerCell.alignment = { horizontal: 'center', vertical: 'middle' };
                        headerCell.font = { bold: true }; // Pogrubienie czcionki
                        column.width = 25;
                        // Wstawienie liczby dokumentów w wierszu 4 tej kolumny
                        const countCell = worksheet.getCell(5, column.number);
                        countCell.value = { formula: `SUBTOTAL(103,G${excelStartRow}:G${excelEndRow})` };
                        countCell.numFmt = '0'; // Formatowanie liczby
                        countCell.font = { bold: true }; // Pogrubienie tekstu
                        countCell.alignment = { horizontal: 'center', vertical: 'middle' }; // Wyrównanie tekstu
                        countCell.border = extraCellBorder;
                        countCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF00' }, // Żółte tło dla wyróżnienia
                        };

                        const countCell1 = worksheet.getCell(1, column.number);
                        countCell1.value = raportInfo.reportDate;
                        countCell1.alignment = { horizontal: 'center', vertical: 'middle' };
                        countCell1.border = extraCellBorder;

                        const countCell2 = worksheet.getCell(2, column.number);
                        countCell2.value = raportInfo.agingDate;
                        countCell2.alignment = { horizontal: 'center', vertical: 'middle' };
                        countCell2.border = extraCellBorder;

                        const countCell3 = worksheet.getCell(3, column.number);
                        countCell3.value = raportInfo.reportName;
                        countCell3.alignment = { horizontal: 'center', vertical: 'middle' };
                        countCell3.border = extraCellBorder;

                    }
                    else if (header === 'LOKALIZACJA') {
                        column.width = 18;
                    }
                    else if (header === 'KONTRAHENT') {
                        column.width = 30;
                    }
                    else if (header === 'POZOSTAŁA KWOTA DO ROZLICZENIA W FK') {
                        column.width = 20;
                        column.numFmt = '#,##0.00';
                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: '8ac777' },
                        };

                        // Wstawienie sumy w wierszu 4 tej kolumny
                        const sumCell = worksheet.getCell(5, column.number); // Wiersz 4, odpowiednia kolumna
                        sumCell.value = { formula: `SUBTOTAL(109,G${excelStartRow}:G${excelEndRow})` };// Ustawienie wartości sumy
                        sumCell.numFmt = '#,##0.00 zł'; // Formatowanie liczby
                        sumCell.font = { bold: true }; // Pogrubienie tekstu
                        sumCell.alignment = { horizontal: 'center', vertical: 'middle' }; // Wyrównanie tekstu
                        sumCell.border = extraCellBorder;
                        sumCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF00' }, // Żółte tło dla wyróżnienia
                        };
                    }
                    else if (header === 'KONTROLA') {

                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: 'fd87f7' },
                        };
                    }
                    else if (header === 'POZOSTAŁA KWOTA DO ROZLICZENIA W AS3') {
                        // column.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; // Zawijanie tekstu
                        column.width = 20;
                        column.numFmt = '#,##0.00';
                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: '77a3c7' },
                        };

                        // Wstawienie sumy w wierszu 4 tej kolumny
                        const sumCell = worksheet.getCell(5, column.number); // Wiersz 4, odpowiednia kolumna
                        // sumCell.value = sum; // Ustawienie wartości sumy
                        sumCell.value = { formula: `SUBTOTAL(109,H${excelStartRow}:H${excelEndRow})` };
                        sumCell.numFmt = '#,##0.00 zł'; // Formatowanie liczby
                        sumCell.font = { bold: true }; // Pogrubienie tekstu
                        sumCell.alignment = { horizontal: 'center', vertical: 'middle' }; // Wyrównanie tekstu
                        sumCell.border = extraCellBorder;
                        sumCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF00' }, // Żółte tło dla wyróżnienia
                        };
                    }
                    else if (header === 'RÓŻNICA MIĘDZY FK A AS3') {
                        // column.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true }; // Zawijanie tekstu
                        column.width = 20;
                        column.numFmt = '#,##0.00';
                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: 'ff0000' },
                        };

                        // Wstawienie sumy w wierszu 4 tej kolumny
                        const sumCell = worksheet.getCell(5, column.number); // Wiersz 4, odpowiednia kolumna
                        // sumCell.value = sum; // Ustawienie wartości sumy
                        sumCell.value = { formula: `SUBTOTAL(109,I${excelStartRow}:I${excelEndRow})` };
                        sumCell.numFmt = '#,##0.00 zł'; // Formatowanie liczby
                        sumCell.font = { bold: true }; // Pogrubienie tekstu
                        sumCell.alignment = { horizontal: 'center', vertical: 'middle' }; // Wyrównanie tekstu
                        sumCell.border = extraCellBorder;
                        sumCell.fill = {
                            type: 'pattern',
                            pattern: 'solid',
                            fgColor: { argb: 'FFFF00' }, // Żółte tło dla wyróżnienia
                        };
                    }

                    else if (header === 'HISTORIA DECYZJI') {
                        column.width = 40;
                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: 'fd87f7' },
                        };
                    }
                    else if (header === 'DECYZJA BIZNES') {
                        column.width = 45;
                        headerCell.fill = {
                            type: 'pattern', // Wzór wypełnienia
                            pattern: 'solid', // Wypełnienie jednolite
                            fgColor: { argb: 'ff5b63' },
                        };
                    }
                    else if (header === 'DATA ROZLICZENIA AS') {
                        column.numFmt = 'yyyy-mm-dd'; // Formatowanie daty
                        column.width = 18;
                    }
                    else if (header === 'OPIS ROZRACHUNKU') {
                        column.width = 35;
                    }

                    else if (header === 'DATA WYSTAWIENIA FAKTURY') {
                        column.numFmt = 'yyyy-mm-dd'; // Formatowanie daty
                    }
                    else if (header === 'TERMIN PŁATNOŚCI FV') {
                        column.numFmt = 'yyyy-mm-dd'; // Formatowanie daty
                    }
                    else if (header === 'ILE DNI NA PLATNOŚĆ NA FV') {
                        column.numFmt = '0';
                    }
                    else if (header === 'KONTO') {
                        column.numFmt = '0';
                    }
                    else if (header === 'PRZETERMINOWANE / NIEPRZETERMINOWANE') {
                        column.width = 20;
                    }
                    else if (header === 'KWOTA WPS') {
                        column.numFmt = '0';
                    }
                    else if (header === 'DATA WYDANIA AUTA W AS3') {
                        column.numFmt = 'yyyy-mm-dd'; // Formatowanie daty
                    }
                    else if (header === 'NR VIN') {
                        column.width = 20;
                    }
                    else if (header === 'OWNER') {
                        column.width = 20;
                    }
                    else if (header === 'OPIEKUN OBSZARU CENTRALI') {
                        column.width = 30;
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
                                top: { style: 'thin' },
                                left: { style: 'thin' },
                                bottom: { style: 'thin' },
                                right: { style: 'thin' },
                            };
                        });
                    }
                });
                headerRow.eachCell((cell) => {
                    cell.font = { bold: true, size: 10 };
                    cell.alignment = { horizontal: 'center', vertical: 'middle', wrapText: true };

                });


                // Ustawienie autofiltrowania od wiersza 6 (nagłówki) dla całego zakresu
                worksheet.autoFilter = {
                    from: 'A6', // Pierwsza kolumna (Lp)
                    to: worksheet.getColumn(headers.length + 1).letter + '6', // Ostatnia kolumna na podstawie liczby kolumn
                };

                // Blokowanie 5 pierwszych wierszy, aby wiersz 6 (nagłówki) został widoczny
                worksheet.views = [
                    {
                        state: 'frozen',
                        xSplit: 3,
                        ySplit: startRow, // Zablokowanie do wiersza 6, aby nagłówki zostały widoczne
                        topLeftCell: 'D7',
                        activeCell: 'D7',
                    },
                ];
            }
        });

        const buffer = await workbook.xlsx.writeBuffer();
        return buffer;
        // Zapisz plik Excel
        // workbook.xlsx.writeBuffer().then((buffer) => {
        //     saveAs(new Blob([buffer]), 'Raport_wiekowanie_201_203.xlsx');
        // });
    } catch (err) {
        console.error(err);
    }
};

module.exports = {
    getExcelRaport
};