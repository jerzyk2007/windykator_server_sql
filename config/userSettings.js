const raportUserSettings = {
  Pracownik: {
    raportAdvisers:
      '{"size":{},"visible":{},"density":"comfortable","order":["mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
    raportDepartments:
      '{"size":{},"visible":{},"density":"comfortable","order":[""mrt-row-spacer"],"pinning":{"left":[],"right":[]},"pagination":{"pageIndex":0,"pageSize":20}}',
  },
  Kancelaria: {},
};

const raportLawPartnerSettings = {
  Pracownik: {},
  Kancelaria: {},
};

const newUserTableSettings = {
  Pracownik: {
    size: {},
    order: [
      "NUMER_FV",
      "DATA_FV",
      "TERMIN",
      "ILE_DNI_PO_TERMINIE",
      "BRUTTO",
      "DO_ROZLICZENIA",
      "KONTRAHENT",
      "UWAGI_ASYSTENT",
      "mrt-row-spacer",
    ],
    pinning: {
      left: ["NUMER_FV"],
      right: [],
    },
    visible: {
      NUMER_FV: true,
      DATA_FV: true,
      TERMIN: true,
      ILE_DNI_PO_TERMINIE: true,
      BRUTTO: true,
      DO_ROZLICZENIA: true,
      KONTRAHENT: true,
      UWAGI_ASYSTENT: true,
    },
    pagination: {
      pageSize: 30,
      pageIndex: 0,
    },
  },
  Kancelaria: {},
};
const newLawPartnerTableSettings = {
  Pracownik: {},
  Kancelaria: {
    size: {},
    order: ["NUMER_DOKUMENTU", "mrt-row-spacer"],
    pinning: {
      left: ["NUMER_DOKUMENTU"],
      right: [],
    },
    visible: {
      NUMER_FV: true,
    },
    pagination: {
      pageSize: 30,
      pageIndex: 0,
    },
  },
};

const userDepartments = {
  Pracownik: [],
  Kancelaria: [],
};

const userColumns = {
  Pracownik: [],
  Kancelaria: [],
  Polisy: [],
  Koordynator: [],
};

module.exports = {
  raportUserSettings,
  raportLawPartnerSettings,
  newUserTableSettings,
  newLawPartnerTableSettings,
  userDepartments,
  userColumns,
};
