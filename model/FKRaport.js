const mongoose = require("mongoose");
const { Schema } = mongoose;

const FKAllDataSchema = new Schema({
  preparedRaportData: [
    {
      CZY_SAMOCHOD_WYDANY_AS: {
        type: String,
      },
      CZY_W_KANCELARI: {
        type: String,
      },
      DATA_ROZLICZENIA_AS: {
        type: String,
      },
      DATA_WYDANIA_AUTA: {
        type: String,
      },
      DATA_WYSTAWIENIA_FV: {
        type: String,
      },
      DO_ROZLICZENIA_AS: {
        type: Number,
      },
      DZIAL: {
        type: String,
      },
      ETAP_SPRAWY: {
        type: String,
      },
      ILE_DNI_NA_PLATNOSC_FV: {
        type: Number,
      },
      JAKA_KANCELARIA: {
        type: String,
      },
      KONTRAHENT: {
        type: String,
      },
      KONTRAHENT_CZARNA_LISTA: {
        type: String,
      },
      KWOTA_DO_ROZLICZENIA_FK: {
        type: Number,
      },
      KWOTA_WPS: {
        type: String,
      },
      LOKALIZACJA: {
        type: String,
      },
      NR_DOKUMENTU: {
        type: String,
      },
      NR_KLIENTA: {
        type: Number,
      },
      OBSZAR: {
        type: String,
      },
      OPIEKUN_OBSZARU_CENTRALI: {
        type: String,
      },
      OPIS_ROZRACHUNKU: {
        type: [String],
      },
      OWNER: {
        type: String,
      },
      PRZEDZIAL_WIEKOWANIE: {
        type: String,
      },
      PRZETER_NIEPRZETER: {
        type: String,
      },
      RODZAJ_KONTA: {
        type: Number,
      },
      ROZNICA: {
        type: Number,
      },
      TERMIN_PLATNOSCI_FV: {
        type: String,
      },
      TYP_DOKUMENTU: {
        type: String,
      },
      UWAGI_DAWID: {
        type: String,
      },
    },
  ],

  data: {
    FKData: [
      {
        TYP_DOK: {
          type: String,
        },
        NR_DOKUMENTU: {
          type: String,
        },
        DZIAL: {
          type: String,
        },
        KONTRAHENT: {
          type: String,
        },
        RODZAJ_KONTA: {
          type: String,
        },
        KWOTA_DO_ROZLICZENIA_FK: {
          type: Number,
        },
        DO_ROZLICZENIA_AS: {
          type: Number,
        },
        ROZNICA: {
          type: Number,
        },
        DATA_ROZLICZENIA_AS: {
          type: String,
        },
        UWAGI_DAWID: {
          type: String,
        },
        DATA_WYSTAWIENIA_FV: {
          type: String,
        },
        TERMIN_PLATNOSCI_FV: {
          type: String,
        },
        ILE_DNI_NA_PLATNOSC_FV: {
          type: Number,
        },
        PRZETER_NIEPRZETER: {
          type: String,
        },
        PRZEDZIAL_WIEKOWANIE: {
          type: String,
        },
        NR_KLIENTA: {
          type: Number,
        },
        JAKA_KANCELARIA: {
          type: String,
        },
        ETAP_SPRAWY: {
          type: String,
        },
        KWOTA_WPS: {
          type: String,
        },
        CZY_W_KANCELARI: {
          type: String,
        },
        OBSZAR: {
          type: String,
        },
        DATA_WYDANIA_AUTA: {
          type: String,
        },
        CZY_SAMOCHOD_WYDANY_AS: {
          type: String,
        },
        OWNER: {
          type: String,
        },
        OPIEKUN_OBSZARU_CENTRALI: {
          type: String,
        },
        KONTRAHENT_CZARNA_LISTA: {
          type: String,
        },
      },
    ],
    FKAccountancy: [
      {
        NR_DOKUMENTU: {
          type: String,
        },
        DZIAL: {
          type: String,
        },
        KONTRAHENT: {
          type: String,
        },
        KWOTA_DO_ROZLICZENIA_FK: {
          type: Number,
        },
        TERMIN_PLATNOSCI_FV: {
          type: String,
        },
        RODZAJ_KONTA: {
          type: Number,
        },
        TYP_DOKUMENTU: {
          type: String,
        },
        NR_KLIENTA: {
          type: String,
        },
      },
    ],
    carReleased: [
      {
        NR_DOKUMENTU: {
          type: String,
        },
        DATA_WYDANIA_AUTA: {
          type: String,
        },
      },
    ],
    settlementNames: [
      {
        NR_DOKUMENTU: {
          type: String,
        },
        OPIS: {
          type: String,
        },
        DATA_ROZL_AS: {
          type: String,
        },
      },
    ],
    updateDate: {
      accountancy: {
        date: {
          type: String,
        },
        counter: {
          type: Number,
        },
      },
      carReleased: {
        date: {
          type: String,
        },
        counter: {
          type: Number,
        },
      },
      settlementNames: {
        date: {
          type: String,
        },
        counter: {
          type: Number,
        },
      },
    },
  },
  tableSettings: {
    columns: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
  updateDate: {
    accountancy: {
      date: {
        type: String,
      },
      counter: {
        type: Number,
      },
    },
    carReleased: {
      date: {
        type: String,
      },
      counter: {
        type: Number,
      },
    },
    caseStatus: {
      date: {
        type: String,
      },
      counter: {
        type: Number,
      },
    },
    settlementNames: {
      date: {
        type: String,
      },
      counter: {
        type: Number,
      },
    },
  },
  items: {
    departments: {
      type: [String],
      default: [],
    },
    localization: {
      type: [String],
      default: [],
    },
    areas: {
      type: [String],
      default: [],
    },
    owners: {
      type: [String],
      default: [],
    },
    guardians: {
      type: [String],
      default: [],
    },
    aging: {
      type: [Schema.Types.Mixed],
      default: [],
    },
  },
  preparedItemsData: {
    type: [Schema.Types.Mixed],
    default: [],
  },
});

module.exports = mongoose.model("FKRaports", FKAllDataSchema);
