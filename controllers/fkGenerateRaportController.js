const FKRaport = require("../model/FKRaport");
const UpdateDB = require("../model/UpdateDB");

const { logEvents } = require("../middleware/logEvents");

const generateRaport = async (req, res) => {
  try {
    // pobieram przygotowane działy, przypisanych ownerów, obszary, localizacje i poiekunów
    const resultItems = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          preparedItems: "$preparedItemsData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    // pobieram dane z pliku księgowego
    const resultFKAccountancy = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          fkAccountancy: "$data.FKAccountancy", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    // pobieram dane już przygotowanego raportu
    // const resultFKAData = await FKRaport.aggregate([
    //   {
    //     $project: {
    //       _id: 0, // Wyłączamy pole _id z wyniku
    //       FKData: "$data.FKData", // Wybieramy tylko pole FKData z pola data
    //     },
    //   },
    // ]);

    // pobieram przygotowane dane wiekowania
    const resultAging = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          aging: "$items.aging", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    // pobieram dane z rozrachunków
    const allSettlements = await UpdateDB.find({}, { settlements: 1 });

    // przypisuję działy które nie sa przygotowane do raportu
    let errorDepartments = [];

    // przypisuję rozrachunki które dane nie znalazły sie w rozrachunkach
    let errorSettlements = [];

    // przypisuję wiekowanie które  nie znalazły sie w w raporcie z owodu jakiegoś błędu
    let errorAging = [];

    const fkAccountancyItems = [...resultFKAccountancy[0].fkAccountancy];
    const preparedItems = [...resultItems[0].preparedItems];
    // const itemsFKData = [...resultFKAData[0].FKData];
    const settlementItems = [...allSettlements[0].settlements];
    const preparedAging = [...resultAging[0].aging];

    // do danych z pliku księgowego przypisuję wcześniej przygotowane dane działów
    const preparedDataDep = fkAccountancyItems.map((item) => {
      const matchingDepItem = preparedItems.find(
        (preparedItem) => preparedItem.department === item.DZIAL
      );

      if (matchingDepItem) {
        const { _id, ...rest } = item;
        return {
          ...rest,
          OWNER:
            matchingDepItem.owner.length === 1
              ? matchingDepItem.owner[0]
              : Array.isArray(matchingDepItem.owner) // Sprawdzamy, czy matchingDepItem.area jest tablicą
              ? matchingDepItem.owner.join("/") // Jeśli jest tablicą, używamy join
              : matchingDepItem.owner,
          LOKALIZACJA: matchingDepItem.localization,
          OBSZAR: matchingDepItem.area,
          OPIEKUN_OBSZARU_CENTRALI:
            matchingDepItem.guardian.length === 1
              ? matchingDepItem.guardian[0]
              : Array.isArray(matchingDepItem.guardian)
              ? matchingDepItem.guardian.join(" / ")
              : matchingDepItem.guardian,
        };
      } else {
        errorDepartments.push(item.DZIAL);
        return item;
      }
    });

    // dodaję datę wystawienia (jeśli jest w rozrachunkach) sfaktury do dokumentów, bez zmiany rozliczenia wg najnowszych danych
    // preparedDataDep.forEach((item, index) => {
    //   const matchingSettlement = settlementItems.find(
    //     (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
    //   );

    //   if (matchingSettlement) {
    //     preparedDataDep[index].DATA_WYSTAWIENIA_FV =
    //       matchingSettlement.DATA_WYSTAWIENIA_FV;
    //   } else {
    //     preparedDataDep[index].DATA_WYSTAWIENIA_FV = "";
    //   }
    // });

    // do preparedDataDep przypisuję dane z rozrachunków, datę fv i do rozliczenia
    const preparedDataSettlements = preparedDataDep.map((item) => {
      const matchingSettlemnt = settlementItems.find(
        (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
      );
      if (matchingSettlemnt) {
        return {
          ...item,
          DATA_WYSTAWIENIA_FV: matchingSettlemnt.DATA_WYSTAWIENIA_FV,
          DO_ROZLICZENIA_AS:
            item.TYP_DOKUMENTU === "Korekta zaliczki" ||
            item.TYP_DOKUMENTU === "Korekta"
              ? matchingSettlemnt.ZOBOWIAZANIA
              : matchingSettlemnt.KWOTA_DO_ROZLICZENIA_FK,
        };
      } else {
        errorSettlements.push(item.NR_DOKUMENTU);
        return {
          ...item,
          DATA_WYSTAWIENIA_FV: "1900-01-01",
          DO_ROZLICZENIA_AS:
            item.DZIAL !== "KSIĘGOWOŚĆ" ? 0 : item.KWOTA_DO_ROZLICZENIA_FK,
        };
      }
    });

    // dodaję wiekowanie wg wcześniej przygotowanych opcji
    const preparedDataAging = preparedDataSettlements.map((item) => {
      const todayDate = new Date();
      const documentDate = new Date(item.DATA_WYSTAWIENIA_FV);
      const documentDatePayment = new Date(item.TERMIN_PLATNOSCI_FV);
      // Różnica w milisekundach
      const differenceInMilliseconds =
        todayDate.getTime() - documentDatePayment.getTime();

      // Konwersja różnicy na dni
      const differenceInDays = (
        differenceInMilliseconds /
        (1000 * 60 * 60 * 24)
      ).toFixed();

      const differenceInMillisecondsDocument =
        documentDatePayment.getTime() - documentDate.getTime();

      const differenceInDaysDocument = (
        differenceInMillisecondsDocument /
        (1000 * 60 * 60 * 24)
      ).toFixed();
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
        errorAging.push(item.NR_DOKUMENTU);
      }
      return {
        ...item,
        PRZEDZIAL_WIEKOWANIE: title,
        PRZETER_NIEPRZETER:
          differenceInDays > 0 ? "Przeterminowane" : "Nieprzeterminowane",
        ILE_DNI_NA_PLATNOSC_FV: Number(differenceInDaysDocument),
      };
    });

    // console.log(preparedAging);

    res.json({
      errorDepartments,
      errorSettlements,
      errorAging,
      preparedDataSettlements,
      preparedDataDep,
      preparedDataAging,
      settlementItems,
    });
  } catch (error) {
    logEvents(
      `generateFKRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    console.error(error);
    res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  generateRaport,
};
