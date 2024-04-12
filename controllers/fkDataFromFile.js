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

// Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
const excelDateToISODate = (excelDate) => {
  // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
};

// tutaj będzie zapis danych z pliku z księgowości
const accountancyData = async (rows, res) => {
  try {
    const update = rows.map((row) => {
      const indexD = row["Nr. dokumentu"].lastIndexOf("D");
      let DZIAL_NR = "";
      // if (indexD === -1) {
      if (
        indexD === -1 ||
        indexD === row["Nr. dokumentu"].length - 1 ||
        isNaN(parseInt(row["Nr. dokumentu"][indexD + 1]))
      ) {
        DZIAL_NR = "KSIĘGOWOŚĆ";
      } else {
        DZIAL_NR = row["Nr. dokumentu"].substring(indexD);
        if (DZIAL_NR.includes("/")) {
          // console.log(row);

          // Jeśli tak, to usuwamy znak '/' i wszystko co po nim
          DZIAL_NR = DZIAL_NR.split("/")[0];
        }
      }
      return {
        NR_DOKUMENTU: row["Nr. dokumentu"],
        DZIAL: DZIAL_NR,
        KONTRAHENT: row["Kontrahent"],
        DO_ROZLICZENIA_FK: row["Płatność"],
        TERMIN_PLATNOSCI: excelDateToISODate(row["Data płatn."]),
        KONTO: row["Synt."],
      };
    });

    update.forEach((obiekt) => {
      if (
        obiekt.DZIAL &&
        obiekt.DZIAL.startsWith("D") &&
        obiekt.DZIAL.length < 4
      ) {
        let number = obiekt.DZIAL.substring(1); // Pobieramy cyfry po literze 'D'
        let newNumber;

        // Sprawdzamy długość numeru i wstawiamy odpowiednią liczbę zer
        if (number.length === 1) {
          newNumber = "00" + number;
          // console.log(newNumber);
        } else if (number.length === 2) {
          newNumber = "0" + number;
        }

        // Zmieniamy wartość klucza 'DZIAL' na nową wartość z dodanymi zerami
        if (newNumber) {
          obiekt.DZIAL = "D" + newNumber;
        }
      }
    });
    // update.forEach((item) => {
    //   if (item.DZIAL === "D68/S") {
    //     console.log(item.NR_DOKUMENTU);
    //   }
    // });

    const result = await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "data.FKAccountancy": update,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );
  } catch (error) {
    logEvents(
      `fkDataFromFile, accountancyData: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const addDataFromFile = async (req, res) => {
  const { type } = req.params;
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

    if (
      !rows[0]["Nr. dokumentu"] &&
      !rows[0]["Kontrahent"] &&
      !rows[0]["Płatność"] &&
      !rows[0]["Data płatn."] &&
      !rows[0][["Synt."]]
    ) {
      return res.status(500).json({ error: "Invalid file" });
    }

    if (type === "accountancy") {
      accountancyData(rows, res);
    }

    res.end();
  } catch (error) {
    logEvents(
      `fkDataFromFile, addDataFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  addDataFromFile,
};
