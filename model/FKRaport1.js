const mongoose = require("mongoose");
const { Schema } = mongoose;

const FKSchema = new Schema({
  FKData: {
    type: [Schema.Types.Mixed],
    default: [],
  },
});

module.exports = mongoose.model("FKRaports", FKSchema);
