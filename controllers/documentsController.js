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

// dodawnie danych do DB z pliku excel
const documentsFromFile = async (req, res) => {
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

        // Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
        const excelDateToISODate = (excelDate) => {
            const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
            return date.toISOString().split('T')[0]; // Pobranie daty w formacie "yyyy-mm-dd"
        };

        const mappedRows = rows.map(row => {
            return {
                ...row,
                'DZIAL': row.DZIAL === "D8" ? row.DZIAL = "D08" : row.DZIAL,
                'DATA_FV': row['DATA_FV'] ? excelDateToISODate(row['DATA_FV']).toString() : null,
                'TERMIN': row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : null,
                'DATA_KOMENTARZA_BECARED': row['DATA_KOMENTARZA_BECARED'] ? excelDateToISODate(row['DATA_KOMENTARZA_BECARED']).toString() : null,

            };
        });

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
        const fieldToUpdate = Object.keys(documentItem)[0]; // Pobierz nazwę pola do aktualizacji
        const updatedFieldValue = documentItem[fieldToUpdate];

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