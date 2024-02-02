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
            filteredData = result.filter(item => item.DOROZLICZ_ !== 0);
        } else if (info === "archive") {
            filteredData = result.filter(item => item.DOROZLICZ_ === 0);
        } else if (info === "all") {
            filteredData = result;
        }

        filteredData.forEach(item => {
            const date = new Date();
            const lastDate = new Date(item.TERMIN);
            const timeDifference = date - lastDate;
            const daysDifference = Math.floor(timeDifference / (1000 * 60 * 60 * 24));
            item.ILEDNIPOTERMINIE = daysDifference;
        });

        if (truePermissions[0] === "Basic") {
            const basicFiltered = filteredData.filter(item => item.ZATWIERDZIL === ZATWIERDZIL);
            return res.json(basicFiltered);
        } else {
            const standardFiltered = filteredData.filter(item => trueDepartments.includes(item.DZIAL));
            console.log(standardFiltered.length);
            return res.json(standardFiltered);
        }

    } catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const isExcelFile = (data) => {
    const excelSignature = [0x50, 0x4B, 0x03, 0x04];
    for (let i = 0; i < excelSignature.length; i++) {
        if (data[i] !== excelSignature[i]) {
            return false;
        }
    }
    return true;
};


const documentsFromFile = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'Not delivered file' });
        }
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
                // KWOTAWINDYKOWANA: row.KWOTAWINDYKOWANA ? row.KWOTAWINDYKOWANA : 0,
                'DATAFV': row['DATAFV'] ? excelDateToISODate(row['DATAFV']).toString() : null,
                'TERMIN': row['TERMIN'] ? excelDateToISODate(row['TERMIN']).toString() : null,
                'DATAKOMENTARZABECARED': row['DATAKOMENTARZABECARED'] ? excelDateToISODate(row['DATAKOMENTARZABECARED']).toString() : null,
            };
        });


        await Promise.all(mappedRows.map(async (row) => {
            try {
                const result = await Document.findOneAndUpdate(
                    { NUMER: row.NUMER },
                    row,
                    { new: true, upsert: true }
                );
            } catch (error) {
                console.err(err);
            }
        }));


        res.status(201).json({ 'message': 'Documents are saved' });

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

module.exports = {
    getAllDocuments,
    documentsFromFile,
    getColumns
};