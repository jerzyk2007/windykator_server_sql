const bcryptjs = require("bcryptjs");
const crypto = require("crypto");

const dzialMap = {
  D048: "D048/D058",
  D058: "D048/D058",
  D068: "D068/D078",
  D078: "D068/D078",
  D118: "D118/D148",
  D148: "D118/D148",
  D168: "D118/D148",
  D308: "D308/D318",
  D318: "D308/D318",
};

const raportSettings = {
  raportAdvisers:
    '{"size":{},"visible":{"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DORADCA","DZIAL","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","CEL_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
  raportDepartments:
    '{"size":{},"visible":{"CEL_BEZ_PZU_LINK4":false,"PRZETERMINOWANE_BEZ_PZU_LINK4":false,"ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4":false,"NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4":false,"KWOTA_NIEPOBRANYCH_VAT":false,"ILE_NIEPOBRANYCH_VAT":false,"KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI":false,"ILE_BLEDOW_DORADCY_I_DOKUMENTACJI":false},"density":"comfortable","order":["DZIALY","CEL","CEL_BEZ_PZU_LINK4","PRZETERMINOWANE_BEZ_PZU_LINK4","ILOSC_PRZETERMINOWANYCH_FV_BEZ_PZU_LINK4","NIEPRZETERMINOWANE_FV_BEZ_PZU_LINK4","CEL_CALOSC","PRZETERMINOWANE_FV","ILOSC_PRZETERMINOWANYCH_FV","NIEPRZETERMINOWANE_FV","CEL_BEZ_KANCELARII","PRZETERMINOWANE_BEZ_KANCELARII","ILOSC_PRZETERMINOWANYCH_FV_BEZ_KANCELARII","NIEPRZETERMINOWANE_FV_BEZ_KANCELARII","KWOTA_NIEPOBRANYCH_VAT","ILE_NIEPOBRANYCH_VAT","KWOTA_BLEDOW_DORADCY_I_DOKUMENTACJI","ILE_BLEDOW_DORADCY_I_DOKUMENTACJI","mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
};

const newUserTableSettings = {
  size: {
    NIP: 100,
    VIN: 100,
    AREA: 100,
    DZIAL: 100,
    NETTO: 100,
    BRUTTO: 111,
    TERMIN: 122,
    DATA_FV: 140,
    DORADCA: 100,
    NUMER_FV: 194,
    KONTRAHENT: 270,
    BLAD_DORADCY: 100,
    TYP_PLATNOSCI: 100,
    DO_ROZLICZENIA: 136,
    UWAGI_ASYSTENT: 250,
    JAKA_KANCELARIA: 100,
    UWAGI_Z_FAKTURY: 100,
    NR_REJESTRACYJNY: 100,
    DATA_WYDANIA_AUTA: 100,
    INFORMACJA_ZARZAD: 192,
    CZY_PRZETERMINOWANE: 100,
    ILE_DNI_PO_TERMINIE: 111,
    ZAZNACZ_KONTRAHENTA: 100,
    OSTATECZNA_DATA_ROZLICZENIA: 230,
  },
  order: [
    "NUMER_FV",
    "DATA_FV",
    "TERMIN",
    "ILE_DNI_PO_TERMINIE",
    "BRUTTO",
    "DO_ROZLICZENIA",
    "KONTRAHENT",
    "UWAGI_ASYSTENT",
    "AREA",
    "BLAD_DORADCY",
    "CZY_PRZETERMINOWANE",
    "DATA_WYDANIA_AUTA",
    "DORADCA",
    "DZIAL",
    "INFORMACJA_ZARZAD",
    "JAKA_KANCELARIA",
    "NETTO",
    "NIP",
    "NR_REJESTRACYJNY",
    "OSTATECZNA_DATA_ROZLICZENIA",
    "TYP_PLATNOSCI",
    "UWAGI_Z_FAKTURY",
    "VIN",
    "ZAZNACZ_KONTRAHENTA",
    "mrt-row-spacer",
  ],
  pinning: {
    left: ["NUMER_FV"],
    right: [],
  },
  visible: {
    NIP: false,
    VIN: false,
    AREA: false,
    DZIAL: false,
    NETTO: false,
    BRUTTO: true,
    TERMIN: true,
    DATA_FV: true,
    DORADCA: false,
    NUMER_FV: true,
    KONTRAHENT: true,
    BLAD_DORADCY: false,
    TYP_PLATNOSCI: false,
    DO_ROZLICZENIA: true,
    UWAGI_ASYSTENT: true,
    JAKA_KANCELARIA: false,
    UWAGI_Z_FAKTURY: false,
    NR_REJESTRACYJNY: false,
    DATA_WYDANIA_AUTA: false,
    INFORMACJA_ZARZAD: false,
    CZY_PRZETERMINOWANE: false,
    ILE_DNI_PO_TERMINIE: true,
    ZAZNACZ_KONTRAHENTA: false,
    OSTATECZNA_DATA_ROZLICZENIA: false,
  },
  pagination: {
    pageSize: 30,
    pageIndex: 0,
  },
};

// const addDepartment = (documents) => {
//     return documents
//         .map((document) => {
//             const match = document.NUMER?.match(/D(\d+)/);
//             if (match) {
//                 const dzialNumber = match[1].padStart(3, "0"); // Wypełnia do trzech cyfr
//                 return {
//                     ...document,
//                     DZIAL: dzialMap[`D${dzialNumber}`]
//                         ? dzialMap[`D${dzialNumber}`]
//                         : `D${dzialNumber}`, // Tworzy nową wartość z "D" i trzema cyframi
//                 };
//             } else {
//                 return {
//                     ...document,
//                     DZIAL: "KSIĘGOWOŚĆ", // Domyślna wartość, jeśli nie można wygenerować nazwy
//                 };
//             }
//         })
//         .filter(Boolean); // Usuwa undefined z tablicy
// };

const addDepartment = (documents) => {
  return documents.map((document) => {
    // Jeśli MARKER = 'RAC', ustaw DZIAL = 'RAC'
    if (document.MARKER === "RAC") {
      return {
        ...document,
        DZIAL: "RAC",
      };
    }

    // Jeżeli numer faktury pasuje do wzorca Dxxx
    const match = document.NUMER?.match(/D(\d+)/);
    if (match) {
      const dzialNumber = match[1].padStart(3, "0"); // Wypełnia do trzech cyfr
      return {
        ...document,
        DZIAL: dzialMap[`D${dzialNumber}`]
          ? dzialMap[`D${dzialNumber}`]
          : `D${dzialNumber}`, // np. D001, D118
      };
    }

    // Domyślna wartość, jeśli nie pasuje żaden warunek
    return {
      ...document,
      DZIAL: "KSIĘGOWOŚĆ",
    };
  });
};

// zamiana daty na format yyyy-mm-dd
const checkDate = (data) => {
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0"); // Dodajemy +1, bo miesiące są liczone od 0
  const day = String(data.getDate()).padStart(2, "0");
  const yearNow = `${year}-${month}-${day}`;
  return yearNow;
};

// zamiana godziny na format hh-mm
const checkTime = (data) => {
  const hour = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  const timeNow = `${hour}:${min}`;

  return timeNow;
};

// nadaje nazwę dla typu dokumentów np. faktura, korekta, inne ...
const documentsType = (data) => {
  let documentsType = "";
  if (data.includes("KF/ZAL")) {
    documentsType = "Korekta zaliczki";
  } else if (data.includes("KF/")) {
    documentsType = "Korekta";
  } else if (data.includes("KP/")) {
    documentsType = "KP";
  } else if (data.includes("NO/")) {
    documentsType = "Nota";
  } else if (data.includes("PP/")) {
    documentsType = "Paragon";
  } else if (data.includes("PK")) {
    documentsType = "PK";
  } else if (data.includes("IP/")) {
    documentsType = "Karta Płatnicza";
  } else if (data.includes("FV/ZAL")) {
    documentsType = "Faktura zaliczkowa";
  } else if (data.includes("FV/")) {
    documentsType = "Faktura";
  } else {
    documentsType = "Inne";
  }

  return documentsType;
};

const generatePassword = async (length = 12) => {
  const chars = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    special: "!@#$%",
  };

  const getRandomChar = (set) => set[crypto.randomInt(0, set.length)];

  let password = [
    getRandomChar(chars.lower),
    getRandomChar(chars.upper),
    getRandomChar(chars.digits),
    getRandomChar(chars.special),
    ...Array.from({ length: length - 4 }, () =>
      getRandomChar(Object.values(chars).join(""))
    ),
  ]
    .sort(() => Math.random() - 0.5)
    .join("");

  const hashedPwd = await bcryptjs.hash(password, 10);

  return {
    password,
    hashedPwd,
  };
};

module.exports = {
  addDepartment,
  checkDate,
  checkTime,
  raportSettings,
  newUserTableSettings,
  documentsType,
  generatePassword,
};
