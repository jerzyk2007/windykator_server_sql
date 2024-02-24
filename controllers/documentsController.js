const Document = require('../model/Document');
const User = require('../model/User');
const UpdateDB = require('../model/UpdateDB');
const { read, utils } = require('xlsx');

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_

// FV/UBL/782/23/V/D8 w tabelce 1109,13, w rozrachunkach 596,52

const getAllDocuments = async (req, res) => {
    const { info, _id } = req.params;
    let filteredData = [];
    try {
        const findUser = await User.find({ _id });
        const { permissions, username, usersurname, departments } = findUser[0];

        const truePermissions = Object.keys(permissions).filter(permission => permissions[permission]);
        const trueDepartments = Array.from(departments.entries())
            .filter(([department, value]) => value)
            .map(([department]) => department);

        const DORADCA = `${usersurname} ${username}`;

        const result = await Document.find({});
        if (info === "actual") {
            filteredData = result.filter(item => item.DO_ROZLICZENIA !== 0);
        } else if (info === "archive") {
            filteredData = result.filter(item => item.DO_ROZLICZENIA === 0);
        } else if (info === "all") {
            filteredData = result;
        }



        filteredData.forEach(item => {
            const date = new Date();
            const lastDate = new Date(item.TERMIN);
            const timeDifference = date - lastDate;
            const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
            item.ILE_DNI_PO_TERMINIE = daysDifference;
            if (daysDifference > 0) {
                item.CZY_PRZETERMINOWANE = "P";
            } else {
                item.CZY_PRZETERMINOWANE = "N";

            }
        });

        if (truePermissions[0] === "Basic") {
            const basicFiltered = filteredData.filter(item => item.DORADCA === DORADCA);
            return res.json(basicFiltered);
        } else {
            const standardFiltered = filteredData.filter(item => trueDepartments.includes(item.DZIAL));
            return res.json(standardFiltered);
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};




// Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
const excelDateToISODate = (excelDate) => {
    const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
    return date.toISOString().split('T')[0]; // Pobranie daty w formacie "yyyy-mm-dd"
};

// funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
const isExcelDate = (value) => {
    // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
    if (typeof value === 'number' && value > 0) {
        // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
        return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
    }

    return false;
};

// weryfikacja czy plik excel jest prawidłowy (czy nie jest podmienione rozszerzenie)
const isExcelFile = (data) => {
    const excelSignature = [0x50, 0x4B, 0x03, 0x04];
    for (let i = 0; i < excelSignature.length; i++) {
        if (data[i] !== excelSignature[i]) {
            return false;
        }
    }
    return true;
};

// funkcja która dodaje dane z sharepointa
const sharepointFile = async (rows, res) => {

    const mappedRows = rows.map(row => {
        return {
            NUMER_FV: row['NUMER FV'],
            DZIAL: row['DZIAŁ'] === "D8" ? row['DZIAŁ'] = "D08" : row['DZIAŁ'],
            DATA_FV: row['DATA FV'] ? excelDateToISODate(row['DATA FV']).toString() : '',
            TERMIN: row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : '',
            BRUTTO: row['W. BRUTTO'],
            NETTO: row['W. NETTO'],
            DO_ROZLICZENIA: row['DO ROZLICZ.\nAutostacja'],
            "100_VAT": row['100%\nVAT'],
            "50_VAT": row['50%\nVAT'],
            NR_REJESTRACYJNY: row['NR REJESTRACYJNY'] ? row['NR REJESTRACYJNY'] : '',
            KONTRAHENT: row['KONTRAHENT'] ? row['KONTRAHENT'] : '',
            ASYSTENTKA: row['ASYSTENTKA'] ? row['ASYSTENTKA'] : '',
            DORADCA: row['ZATWIERDZIŁ'] ? row['ZATWIERDZIŁ'] : '',
            NR_SZKODY: row['NR SZKODY'] ? row['NR SZKODY'] : '',
            UWAGI_ASYSTENT: row['UWAGI '] ? row['UWAGI '] : '',
            UWAGI_Z_FAKTURY: '',
            STATUS_SPRAWY_WINDYKACJA: row['Status sprawy Windykcja\n'] ? row['Status sprawy Windykcja\n'] : '',
            DZIALANIA: row['DZIAŁANIA'] ? row['DZIAŁANIA'] : '',
            JAKA_KANCELARIA: row['Jaka Kancelaria'] ? row['Jaka Kancelaria'] : '',
            STATUS_SPRAWY_KANCELARIA: row['STATUS SPRAWY KANCELARIA'] ? row['STATUS SPRAWY KANCELARIA'] : '',
            KOMENTARZ_KANCELARIA_BECARED: row['KOMENTARZ KANCELARIA'] ? row['KOMENTARZ KANCELARIA'] : '',
            DATA_KOMENTARZA_BECARED: row['DATA_KOMENTARZA_BECARED'] ? excelDateToISODate(row['DATA_KOMENTARZA_BECARED']).toString() : '',
            NUMER_SPRAWY_BECARED: row['NUMER SPRAWY'] ? row['NUMER SPRAWY'] : '',
            KWOTA_WINDYKOWANA_BECARED: row['KWOTA WINDYKOWANA \n'] ? row['KWOTA WINDYKOWANA \n'] : '',
            BLAD_DORADCY: "NIE",
            BLAD_W_DOKUMENTACJI: "NIE",
            POBRANO_VAT: "Nie dotyczy",
            ZAZNACZ_KONTRAHENTA: "Nie"
        };
    });

    // const mappedRows = rows.map(row => {
    //     return {
    //         NUMER_FV: row['NUMER FV'],
    //         DZIAL: row['DZIAŁ'] === "D8" ? row['DZIAŁ'] = "D08" : row['DZIAŁ'],
    //         DATA_FV: row['DATA FV'] ? excelDateToISODate(row['DATA FV']).toString() : null,
    //         TERMIN: row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : null,
    //         BRUTTO: row['W. BRUTTO'],
    //         NETTO: row['W. NETTO'],
    //         DO_ROZLICZENIA: row['DO ROZLICZ.\nAutostacja'],
    //         "100_VAT": row['100%\nVAT'],
    //         "50_VAT": row['50%\nVAT'],
    //         NR_REJESTRACYJNY: row['NR REJESTRACYJNY'],
    //         KONTRAHENT: row['KONTRAHENT'],
    //         ASYSTENTKA: row['ASYSTENTKA'],
    //         DORADCA: row['ZATWIERDZIŁ'],
    //         NR_SZKODY: row['NR SZKODY'],
    //         UWAGI_ASYSTENT: row['UWAGI '],
    //         UWAGI_Z_FAKTURY: null,
    //         STATUS_SPRAWY_WINDYKACJA: row['Status sprawy Windykcja\n'],
    //         DZIALANIA: row['DZIAŁANIA'],
    //         JAKA_KANCELARIA: row['Jaka Kancelaria'],
    //         STATUS_SPRAWY_KANCELARIA: row['STATUS SPRAWY KANCELARIA'],
    //         KOMENTARZ_KANCELARIA_BECARED: row['KOMENTARZ KANCELARIA'],
    //         DATA_KOMENTARZA_BECARED: row['DATA_KOMENTARZA_BECARED'] ? excelDateToISODate(row['DATA_KOMENTARZA_BECARED']).toString() : null,
    //         NUMER_SPRAWY_BECARED: row['NUMER SPRAWY'],
    //         KWOTA_WINDYKOWANA_BECARED: row['KWOTA WINDYKOWANA \n'],
    //         BLAD_DORADCY: "NIE",
    //         BLAD_W_DOKUMENTACJI: "NIE",
    //         POBRANO_VAT: "Nie dotyczy",
    //         ZAZNACZ_KONTRAHENTA: "Nie"
    //     };
    // });

    try {
        await Promise.all(mappedRows.map(async (row) => {

            try {
                const result = await Document.findOneAndUpdate(
                    { NUMER_FV: row.NUMER_FV },
                    row,
                    { new: true, upsert: true }
                );
            } catch (err) {
                console.error(err);
            }
        }));
        res.status(201).json({ 'message': 'Documents are updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// funkcja która dodaje dane z z pliku dokuemty autostacja
const ASFile = async (rows, res) => {

    console.log(rows);

    for (const row of rows) {
        const findDocument = await Document.findOne({ NUMER_FV: row.NUMER_FV }).exec();
        if (!findDocument) {
            console.log(row);
        }
    }

    // const checkExistDocument = rows.map(row=>{
    //     const findDocument = await Document.findOne({ NUMER_FV: row.NUMER_FV }).exec(); 
    // })

    // const cleanDocument = rows.map(clean => {
    //     const cleanDoc = clean['Faktura nr'].split(' ')[0];
    //     return { ...clean, 'Faktura nr': cleanDoc };
    // });

    // const preparedRows = cleanDocument.map(row => {
    //     if (row['Faktura nr']) {

    //         return {
    //             NUMER_FV: row['Faktura nr'],
    //             NR_SZKODY: row['Numer szkody'] ? row['Numer szkody'] : "",
    //             DATA_FV: row['Data faktury'],
    //             TERMIN: row['Termin płatności'],
    //             BRUTTO: row['Wartość początkowa'],
    //             NETTO: row['Wartość początkowa'] / 1.23,
    //             DO_ROZLICZENIA: row['Wartość do zapłaty'],
    //             "100_VAT": (row['Wartość początkowa'] - row['Wartość początkowa'] / 1.23),
    //             "50_VAT": (row['Wartość początkowa'] - row['Wartość początkowa'] / 1.23) / 2,
    //             NR_REJESTRACYJNY: row['Nr. rej.'] ? row['Nr. rej.'] : '',
    //             KONTRAHENT: row['Kontrahent Nazwa'],
    //             DORADCA: row['Przygotował'],
    //             UWAGI_ASYSTENT: row['Działania'] ? row['Działania'] : '',
    //             DZIAL: row['Id Dział'],
    //             ASYSTENTKA: row['Asystentka'],
    //         };
    //     }
    // }).filter(Boolean);

    try {
        // for (const row of preparedRows) {
        // const findDocument = await Document.findOne({ NUMER_FV: row.NUMER_FV }).exec();
        // if (findDocument) {
        //     const update = await Document.updateOne(
        //         { _id: findDocument._id },
        //         { $set: { DO_ROZLICZENIA: row.DO_ROZLICZENIA } },
        //         { upsert: true }
        //     );

        // }
        // else {
        // let prepareItem = {};
        // if (row.DZIAL === "D8") {
        //     prepareItem = { ...row, DZIAL: "D08" };
        //     const createdDocument = await Document.create(prepareItem);
        // }


        // }
        // };

        res.status(201).json({ 'message': 'Documents are updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// funkcja która dodaje dane z Rozrachunków do bazy danych i nanosi nowe należności na wszytskie faktury w DB
const settlementsFile = async (rows, res) => {

    if (!rows[0]['TYTUŁ'] && !rows[0]['TERMIN'] && !rows[0]['NALEŻNOŚĆ']) {
        return res.status(500).json({ error: "Invalid file" });
    }

    // rozrachunki często mają oprócz nr faktury zbędne dane, ta funckja je usuwa
    // const cleanDocument = rows.map(row => {
    //     const cleanDoc = row['TYTUŁ'].split(' ')[0];
    //     return {
    //         NUMER_FV: cleanDoc,
    //         TERMIN: row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : '',
    //         DO_ROZLICZENIA: row['NALEŻNOŚĆ'] ? row['NALEŻNOŚĆ'] : 0
    //     };
    // });

    const cleanDocument = rows.map(row => {
        const cleanDoc = row['TYTUŁ'].split(' ')[0];
        let termin;
        if (row['TERMIN'] && isExcelDate(row['TERMIN'])) {
            termin = excelDateToISODate(row['TERMIN']).toString();
        } else {
            termin = row['TERMIN'] ? row['TERMIN'] : '';
        }
        return {
            NUMER_FV: cleanDoc,
            TERMIN: termin,
            DO_ROZLICZENIA: row['NALEŻNOŚĆ'] ? row['NALEŻNOŚĆ'] : 0
        };
    });

    const actualDate = new Date();

    try {
        const update = await UpdateDB.updateOne(
            {},
            { $set: { date: actualDate, settlements: cleanDocument } },
            { upsert: true }
        );

        const allDocuments = await Document.find({});

        // sprawdzenie czy w rozrachunkach znajduje się faktura z DB
        // const updatedDocuments = [];
        for (const doc of allDocuments) {
            const found = cleanDocument.find(cleanDoc => cleanDoc.NUMER_FV === doc.NUMER_FV);
            if (found) {

                try {
                    const result = await Document.updateOne(
                        { NUMER_FV: doc.NUMER_FV },
                        { $set: { DO_ROZLICZENIA: found.DO_ROZLICZENIA } }
                    );
                    // updatedDocuments.push(result);
                } catch (error) {
                    console.error("Error while updating the document", error);
                }

            } else {
                try {
                    const result = await Document.updateOne(
                        { NUMER_FV: doc.NUMER_FV },
                        { $set: { DO_ROZLICZENIA: 0 } }
                    );
                    // updatedDocuments.push(result);
                } catch (error) {
                    console.error("Error while updating the document", error);
                }
            }
        }


        res.status(201).json({ 'message': 'Documents are updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// dodawnie danych do DB z pliku excel
const documentsFromFile = async (req, res) => {
    const { type } = req.params;
    if (!req.file) {
        return res.status(400).json({ error: 'Not delivered file' });
    }
    try {
        const buffer = req.file.buffer;
        const data = new Uint8Array(buffer);

        if (!isExcelFile(data)) {
            return res.status(500).json({ error: "Invalid file" });
        }
        const workbook = read(buffer, { type: 'buffer' });
        const workSheetName = workbook.SheetNames[0];
        const workSheet = workbook.Sheets[workSheetName];
        const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

        if (type === "sharepoint") {
            return sharepointFile(rows, res);
        }
        else if (type === "AS") {
            return ASFile(rows, res);
        }
        else if (type === "settlements") {
            return settlementsFile(rows, res);
        }

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getColumns = async (req, res) => {
    try {
        const firstDocument = await Document.findOne();
        if (firstDocument) {
            // Pobierz klucze z pierwszego dokumentu i umieść je w tablicy
            const keysArray = Object.keys(firstDocument.toObject());
            keysArray.shift();
            keysArray.pop();
            res.json(keysArray);
        }
        else {
            return res.status(400).json({ error: 'Empty collection.' });
        }
    }

    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const changeSingleDocument = async (req, res) => {
    const { _id, documentItem } = req.body;
    try {
        // const fieldToUpdate = Object.keys(documentItem)[0]; // Pobierz nazwę pola do aktualizacji
        // const updatedFieldValue = documentItem[fieldToUpdate];
        const result = await Document.updateOne(
            { _id },
            documentItem
        );
        res.end();
    }

    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    getAllDocuments,
    documentsFromFile,
    getColumns,
    changeSingleDocument
};