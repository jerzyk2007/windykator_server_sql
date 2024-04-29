const { FKRaport, FKDataRaport } = require("../model/FKRaport");
// const FKDataRaport = require("../model/FKRaportData");
const UpdateDB = require("../model/UpdateDB");

const { logEvents } = require("../middleware/logEvents");

const generateRaport = async (req, res) => {
  try {
    // pobieram wcześniej przygotowane dane z raportData
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

    const allSettlements = await UpdateDB.find({}, { settlements: 1 });

    const settlementItems = [...allSettlements[0].settlements];

    const preparedDataSettlements = preparedDataWithoutId.map((item) => {
      const matchingSettlemnt = settlementItems.find(
        (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
      );
      if (matchingSettlemnt && item.OBSZAR !== "BLACHARNIA") {
        return {
          ...item,
          DO_ROZLICZENIA_AS:
            item.TYP_DOKUMENTU === "Korekta zaliczki" ||
            item.TYP_DOKUMENTU === "Korekta"
              ? matchingSettlemnt.ZOBOWIAZANIA
              : matchingSettlemnt.DO_ROZLICZENIA,
          ROZNICA:
            item.TYP_DOKUMENTU === "Korekta zaliczki" ||
            item.TYP_DOKUMENTU === "Korekta"
              ? matchingSettlemnt.ZOBOWIAZANIA
              : matchingSettlemnt.DO_ROZLICZENIA - item.KWOTA_DO_ROZLICZENIA_FK,
          KWOTA_WPS: matchingSettlemnt.DO_ROZLICZENIA,
        };
      } else if (matchingSettlemnt && item.OBSZAR === "BLACHARNIA") {
        return {
          ...item,
          DO_ROZLICZENIA_AS:
            item.TYP_DOKUMENTU === "Korekta zaliczki" ||
            item.TYP_DOKUMENTU === "Korekta"
              ? matchingSettlemnt.ZOBOWIAZANIA
              : matchingSettlemnt.DO_ROZLICZENIA,
          ROZNICA:
            item.TYP_DOKUMENTU === "Korekta zaliczki" ||
            item.TYP_DOKUMENTU === "Korekta"
              ? matchingSettlemnt.ZOBOWIAZANIA
              : matchingSettlemnt.DO_ROZLICZENIA - item.KWOTA_DO_ROZLICZENIA_FK,
        };
      } else {
        return {
          ...item,
          DO_ROZLICZENIA_AS: 0,
          ROZNICA: item.KWOTA_DO_ROZLICZENIA_FK,
        };
      }
    });

    const resultAging = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    const preparedAging = [...resultAging[0].aging];

    // dodaję wiekowanie wg wcześniej przygotowanych opcji
    const preparedDataAging = preparedDataSettlements.map((item) => {
      const todayDate = new Date();
      const documentDate = new Date(item.DATA_WYSTAWIENIA_FV);
      const documentDatePayment = new Date(item.TERMIN_PLATNOSCI_FV);
      // Różnica w milisekundach
      const differenceInMilliseconds =
        todayDate.getTime() - documentDatePayment.getTime();

      // Konwersja różnicy na dni
      const differenceInDays = Math.floor(
        differenceInMilliseconds / (1000 * 60 * 60 * 24)
      );

      const differenceInMillisecondsDocument =
        documentDatePayment.getTime() - documentDate.getTime();

      const differenceInDaysDocument = Math.floor(
        differenceInMillisecondsDocument / (1000 * 60 * 60 * 24)
      );

      let title = "";

      for (const age of preparedAging) {
        if (
          age.type === "first" &&
          Number(age.firstValue) >= differenceInDays
        ) {
          title = age.title;
          foundMatchingAging = true;
          break;
        } else if (
          age.type === "last" &&
          Number(age.secondValue) <= differenceInDays
        ) {
          title = age.title;
          foundMatchingAging = true;
          break;
        } else if (
          age.type === "some" &&
          Number(age.firstValue) <= differenceInDays &&
          Number(age.secondValue) >= differenceInDays
        ) {
          title = age.title;
          foundMatchingAging = true;
          break;
        }
      }

      if (!foundMatchingAging) {
      }
      return {
        ...item,
        PRZEDZIAL_WIEKOWANIE: title,
        PRZETER_NIEPRZETER:
          differenceInDays > 0 ? "Przeterminowane" : "Nieprzeterminowane",
        ILE_DNI_NA_PLATNOSC_FV: Number(differenceInDaysDocument),
      };
    });

    // zapis do DB po zmianach
    await FKDataRaport.findOneAndUpdate(
      {},
      {
        $set: {
          FKDataRaports: preparedDataAging,
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
      counter: preparedDataAging.length,
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

    res.json(preparedDataAging);
  } catch (error) {
    logEvents(
      `generateFKRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

const checkRaportErrors = async (req, res) => {
  try {
    // pobieram wcześniej przygotowane dane z raportData
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedRaportData: "$preparedRaportData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);
    const preparedData = [...resultItems[0].preparedRaportData];

    const dataErrors = {
      areas: [],
      departments: [],
      localizations: [],
      owners: [],
      aging: [],
    };

    preparedData.forEach((item) => {
      if (!item.OBSZAR) {
        dataErrors.areas = [...dataErrors.areas, item.NR_DOKUMENTU];
      }
      if (!item.LOKALIZACJA) {
        dataErrors.localizations = [
          ...dataErrors.localizations,
          item.NR_DOKUMENTU,
        ];
      }
      if (!item.DZIAL) {
        dataErrors.departments = [...dataErrors.departments, item.NR_DOKUMENTU];
      }
      if (!item.OWNER) {
        dataErrors.owners = [...dataErrors.owners, item.NR_DOKUMENTU];
      }
      if (!item.PRZEDZIAL_WIEKOWANIE) {
        dataErrors.aging = [...dataErrors.aging, item.NR_DOKUMENTU];
      }
    });

    // sprawdzam czy do obiektu dataErrors zapisały się jakieś dane
    const checkError =
      Object.values(dataErrors).filter((errorArray) => errorArray.length > 0)
        .length > 0;

    if (checkError) {
      res.json({ check: dataErrors });
    } else {
      res.json({ check: "OK" });
    }
  } catch (error) {
    logEvents(
      `generateFKRaportController, checkRaportErrors: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  generateRaport,
  checkRaportErrors,
};
