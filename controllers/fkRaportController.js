const FKRaport = require('../model/FKRaport');
const { read, utils } = require('xlsx');


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


        const result = await FKRaport.updateOne(
            {},
            { $set: { FKData: rows } },
            { upsert: true }
        );

        res.json('ok');

    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

const getData = async (req, res) => {
    try {
        const result = await FKRaport.find({});

        const FKJSON = JSON.stringify(result[0].FKData);
        const FKObject = JSON.parse(FKJSON);
        res.json(FKObject);
    }
    catch (error) {
        console.error(error);
        res.status(500).json({ error: 'Server error' });
    }
};

module.exports = {
    documentsFromFile,
    getData
};