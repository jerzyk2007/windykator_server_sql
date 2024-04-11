const mongoose = require("mongoose");
const { Schema } = mongoose;

const FKAllDataSchema = new Schema({
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
        CZY_SAMOCHOD_WYDANY_AS: {
          type: String,
        },
        OWNER: {
          type: String,
        },
        OPIENKUN_OBSZARU_CENTRALI: {
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
        DO_ROZLICZENIA_FK: {
          type: Number,
        },
        TERMIN_PLATNOSCI: {
          type: String,
        },
        KONTO: {
          type: Number,
        },
      },
    ],
  },
  tableSettings: {
    columns: {
      type: Schema.Types.Mixed,
      default: {},
    },
  },
});

module.exports = mongoose.model("FKRaports", FKAllDataSchema);
