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
    const resultFKAData = await FKRaport.aggregate([
      {
        $project: {
          _id: 0, // Wyłączamy pole _id z wyniku
          FKData: "$data.FKData", // Wybieramy tylko pole FKData z pola data
        },
      },
    ]);

    // pobieram dane z rozrachunków
    const allSettlements = await UpdateDB.find({}, { settlements: 1 });

    // przypisuję działy które nie sa przygotowane do raportu
    let errorDepartments = [];

    // przypisuję które dane nie znalazły sie w rozrachunkach
    let errorSettlements = [];

    const fkAccountancyItems = [...resultFKAccountancy[0].fkAccountancy];
    const preparedItems = [...resultItems[0].preparedItems];
    const itemsFKData = [...resultFKAData[0].FKData];
    const settlementItems = [...allSettlements[0].settlements];

    // do danych z pliku księgowego przypisuję wcześniej przygotowane dane działów
    const preparedDataDep = fkAccountancyItems.map((item) => {
      const matchingDepItem = preparedItems.find(
        (preparedItem) => preparedItem.department === item.DZIAL
      );
      // console.log(matchingDepItem);

      if (matchingDepItem) {
        const { _id, ...rest } = item;
        return {
          ...rest,
          OWNER:
            matchingDepItem.owner.length === 1
              ? matchingDepItem.owner[0]
              : Array.isArray(matchingDepItem.owner) // Sprawdzamy, czy matchingDepItem.area jest tablicą
              ? matchingDepItem.owner.join(" / ") // Jeśli jest tablicą, używamy join
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

    // do preparedDataDep przypisuję dane z rozrachunków, termin płatności i do rozliczenia
    const preparedDataSettlements = preparedDataDep
      .map((item) => {
        const matchingSettlemnt = settlementItems.find(
          (preparedItem) => preparedItem.NUMER_FV === item.NR_DOKUMENTU
        );
        if (matchingSettlemnt) {
          return {
            ...item,
            TERMIN_PLATNOSCI_FV: matchingSettlemnt.TERMIN,
            DO_ROZLICZENIA_AS: matchingSettlemnt.DO_ROZLICZENIA,
          };
        } else {
          errorSettlements.push(item.NR_DOKUMENTU);
        }
      })
      .filter(Boolean);

    // console.log(preparedDataDep[0]);
    console.log(preparedDataSettlements);
    res.json({
      errorDepartments,
      errorSettlements,
      preparedDataSettlements,
      preparedDataDep,
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
