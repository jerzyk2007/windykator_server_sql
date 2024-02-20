const Document = require('../model/Document');
const User = require('../model/User');
const { read, utils } = require('xlsx');

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
const getAllDocuments = async (req, res) => {
    const { info, _id } = req.params;
    let filteredData = [];
    try {
        const findUser = await User.find({ _id });
        const { roles, permissions, username, usersurname, departments } = findUser[0];

        const truePermissions = Object.keys(permissions).filter(permission => permissions[permission]);
        const trueDepartments = Array.from(departments.entries())
            .filter(([department, value]) => value)
            .map(([department]) => department);

        const ZATWIERDZIL = `${usersurname} ${username}`;

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
            ...row,
            'DZIAL': row.DZIAL === "D8" ? row.DZIAL = "D08" : row.DZIAL,
            'DATA_FV': row['DATA_FV'] ? excelDateToISODate(row['DATA_FV']).toString() : null,
            'TERMIN': row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : null,
            'DATA_KOMENTARZA_BECARED': row['DATA_KOMENTARZA_BECARED'] ? excelDateToISODate(row['DATA_KOMENTARZA_BECARED']).toString() : null,

        };
    });
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

// funkcja która dodaje dane z rubicon
const rubiconFile = async (rows, res) => {

    const cleanDocument = rows.map(clean => {
        const cleanDoc = clean['Faktura nr'].split(' ')[0];
        return { ...clean, 'Faktura nr': cleanDoc };
    });

    const preparedRows = cleanDocument.map(row => {
        if (row['Faktura nr']) {

            return {
                NUMER_FV: row['Faktura nr'],
                NR_SZKODY: row['Numer szkody'] ? row['Numer szkody'] : "",
                DATA_FV: row['Data faktury'],
                TERMIN: row['Termin płatności'],
                BRUTTO: row['Wartość początkowa'],
                NETTO: row['Wartość początkowa'] / 1.23,
                DO_ROZLICZENIA: row['Wartość do zapłaty'],
                "100_VAT": (row['Wartość początkowa'] - row['Wartość początkowa'] / 1.23),
                "50_VAT": (row['Wartość początkowa'] - row['Wartość początkowa'] / 1.23) / 2,
                NR_REJESTRACYJNY: row['Nr. rej.'] ? row['Nr. rej.'] : '',
                KONTRAHENT: row['Kontrahent Nazwa'],
                DORADCA: row['Przygotował'],
                UWAGI_ASYSTENT: row['Działania'] ? row['Działania'] : '',
                DZIAL: row['Id Dział'],
                ASYSTENTKA: row['Asystentka'],
            };
        }
    }).filter(Boolean);

    try {
        for (const row of preparedRows) {
            const findDocument = await Document.findOne({ NUMER_FV: row.NUMER_FV }).exec();
            if (findDocument) {
                const update = await Document.updateOne(
                    { _id: findDocument._id },
                    { $set: { DO_ROZLICZENIA: row.DO_ROZLICZENIA } },
                    { upsert: true }
                );

            } else {
                // let prepareItem = {};
                // if (row.DZIAL === "D8") {
                //     prepareItem = { ...row, DZIAL: "D08" };
                //     const createdDocument = await Document.create(prepareItem);
                // }


            }
        };

        res.status(201).json({ 'message': 'Documents are updated' });
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

// funkcja która dodaje dane z PowerBI
const powerBiFile = async (rows, res) => {

    const preparedRows = rows.map(row => {
        if (row['FakturaNumer']) {

            return {
                NUMER_FV: row['FakturaNumer'],
                DO_ROZLICZENIA: row['_wartoscObecna'],
            };
        }
    }).filter(Boolean);

    //    1 068 673,01

    try {
        for (const row of preparedRows) {
            const findDocument = await Document.findOne({ NUMER_FV: row.NUMER_FV }).exec();
            if (findDocument) {
                const update = await Document.updateOne(
                    { _id: findDocument._id },
                    { $set: { DO_ROZLICZENIA: row.DO_ROZLICZENIA } },
                    { upsert: true }
                );

            }
        };

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
        else if (type === "rubicon") {
            return rubiconFile(rows, res);
        }
        else if (type === "powerbi") {
            return powerBiFile(rows, res);
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
        // console.log(documentItem);
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