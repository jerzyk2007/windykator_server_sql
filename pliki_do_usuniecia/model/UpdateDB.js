const mongoose = require("mongoose");
const { Schema } = mongoose;

const updatesSchema = new Schema({
  date: {
    type: String,
  },
  settlements: [
    {
      NUMER_FV: {
        type: String,
      },
      TERMIN: {
        type: String,
      },
      DATA_WYSTAWIENIA_FV: {
        type: String,
      },
      DO_ROZLICZENIA: {
        type: Number,
      },
      ZOBOWIAZANIA: {
        type: Number,
      },
    },
  ],
});

module.exports = mongoose.model("Updates", updatesSchema);
