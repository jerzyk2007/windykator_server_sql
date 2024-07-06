const { FKRaport, FKDataRaport } = require("../model/FKRaport");
const UpdateDB = require("../model/UpdateDB");
const Document = require("../model/Document");

const { logEvents } = require("../middleware/logEvents");

//pobieranie danych FK (wstępnie obrobionych przez dodawanie danych z kolejnych plików excel) do front żeby odciążyć
const getPreparedItems = async (req, res) => {
  try {
    // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i opiekunów
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedItems = [...resultItems[0].preparedItems];
    res.json(preparedItems);
  } catch (error) {
    logEvents(`getPreparedItems, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// zapis do DB po zmianach i wczytaniu kolejnych plików excel
const savePreparedData = async (req, res) => {
  const { type, data, counter } = req.body;
  if (!type || !data) {
    return res.status(500).json({ error: "Server error" });
  }
  try {
    // usunięcie danych
    await FKRaport.updateMany({}, { $unset: { preparedRaportData: 1 } });

    //zapis do db
    await FKRaport.updateOne(
      {},
      { $set: { preparedRaportData: data } },
      { upsert: true }
    );

    // zapis daty i ilości danych zapisanych do DB
    const dateObj = new Date();
    // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter,
    };

    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          [`updateDate.${type}`]: updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );

    res.end();
  } catch (error) {
    logEvents(`savePreparedData, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera  wcześniej przygotowane dane z raportData
const getPreparedData = async (req, res) => {
  try {
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];
    res.json(preparedData);
  } catch (error) {
    logEvents(`getPreparedData, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// pobiera wszytskie dane z raportu BL do dalszej obróbki dla raportu FK
const getDocumentsBL = async (req, res) => {
  try {
    const result = await Document.find({});
    res.json(result);
  } catch (error) {
    logEvents(`getDocumentsBL, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

// pobieram przygotowane dane, przygotowane wiekowania, ownerzy, rozrachunki do wygenerowania raportu
const dataToGenerateRaport = async (req, res) => {
  try {
    // pobieram przygotowane dane z plików excel
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];
    const preparedDataWithoutId = preparedData.map(({ _id, ...rest }) => rest);

    //pobieram rozrachunki z raportu BL
    const allSettlements = await UpdateDB.find({}, { settlements: 1 });
    const settlementItems = [...allSettlements[0].settlements];
    //usuwam zbędne rozrachunki nie występujące w raporcie FK
    const filteredSettlements = settlementItems.filter((item) => {
      return preparedDataWithoutId.some(
        (data) => data.NR_DOKUMENTU === item.NUMER_FV
      );
    });

    // poberam dane wiekowanie
    const resultAging = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedAging = [...resultAging[0].aging];

    // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i poiekunów
    const items = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedItems = [...items[0].preparedItems];

    res.json({
      dataFK: preparedDataWithoutId,
      settlements: filteredSettlements,
      aging: preparedAging,
      items: preparedItems,
    });
  } catch (error) {
    logEvents(
      `dataToGenerateRaport, caseStatus: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

const saveRaportFK = async (req, res) => {
  try {
    const { dataRaport } = req.body;

    // zapis do DB po zmianach
    await FKDataRaport.findOneAndUpdate(
      {},
      {
        $set: {
          FKDataRaports: dataRaport,
        },
      },
      {
        returnOriginal: false,
        upsert: true,
      }
    );

    const dateObj = new Date();
    // Pobieramy poszczególne elementy daty i czasu
    const day = dateObj.getDate().toString().padStart(2, "0"); // Dzień
    const month = (dateObj.getMonth() + 1).toString().padStart(2, "0"); // Miesiąc (numerowany od 0)
    const year = dateObj.getFullYear(); // Rok

    // Formatujemy datę i czas według wymagań
    const actualDate = `${day}-${month}-${year}`;

    const updateDate = {
      date: actualDate,
      counter: dataRaport.length,
    };

    await FKRaport.findOneAndUpdate(
      {}, // Warunek wyszukiwania (pusty obiekt oznacza wszystkie dokumenty)
      {
        $set: {
          "updateDate.genrateRaport": updateDate,
        },
      }, // Nowe dane, które mają zostać ustawione
      {
        upsert: true, // Opcja upsert: true pozwala na automatyczne dodanie nowego dokumentu, jeśli nie zostanie znaleziony pasujący dokument
        returnOriginal: false, // Opcja returnOriginal: false powoduje zwrócenie zaktualizowanego dokumentu, a nie oryginalnego dokumentu
      }
    );
    res.end();
  } catch (error) {
    logEvents(`saveRaportFK, caseStatus: ${error}`, "reqServerErrors.txt");
    console.error(error);
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getPreparedItems,
  savePreparedData,
  getPreparedData,
  getDocumentsBL,
  dataToGenerateRaport,
  saveRaportFK,
};
