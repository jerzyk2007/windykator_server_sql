// const FKRaport = require("../model/FKRaport");
const FKRaport = require("../model/FKRaport");
const { read, utils } = require("xlsx");
const { logEvents } = require("../middleware/logEvents");

// Funkcja do konwersji daty z formatu Excel na "yyyy-mm-dd"
const excelDateToISODate = (excelDate) => {
  // const date = new Date((excelDate - (25567 + 1)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  const date = new Date((excelDate - (25567 + 2)) * 86400 * 1000); // Konwersja z formatu Excel do milisekund
  return date.toISOString().split("T")[0]; // Pobranie daty w formacie "yyyy-mm-dd"
};

// funkcja wykonuje sprawdzenie czy data jest sformatowana w excelu czy zwykły string
const isExcelDate = (value) => {
  // Sprawdź, czy wartość jest liczbą i jest większa od zera (Excelowa data to liczba większa od zera)
  if (typeof value === "number" && value > 0) {
    // Sprawdź, czy wartość mieści się w zakresie typowych wartości dat w Excelu
    return value >= 0 && value <= 2958465; // Zakres dat w Excelu: od 0 (1900-01-01) do 2958465 (9999-12-31)
  }

  return false;
};

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

    if (
      !rows[0]["TYP DOK."] &&
      !rows[0]["NUMER DOKUMENTU"] &&
      !rows[0]["DZIAŁ"] &&
      !rows[0]["KONTRAHENT"] &&
      !rows[0]["RODZAJ KONTA"] &&
      !rows[0][" KWOTA DO ROZLICZENIA FK "] &&
      !rows[0]["   DO ROZLICZENIA AS3 (2024-03-12)  "] &&
      !rows[0][" UWAGI DAWID-  "]
    ) {
      return res.status(500).json({ error: "Invalid file" });
    }

    const updateRows = rows.map((row) => {
      return {
        TYP_DOK: row["TYP DOK."],
        NR_DOKUMENTU: row["NUMER DOKUMENTU"],
        DZIAL: row["DZIAŁ"],
        KONTRAHENT: row["KONTRAHENT"],
        RODZAJ_KONTA: row["RODZAJ KONTA"],
        KWOTA_DO_ROZLICZENIA_FK: row[" KWOTA DO ROZLICZENIA FK "],
        DO_ROZLICZENIA_AS: row["   DO ROZLICZENIA AS3 (2024-03-12)  "],
        ROZNICA:
          row[" KWOTA DO ROZLICZENIA FK "] -
          row["   DO ROZLICZENIA AS3 (2024-03-12)  "],
        DATA_ROZLICZENIA_AS:
          row["  DATA ROZLICZENIA W AS3  "] &&
          row["  DATA ROZLICZENIA W AS3  "] !== "BRAK"
            ? excelDateToISODate(
                row["  DATA ROZLICZENIA W AS3  "],
                row["NUMER DOKUMENTU"]
              )
            : "",
        UWAGI_DAWID: row[" UWAGI DAWID-  "],
        DATA_WYSTAWIENIA_FV:
          row["DATA WYSTAWIENIA FV"] && row["DATA WYSTAWIENIA FV"] !== "BRAK"
            ? excelDateToISODate(row["DATA WYSTAWIENIA FV"])
            : "",
        TERMIN_PLATNOSCI_FV:
          row["TERMIN PŁATNOŚCI"] && row["TERMIN PŁATNOŚCI"] !== "BRAK"
            ? excelDateToISODate(row["TERMIN PŁATNOŚCI"])
            : "",
        ILE_DNI_NA_PLATNOSC_FV: row["ILOŚĆ DNI NA PŁATNOŚĆ"],
        PRZETER_NIEPRZETER: row["PRZETERMINOWANE/NIEPRZETERMINOWANE"],
        PRZEDZIAL_WIEKOWANIE: row["PRZEDZIAŁ"],
        NR_KLIENTA: row["Nr klienta"],
        JAKA_KANCELARIA: row["JAKA KANCELARIA"],
        ETAP_SPRAWY: row["ETAP SPRAWY"],
        KWOTA_WPS: row[" Kwota WPS "],
        CZY_W_KANCELARI: row["CZY KANCELARIA\r\nTAK/ NIE"],
        OBSZAR: row[" OBSZAR "],
        CZY_SAMOCHOD_WYDANY_AS: row["CZY SAMOCHÓD WYDANY (dane As3)"],
        OWNER: row["OWNER"],
        OPIENKUN_OBSZARU_CENTRALI: row["OPIEKUN OBSZARU Z CENTRALI"],
        KONTRAHENT_CZARNA_LISTA: row["CZY KONTRAHNET NA CZARNEJ LIŚCIE"],
      };
    });

    const update = await FKRaport.updateOne(
      {},
      {
        $set: { "data.FKData": updateRows }, // Ustaw nowe dane dla pola data.FKData, nadpisując stare dane
      },
      { upsert: true }
    );

    res.json("Updated data");
  } catch (error) {
    logEvents(
      `fkRaportController, documentsFromFile: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika
const getData = async (req, res) => {
  const { filter } = req.body;

  try {
    // const result = await FKRaport.find({});
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          FKData: "$data.FKData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    const FKJSON = JSON.stringify(result[0].FKData);
    let FKObject = JSON.parse(FKJSON);

    if (filter.business !== "201203") {
      FKObject = FKObject.filter(
        (item) => item.RODZAJ_KONTA === Number(filter.business)
      );
    }

    if (filter.payment !== "Wszystko") {
      if (filter.payment === "Przeterminowane") {
        FKObject = FKObject.filter(
          (item) => item.PRZETER_NIEPRZETER === "PRZETERMINOWANE"
        );
      } else if (filter.payment === "Nieprzeterminowane") {
        FKObject = FKObject.filter(
          (item) => item.PRZETER_NIEPRZETER === "NIEPRZETERMINOWANE"
        );
      }
    }

    if (filter.actions !== "All") {
      if (filter.actions === "Tak") {
        FKObject = FKObject.filter((item) => item.CZY_W_KANCELARI === "TAK");
      }

      if (filter.actions === "Nie") {
        FKObject = FKObject.filter((item) => item.CZY_W_KANCELARI === "NIE");
      }
    } else if (filter.actions === "All") {
      FKObject = FKObject.filter((item) => item.CZY_W_KANCELARI === "TAK");
    }

    res.json(FKObject);
  } catch (error) {
    logEvents(`fkRaportController, getData: ${error}`, "reqServerErrors.txt");
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// pobiera wszystkie klucze z pierwszego documentu żeby mozna było nazwy, filtry i ustawienia kolumn edytować, głównie chodzi o nowo dodane kolumny
const getNewColumns = async (req, res) => {
  try {
    // const result = await FKRaport.findOne();
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          FKData: "$data.FKData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    const firstDocument = result[0].FKData[0];

    if (firstDocument) {
      // Pobierz klucze z pierwszego dokumentu i umieść je w tablicy
      const keysArray = Object.keys(firstDocument);

      const newArray = keysArray.filter(
        (item) => item !== "_id" && item !== "__v"
      );

      res.json(newArray);
    } else {
      return res.status(400).json({ error: "Empty collection." });
    }
  } catch (error) {
    logEvents(
      `fkRaportController, getNewColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja która ma zmienić ustawienia poszczególnych kolumn użytkownika, jeśli zostaną zmienione globalne ustawienia tej kolumny
const changeColumns = async (req, res) => {
  const { columns } = req.body;
  const updateColumns = { tableSettings: { columns } };
  try {
    const result = await FKRaport.updateOne(
      {},
      { $set: updateColumns },
      { new: true, upsert: true }
    );

    res.end();
  } catch (error) {
    logEvents(
      `fkRaportController, changeColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

//funkcja która pobiera kolumny które już zostały zapisane i zmodyfikowane
const getColumns = async (req, res) => {
  try {
    const result = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          columns: "$tableSettings.columns", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    res.json(result[0].columns);
  } catch (error) {
    logEvents(
      `fkRaportController, getColumns: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  documentsFromFile,
  getData,
  getNewColumns,
  changeColumns,
  getColumns,
};
