const Document = require('../model/Document');
const User = require('../model/User');
const UpdateDB = require('../model/UpdateDB');
const { read, utils } = require('xlsx');

// pobiera dane do tabeli w zalezności od uprawnień użytkownika, jesli nie ma pobierac rozliczonych faktur to ważne jest żeby klucz w kolekcji był DOROZLICZ_
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
    // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
    const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
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
            UWAGI_ASYSTENT: row['UWAGI '] ? row['UWAGI '] : [],
            UWAGI_Z_FAKTURY: '',
            STATUS_SPRAWY_WINDYKACJA: row['Status sprawy Windykcja\n'] ? row['Status sprawy Windykcja\n'] : '',
            DZIALANIA: row['DZIAŁANIA'] ? row['DZIAŁANIA'] : 'BRAK',
            JAKA_KANCELARIA: row['Jaka Kancelaria'] ? row['Jaka Kancelaria'] : 'BRAK',
            STATUS_SPRAWY_KANCELARIA: row['STATUS SPRAWY KANCELARIA'] ? row['STATUS SPRAWY KANCELARIA'] : '',
            KOMENTARZ_KANCELARIA_BECARED: row['KOMENTARZ KANCELARIA'] ? row['KOMENTARZ KANCELARIA'] : '',
            DATA_KOMENTARZA_BECARED: row['DATA KOMENTARZA BECARED'] ? excelDateToISODate(row['DATA KOMENTARZA BECARED']).toString() : '',
            NUMER_SPRAWY_BECARED: row['NUMER SPRAWY'] ? row['NUMER SPRAWY'] : '',
            KWOTA_WINDYKOWANA_BECARED: row['KWOTA WINDYKOWANA \n'] ? row['KWOTA WINDYKOWANA \n'] : '',
            BLAD_DORADCY: "NIE",
            BLAD_W_DOKUMENTACJI: "NIE",
            POBRANO_VAT: "Nie dotyczy",
            ZAZNACZ_KONTRAHENTA: "Nie"
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

// funkcja która dodaje dane z z pliku dokumenty autostacja
const ASFile = async (documents, res) => {

    if (
        !documents[0]['NUMER'] &&
        !documents[0]['WYSTAWIONO'] &&
        !documents[0]['W. BRUTTO'] &&
        !documents[0]['W. NETTO'] &&
        !documents[0]['NR REJESTRACYJNY'] &&
        !documents[0]['KONTRAHENT'] &&
        !documents[0]['PRZYGOTOWAŁ'] &&
        !documents[0]['NR SZKODY'] &&
        !documents[0]['UWAGI']
    ) {
        return res.status(500).json({ error: "Invalid file" });
    }

    try {
        const allDocuments = await Document.find({});
        const allSettlements = await UpdateDB.find({}, { settlements: 1 });
        const settlements = allSettlements[0].settlements;

        let DZIAL = '';
        let ASYSTENTKA = '';
        // szukam brakujących faktur w bazie danych
        const filteredDocuments = [];
        for (const document of documents) {

            const found = allDocuments.find(doc => doc.NUMER_FV === document.NUMER);

            if (!found) {
                const indexD = document.NUMER.lastIndexOf('D');
                const DZIAL_NR = document.NUMER.substring(indexD);
                if (DZIAL_NR === "D8") {
                    ASYSTENTKA = 'Ela / Jurek';
                    DZIAL = "D08";
                }
                if (DZIAL_NR === "D38") {
                    ASYSTENTKA = 'Jola / Ania';
                    DZIAL = "D38";
                }
                if (DZIAL_NR === "D48" || DZIAL_NR === "D58") {
                    ASYSTENTKA = 'Jola / Ania';
                    DZIAL = "D48/D58";
                }
                if (DZIAL_NR === "D68" || DZIAL_NR === "D78") {
                    ASYSTENTKA = 'Jola / Ania';
                    DZIAL = "D68/D78";
                }
                if (DZIAL_NR === "D88") {
                    ASYSTENTKA = 'Dawid Antosik';
                    DZIAL = "D88";
                }
                if (DZIAL_NR === "D98") {
                    ASYSTENTKA = 'Dawid Antosik';
                    DZIAL = "D98";
                }
                if (DZIAL_NR === "D118" || DZIAL_NR === "D148" || DZIAL_NR === "D168") {
                    ASYSTENTKA = 'Marta Bednarek';
                    DZIAL = "D118/D148";
                }
                if (DZIAL_NR === "D308" || DZIAL_NR === "D318") {
                    ASYSTENTKA = 'Dawid Antosik';
                    DZIAL = "D308/D318";
                }
                filteredDocuments.push(document);
            }
        }

        // ta funkcja usuwa faktury których nie ma w bazie danych bo sa rozliczone, zmienić po otrzymaniu docelowego pliku, obecnie będzie trudno ze względu na brak informacji o terminie płatności 
        const newDocumentsToDB = [];
        for (const document of filteredDocuments) {
            const found = settlements.find(settlement => settlement.NUMER_FV === document.NUMER);
            if (found) {

                const newDocument = {
                    NUMER_FV: document['NUMER'],
                    DZIAL,
                    DATA_FV: document['WYSTAWIONO'] ? excelDateToISODate(document['WYSTAWIONO']).toString() : '',
                    TERMIN: found['TERMIN'] ? found['TERMIN'] : '',
                    BRUTTO: document['W. BRUTTO'],
                    NETTO: document['W. NETTO'],
                    DO_ROZLICZENIA: found['DO_ROZLICZENIA'],
                    "100_VAT": document['W. BRUTTO'] - document['W. NETTO'],
                    "50_VAT": (document['W. BRUTTO'] - document['W. NETTO']) / 2,
                    NR_REJESTRACYJNY: document['NR REJESTRACYJNY'] ? document['NR REJESTRACYJNY'] : '',
                    KONTRAHENT: document['KONTRAHENT'] ? document['KONTRAHENT'] : '',
                    ASYSTENTKA,
                    DORADCA: document['PRZYGOTOWAŁ'] ? document['PRZYGOTOWAŁ'] : '',
                    NR_SZKODY: document['NR SZKODY'] ? document['NR SZKODY'] : '',
                    UWAGI_ASYSTENT: [],
                    UWAGI_Z_FAKTURY: document['UWAGI'] ? document['UWAGI'] : "",
                    STATUS_SPRAWY_WINDYKACJA: '',
                    DZIALANIA: 'BRAK',
                    JAKA_KANCELARIA: 'BRAK',
                    STATUS_SPRAWY_KANCELARIA: '',
                    KOMENTARZ_KANCELARIA_BECARED: '',
                    DATA_KOMENTARZA_BECARED: '',
                    NUMER_SPRAWY_BECARED: '',
                    KWOTA_WINDYKOWANA_BECARED: '',
                    BLAD_DORADCY: "NIE",
                    BLAD_W_DOKUMENTACJI: "NIE",
                    POBRANO_VAT: "Nie dotyczy",
                    ZAZNACZ_KONTRAHENTA: "Nie",
                    CZY_PRZETERMINOWANE: ''

                };
                newDocumentsToDB.push(newDocument);
            }
        }
        const update = await Document.insertMany(newDocumentsToDB);


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
        for (const doc of allDocuments) {
            const found = cleanDocument.find(cleanDoc => cleanDoc.NUMER_FV === doc.NUMER_FV);
            if (found) {
                try {
                    const result = await Document.updateOne(
                        { NUMER_FV: doc.NUMER_FV },
                        { $set: { DO_ROZLICZENIA: found.DO_ROZLICZENIA } }
                    );
                } catch (error) {
                    console.error("Error while updating the document", error);
                }

            } else {
                try {
                    if (doc.DO_ROZLICZENIA !== 0) {
                        const result = await Document.updateOne(
                            { NUMER_FV: doc.NUMER_FV },
                            { $set: { DO_ROZLICZENIA: 0 } }
                        );
                    }

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

//chwilowa funckja do naprawienia danych w DB
const repairFile = async (rows, res) => {
    const allDocuments = await Document.find({});

    // const filteredArray = allDocuments.map(doc => {
    //     if (doc.UWAGI_ASYSTENT) {
    //         const filteredUwagi = doc.UWAGI_ASYSTENT.filter(uwaga => uwaga.length > 0);
    //         return {
    //             NUMER_FV: doc.NUMER_FV,
    //             UWAGI_ASYSTENT: filteredUwagi
    //         };
    //     }
    // });

    // console.log(filteredArray);

    // const testDate = rows.map(row => {
    //     let fv_date = new Date(row['DATA_FV']);
    //     fv_date.setDate(fv_date.getDate() - 1);
    //     let new_date_str = fv_date.toISOString().split('T')[0];

    //     let termin_date = new Date(row['TERMIN']);
    //     termin_date.setDate(termin_date.getDate() - 1);

    //     let new_termin_str = termin_date.toISOString().split('T')[0];

    //     if (row['DZIALANIA'].length < 2) {

    //         return {
    //             NUMER_FV: row['NUMER_FV'],
    //             // DATA_FV: new_date_str,
    //             // TERMIN: new_termin_str,
    //             CZY_PRZETERMINOWANE: "",
    //             // JAKA_KANCELARIA: row['JAKA_KANCELARIA'] ? row['JAKA_KANCELARIA'] : "BRAK"
    //         };

    //     }

    // }).filter(Boolean);

    const filteredD98 = allDocuments.map(document => {
        const indexD = document.NUMER_FV.lastIndexOf('D');
        const DZIAL_NR = document.NUMER_FV.substring(indexD);
        if (DZIAL_NR === "D98") {
            return {
                NUMER_FV: document.NUMER_FV,
                // DZIAL: DZIAL_NR
                DZIAL: 'D98'
            };
        }
    }).filter(Boolean);

    console.log(filteredD98);


    for (const doc of filteredD98) {


        if (true) {
            try {
                // const result = await Document.updateOne(
                //     { NUMER_FV: doc.NUMER_FV },
                //     {
                //         $set: {
                //             DZIAL: doc.DZIAL,
                //         }
                //     }
                // );
            } catch (error) {
                console.error("Error while updating the document", error);
            }
        }
    }

    res.end();
};

// dodawnie danych do bazy z pliku excel
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

        else if (type === "test") {
            return repairFile(rows, res);
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