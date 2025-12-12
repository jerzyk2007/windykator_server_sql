const { connect_SQL, msSqlQuery } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const bcryptjs = require("bcryptjs");
const crypto = require("crypto");
const { sendEmail } = require("./mailController");
const {
  generatePassword,
  documentsType,
  addDepartment,
} = require("./manageDocumentAddition");
const { accountancyFKData } = require("./sqlQueryForGetDataFromMSSQL");
const { getDataDocuments } = require("./documentsController");

const statusFK = async () => {
  const company = "KRT";
  try {
    const [getData] = await connect_SQL.query(`
        SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, 
        RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, 
        RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.LOCALIZATION, JI.AREA, 
        JI.OWNER, JI.GUARDIAN, D.DATA_FV, D.VIN, D.DORADCA, D.TYP_PLATNOSCI,
        DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, 
        DA.INFORMACJA_ZARZAD, DA.HISTORIA_ZMIANY_DATY_ROZLICZENIA, 
        DA.OSTATECZNA_DATA_ROZLICZENIA, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, 
        S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS 
        FROM company_raportFK_${company}_accountancy AS RA 
        LEFT JOIN company_join_items AS JI ON RA.DZIAL = JI.department AND RA.FIRMA = JI.COMPANY
        LEFT JOIN company_documents AS D ON RA.NUMER_FV = D.NUMER_FV AND RA.FIRMA = D.FIRMA
        LEFT JOIN company_documents_actions AS DA ON D.id_document = DA.document_id 
        LEFT JOIN company_rubicon_data AS R ON RA.NUMER_FV = R.NUMER_FV AND RA.FIRMA = R.COMPANY
        LEFT JOIN company_settlements AS S ON RA.NUMER_FV = S.NUMER_FV AND RA.FIRMA = S.COMPANY
        LEFT JOIN company_settlements_description AS SD ON RA.NUMER_FV = SD.NUMER AND RA.FIRMA = SD.COMPANY
    `);

    // const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM company_aging_items');
    const [getAging] = await connect_SQL.query(
      "SELECT `FROM_TIME`, TO_TIME, TITLE, TYPE FROM company_aging_items"
    );

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split("T")[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      //   // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(
        differenceInTime / (1000 * 60 * 60 * 24)
      );
      return differenceInDays;
    };

    // sprawdza czy fv jest przeterminowana czy nieprzeterminowana
    const isOlderThanToday = (TERMIN_FV) => {
      // Konwersja TERMIN_FV na obiekt Date
      const terminDate = new Date(TERMIN_FV);
      // Pobranie dzisiejszej daty bez czasu (tylko yyyy-mm-dd)
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Zerowanie godziny, minuty, sekundy, milisekundy
      return terminDate < today;
    };

    const normalizeDate = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0); // Ustawienie godziny na 00:00:00
      return d;
    };

    // przypisywanie przedziału wiekowania
    const checkAging = (TERMIN_FV) => {
      const date1 = normalizeDate(new Date());
      const date2 = normalizeDate(new Date(TERMIN_FV));

      // Oblicz różnicę w dniach
      const differenceInDays = Math.round(
        (date1 - date2) / (1000 * 60 * 60 * 24)
      );

      let title = "";

      for (const age of getAging) {
        if (age.TYPE === "first" && Number(age.FROM_TIME) >= differenceInDays) {
          title = age.TITLE;
          break;
        } else if (
          age.TYPE === "last" &&
          Number(age.TO_TIME) <= differenceInDays
        ) {
          title = age.TITLE;
          break;
        } else if (
          age.TYPE === "some" &&
          Number(age.FROM_TIME) <= differenceInDays &&
          Number(age.TO_TIME) >= differenceInDays
        ) {
          title = age.TITLE;
          break;
        }
      }

      return title;
    };

    const cleanData = getData.map((doc) => {
      const ROZNICA_FK_AS =
        doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0
          ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS
          : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV)
        ? "Przeterminowane"
        : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY =
        doc.DATA_WYDANIA_AUTA &&
        (doc.AREA === "SAMOCHODY NOWE" || doc.AREA === "SAMOCHODY UŻYWANE")
          ? "TAK"
          : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      // const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA
      //   ? doc.FIRMA_ZEWNETRZNA
      //   : doc.JAKA_KANCELARIA_TU && doc.AREA === "BLACHARNIA"
      //   ? doc.JAKA_KANCELARIA_TU
      //   : null;

      const status =
        doc.STATUS_AKTUALNY !== "Brak działań" &&
        doc.STATUS_AKTUALNY !== "Rozliczona" &&
        doc.STATUS_AKTUALNY !== "sms/mail +3" &&
        doc.STATUS_AKTUALNY !== "sms/mail -2" &&
        doc.STATUS_AKTUALNY !== "Zablokowana" &&
        doc.STATUS_AKTUALNY !== "Zablokowana BL" &&
        doc.STATUS_AKTUALNY !== "Zablokowana KF" &&
        doc.STATUS_AKTUALNY !== "Zablokowana KF BL" &&
        doc.STATUS_AKTUALNY !== "Do decyzji" &&
        doc.STATUS_AKTUALNY !== "Windykacja zablokowana bezterminowo" &&
        doc.STATUS_AKTUALNY !== "Do wyjaśnienia"
          ? doc.STATUS_AKTUALNY
          : "BRAK";

      // const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA
      //   ? doc.FIRMA_ZEWNETRZNA
      //   : doc.AREA === "BLACHARNIA" &&
      //     doc.JAKA_KANCELARIA_TU &&
      //     doc.JAKA_KANCELARIA_TU !== "WINDYKACJA WEWNĘTRZNA"
      //   ? doc.JAKA_KANCELARIA_TU
      //   : null;

      const JAKA_KANCELARIA =
        status !== "BRAK"
          ? doc.FIRMA_ZEWNETRZNA
            ? doc.FIRMA_ZEWNETRZNA
            : doc.AREA === "BLACHARNIA" &&
              doc.JAKA_KANCELARIA_TU &&
              doc.JAKA_KANCELARIA_TU !== "WINDYKACJA WEWNĘTRZNA"
            ? doc.JAKA_KANCELARIA_TU
            : null
          : null;

      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      const HISTORIA_ZMIANY_DATY_ROZLICZENIA = doc
        ?.HISTORIA_ZMIANY_DATY_ROZLICZENIA?.length
        ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length
        : null;
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS =
        doc.AREA === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU
          ? doc.KWOTA_WINDYKOWANA_BECARED
          : null;

      let TYP_PLATNOSCI = doc.TYP_PLATNOSCI;

      if (
        TYP_PLATNOSCI === null ||
        TYP_PLATNOSCI === undefined ||
        TYP_PLATNOSCI === "brak"
      ) {
        TYP_PLATNOSCI = "BRAK";
      } else if (
        ["PRZELEW", "PRZELEW 30", "PRZELEW 60"].includes(TYP_PLATNOSCI)
      ) {
        TYP_PLATNOSCI = "PRZELEW";
      }

      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DORADCA: doc.DORADCA,
        DZIAL: doc.DZIAL,
        // ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        ETAP_SPRAWY: status !== "BRAK" ? status : doc.STATUS_AKTUALNY,
        HISTORIA_ZMIANY_DATY_ROZLICZENIA,
        ILE_DNI_NA_PLATNOSC_FV,
        INFORMACJA_ZARZAD: doc.INFORMACJA_ZARZAD,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.LOCALIZATION,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.AREA,
        OPIEKUN_OBSZARU_CENTRALI: doc.GUARDIAN,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OSTATECZNA_DATA_ROZLICZENIA: doc.OSTATECZNA_DATA_ROZLICZENIA,
        OWNER: doc.OWNER,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,
        TYP_PLATNOSCI,
        VIN: doc.VIN,
        FIRMA: company,
      };
    });
  } catch (error) {
    console.error(error);
  }
};

const repair = async () => {
  try {
    // await statusFK();
  } catch (error) {
    console.error(error);
  }
};

module.exports = {
  repair,
};
