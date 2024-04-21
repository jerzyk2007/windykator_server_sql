const mongoose = require("mongoose");
const { Schema } = mongoose;

const FKDataRaports = new Schema({
  FKDataRaports: [
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
});

module.exports = mongoose.model("FKDataRaports", FKDataRaports);
