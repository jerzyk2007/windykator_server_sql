const FKRaport = require("../model/FKRaport");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

// weryfikacja czy plik excel jest prawidłowy (czy nie jest podmienione rozszerzenie)
const isExcelFile = (data) => {
  const excelSignature = [0x50, 0x4b, 0x03, 0x04];
  for (let i = 0; i < excelSignature.length; i++) {
    if (data[i] !== excelSignature[i]) {
      return false;
    }
  }
  return true;
};

const documentsFromFile = async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "Not delivered file" });
  }
  try {
    const buffer = req.file.buffer;
    const data = new Uint8Array(buffer);

    if (!isExcelFile(data)) {
      return res.status(500).json({ error: "Invalid file" });
    }
    const workbook = read(buffer, { type: "buffer" });
    const workSheetName = workbook.SheetNames[0];
    const workSheet = workbook.Sheets[workSheetName];
    const rows = utils.sheet_to_json(workSheet, { header: 0, defval: null });

    const result = await FKRaport.updateOne(
      {},
      { $set: { FKData: rows } },
      { upsert: true }
    );

    res.json("ok");
  } catch (error) {
    logEvents(
      `fkRaportController, documentsFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const getData = async (req, res) => {
  console.log(req.query);
  try {
    const result = await FKRaport.find({});

    const FKJSON = JSON.stringify(result[0].FKData);
    const FKObject = JSON.parse(FKJSON);
    res.json(FKObject);

    // const transformedData = result[0].FKData.map((item) => {
    //   // Tworzymy nowy obiekt, w którym zmieniamy nazwy kluczy
    //   const newItem = {};
    //   for (const key in item) {
    //     if (key === "CZY KANCELARIA\r\nTAK/ NIE") {
    //       newItem["CZY KANCELARIA"] = item[key];
    //     } else {
    //       newItem[key] = item[key];
    //     }
    //   }
    //   return newItem;
    // });

    // // Teraz możesz zwrócić przekształcone dane
    // res.json(transformedData);
  } catch (error) {
    logEvents(`fkRaportController, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  documentsFromFile,
  getData,
};
