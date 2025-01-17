const { connect_SQL } = require("../config/dbConn");
const { checkDate } = require('./manageDocumentAddition');

const { logEvents } = require("../middleware/logEvents");

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika
const getRaportData = async (req, res) => {
  try {
    const [dataRaport] = await connect_SQL.query('SELECT * FROM fk_raport');
    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });

    res.json(dataRaport);
  } catch (error) {
    logEvents(`fkRaportController, getRaportData: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika
const getRaportDataV2 = async (req, res) => {
  try {
    const [dataRaport] = await connect_SQL.query('SELECT * FROM fk_raport_v2');
    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });

    res.json(dataRaport);
  } catch (error) {
    logEvents(`fkRaportController, getRaportDataV2: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// pobieram daty  aktualizacji plików excel dla raportu FK !!!
const getDateCounter = async (req, res) => {
  try {
    const [result] = await connect_SQL.query('SELECT title, date, counter FROM fk_updates_date');

    const jsonObject = result.reduce((acc, item) => {
      acc[item.title] = {
        date: item.date,    // Przypisanie `date` jako `hour`
        counter: item.counter
      };
      return acc;
    }, {});

    // console.log(jsonObject);
    res.json({ updateData: jsonObject });
  } catch (error) {
    logEvents(
      `fkRaportController, getDateCounter: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

//funckja kasuje przygotwane dane do raportu, czas dodania pliki i ilość danych
const deleteDataRaport = async (req, res) => {
  try {
    await connect_SQL.query('TRUNCATE fk_updates_date');
    await connect_SQL.query('TRUNCATE raportFK_accountancy');

    res.json({ result: "delete" });
  } catch (error) {
    logEvents(
      `fkRaportController, deleteDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const generateRaport = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query('SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS FROM raportFK_accountancy AS RA LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER ');

    const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');
    // console.log(getAging);

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split('T')[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
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

    // przypisywanie przedziału wiekowania

    const checkAging = (TERMIN_FV) => {
      const date1 = new Date();
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date1 - date2;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      let title = "";

      for (const age of getAging) {
        if (age.type === "first" && Number(age.firstValue) >= differenceInDays) {
          title = age.title;
          break;
        } else if (
          age.type === "last" &&
          Number(age.secondValue) <= differenceInDays
        ) {
          title = age.title;
          break;
        } else if (
          age.type === "some" &&
          Number(age.firstValue) <= differenceInDays &&
          Number(age.secondValue) >= differenceInDays
        ) {
          title = age.title;
          break;
        }
      }
      return title;
    };

    const filteredData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU ? doc.JAKA_KANCELARIA_TU : null;
      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS = doc.area === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU ? doc.KWOTA_WINDYKOWANA_BECARED : null;


      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        ILE_DNI_NA_PLATNOSC_FV,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.localization,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.area,
        OPIEKUN_OBSZARU_CENTRALI: doc.guardian,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OWNER: doc.owner,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,

      };
    });

    await connect_SQL.query("TRUNCATE TABLE fk_raport");


    // Teraz przygotuj dane do wstawienia
    const values = filteredData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DZIAL ?? null,
      item.ETAP_SPRAWY ?? null,
      item.ILE_DNI_NA_PLATNOSC_FV ?? null,
      item.JAKA_KANCELARIA ?? null,
      item.KONTRAHENT ?? null,
      item.KWOTA_DO_ROZLICZENIA_FK ?? null,
      item.KWOTA_WPS ?? null,
      item.LOKALIZACJA ?? null,
      item.NR_DOKUMENTU ?? null,
      item.NR_KLIENTA ?? null,
      item.OBSZAR ?? null,
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI) ?? null,
      JSON.stringify(item.OPIS_ROZRACHUNKU) ?? null,
      JSON.stringify(item.OWNER) ?? null,
      item.PRZEDZIAL_WIEKOWANIE ?? null,
      item.PRZETER_NIEPRZETER ?? null,
      item.RODZAJ_KONTA ?? null,
      item.ROZNICA ?? null,
      item.TERMIN_PLATNOSCI_FV ?? null,
      item.TYP_DOKUMENTU ?? null,
    ]);



    const query = `
       INSERT IGNORE INTO fk_raport
         (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, ILE_DNI_NA_PLATNOSC_FV, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU) 
       VALUES 
         ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
     `;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport'`);

    if (checkRaportDate[0]?.title) {
      await connect_SQL.query(`UPDATE fk_updates_date SET  date = ?, counter = ? WHERE title = ?`,
        [checkDate(new Date()), getData.length || 0, 'raport']
      );
    } else {
      const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
      const params = ["raport", checkDate(new Date()), filteredData.length || 0];
      await connect_SQL.query(sql, params);
    }

    // res.json(filteredData);
    res.end();
  }
  catch (error) {
    logEvents(
      `fkRaportController, generateRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }

};

const generateRaportV2 = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query(`SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, 
RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, D.VIN,
DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, DA.INFORMACJA_ZARZAD, DA.HISTORIA_ZMIANY_DATY_ROZLICZENIA, DA.OSTATECZNA_DATA_ROZLICZENIA, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, 
S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS 
FROM raportFK_accountancy AS RA 
LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department 
LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV 
LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id 
LEFT JOIN rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV 
LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV 
LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER
`);
    // WHERE TYP_DOKUMENTU IN ('Faktura', 'Nota')`);
    // WHERE TYP_DOKUMENTU IN ('Faktura', 'Nota') AND R.FIRMA_ZEWNETRZNA IS NULL AND DA.JAKA_KANCELARIA_TU IS NULL`);

    const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');

    // jeśli nie ma DATA_FV to od TERMIN_FV jest odejmowane 14 dni
    const changeDate = (dateStr) => {
      const date = new Date(dateStr);
      // Odejmij 14 dni
      date.setDate(date.getDate() - 14);
      // Przekonwertuj datę na format 'YYYY-MM-DD'
      const updatedDate = date.toISOString().split('T')[0];
      return updatedDate;
    };

    // odejmuje TERMIN_FV od DATA_FV
    const howManyDays = (DATA_FV, TERMIN_FV) => {
      // Konwersja dat w formacie yyyy-mm-dd na obiekty Date
      const date1 = new Date(DATA_FV);
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date2 - date1;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
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

    // przypisywanie przedziału wiekowania

    const checkAging = (TERMIN_FV) => {
      const date1 = new Date();
      const date2 = new Date(TERMIN_FV);

      // Oblicz różnicę w czasie (w milisekundach)
      const differenceInTime = date1 - date2;

      // Przelicz różnicę w milisekundach na dni
      const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));
      let title = "";

      for (const age of getAging) {
        if (age.type === "first" && Number(age.firstValue) >= differenceInDays) {
          title = age.title;
          break;
        } else if (
          age.type === "last" &&
          Number(age.secondValue) <= differenceInDays
        ) {
          title = age.title;
          break;
        } else if (
          age.type === "some" &&
          Number(age.firstValue) <= differenceInDays &&
          Number(age.secondValue) >= differenceInDays
        ) {
          title = age.title;
          break;
        }
      }
      return title;
    };
    const cleanData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU ? doc.JAKA_KANCELARIA_TU : null;
      const CZY_W_KANCELARI = JAKA_KANCELARIA ? "TAK" : "NIE";
      const HISTORIA_ZMIANY_DATY_ROZLICZENIA = doc?.HISTORIA_ZMIANY_DATY_ROZLICZENIA?.length ? doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length : null;
      let KWOTA_WPS = CZY_W_KANCELARI === "TAK" ? doc.NALEZNOSC_AS : null;
      KWOTA_WPS = doc.area === "BLACHARNIA" && doc.JAKA_KANCELARIA_TU ? doc.KWOTA_WINDYKOWANA_BECARED : null;


      return {
        BRAK_DATY_WYSTAWIENIA_FV: doc.DATA_FV ? null : "TAK",
        CZY_SAMOCHOD_WYDANY_AS: CZY_SAMOCHOD_WYDANY,
        CZY_W_KANCELARI,
        DATA_ROZLICZENIA_AS: doc.DATA_ROZL_AS,
        DATA_WYDANIA_AUTA: doc.DATA_WYDANIA_AUTA,
        DATA_WYSTAWIENIA_FV: DATA_FV,
        DO_ROZLICZENIA_AS: doc.NALEZNOSC_AS,
        DZIAL: doc.DZIAL,
        ETAP_SPRAWY: doc.STATUS_AKTUALNY,
        HISTORIA_ZMIANY_DATY_ROZLICZENIA,
        ILE_DNI_NA_PLATNOSC_FV,
        INFORMACJA_ZARZAD: doc.INFORMACJA_ZARZAD,
        JAKA_KANCELARIA,
        KONTRAHENT: doc.KONTRAHENT,
        KWOTA_DO_ROZLICZENIA_FK: doc.NALEZNOSC_FK,
        KWOTA_WPS,
        LOKALIZACJA: doc.localization,
        NR_DOKUMENTU: doc.NUMER_FV,
        NR_KLIENTA: doc.NR_KONTRAHENTA,
        OBSZAR: doc.area,
        OPIEKUN_OBSZARU_CENTRALI: doc.guardian,
        OPIS_ROZRACHUNKU: doc.OPIS_ROZRACHUNKU,
        OSTATECZNA_DATA_ROZLICZENIA: doc.OSTATECZNA_DATA_ROZLICZENIA,
        OWNER: doc.owner,
        PRZEDZIAL_WIEKOWANIE,
        PRZETER_NIEPRZETER,
        RODZAJ_KONTA: doc.KONTO,
        ROZNICA: ROZNICA_FK_AS,
        TERMIN_PLATNOSCI_FV: doc.TERMIN_FV,
        TYP_DOKUMENTU: doc.TYP_DOKUMENTU,
        VIN: doc.VIN
      };
    });


    // const filteredData = cleanData.filter(item => item.PRZEDZIAL_WIEKOWANIE !== "1-7" && item.PRZEDZIAL_WIEKOWANIE !== "<0");

    // console.log(filteredData);


    await connect_SQL.query("TRUNCATE TABLE fk_raport_v2");

    // Teraz przygotuj dane do wstawienia
    const values = cleanData.map(item => [
      item.BRAK_DATY_WYSTAWIENIA_FV ?? null,
      item.CZY_SAMOCHOD_WYDANY_AS ?? null,
      item.CZY_W_KANCELARI ?? null,
      item.DATA_ROZLICZENIA_AS ?? null,
      item.DATA_WYDANIA_AUTA ?? null,
      item.DATA_WYSTAWIENIA_FV ?? null,
      item.DO_ROZLICZENIA_AS ?? null,
      item.DZIAL ?? null,
      item.ETAP_SPRAWY ?? null,
      item.HISTORIA_ZMIANY_DATY_ROZLICZENIA ?? null,
      item.ILE_DNI_NA_PLATNOSC_FV ?? null,
      JSON.stringify(item.INFORMACJA_ZARZAD) ?? null,
      item.JAKA_KANCELARIA ?? null,
      item.KONTRAHENT ?? null,
      item.KWOTA_DO_ROZLICZENIA_FK ?? null,
      item.KWOTA_WPS ?? null,
      item.LOKALIZACJA ?? null,
      item.NR_DOKUMENTU ?? null,
      item.NR_KLIENTA ?? null,
      item.OBSZAR ?? null,
      item.OSTATECZNA_DATA_ROZLICZENIA ?? null,
      JSON.stringify(item.OPIEKUN_OBSZARU_CENTRALI) ?? null,
      JSON.stringify(item.OPIS_ROZRACHUNKU) ?? null,
      JSON.stringify(item.OWNER) ?? null,
      item.PRZEDZIAL_WIEKOWANIE ?? null,
      item.PRZETER_NIEPRZETER ?? null,
      item.RODZAJ_KONTA ?? null,
      item.ROZNICA ?? null,
      item.TERMIN_PLATNOSCI_FV ?? null,
      item.TYP_DOKUMENTU ?? null,
      item.VIN ?? null,
    ]);

    const query = `
INSERT IGNORE INTO fk_raport_v2
  (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DZIAL, ETAP_SPRAWY, HISTORIA_ZMIANY_DATY_ROZLICZENIA, ILE_DNI_NA_PLATNOSC_FV, INFORMACJA_ZARZAD, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OSTATECZNA_DATA_ROZLICZENIA, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU, VIN) 
VALUES 
  ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
`;

    // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    // dodanie daty wygenerowania raportu
    const [checkRaportDate] = await connect_SQL.query(`SELECT title FROM fk_updates_date WHERE title='raport_v2'`);

    if (checkRaportDate[0]?.title) {
      await connect_SQL.query(`UPDATE fk_updates_date SET  date = ?, counter = ? WHERE title = ?`,
        [checkDate(new Date()), getData.length || 0, 'raport_v2']
      );
    } else {
      const sql = `INSERT INTO fk_updates_date (title, date, counter) VALUES (?, ?, ?)`;
      const params = ["raport_v2", checkDate(new Date()), cleanData.length || 0];
      await connect_SQL.query(sql, params);
    }

    res.end();
  }
  catch (error) {
    logEvents(
      `fkRaportController, generateRaportV2: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const getDataItems = async (req, res) => {
  try {
    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });
    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });

    const [aging] = await connect_SQL.query(
      "SELECT firstValue, secondValue, title, type from aging_items"
    );


    res.json({
      data: {
        departments,
        localizations,
        areas,
        owners,
        guardians,
        aging,
      },
    });
  } catch (error) {
    logEvents(`fkRaportController, getDataItems: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
const getFKSettingsItems = async (req, res) => {
  try {
    const [uniqeDepFromJI] = await connect_SQL.query(
      "SELECT distinct department FROM join_items"
    );

    const uniqueDepartments = uniqeDepFromJI.map((dep) => {
      return dep.department;
    });

    const [depResult] = await connect_SQL.query(
      "SELECT department from department_items"
    );
    const departments = depResult.map((dep) => {
      return dep.department;
    });

    const [locResult] = await connect_SQL.query(
      "SELECT localization from localization_items"
    );
    const localizations = locResult.map((loc) => {
      return loc.localization;
    });

    const [areaResult] = await connect_SQL.query("SELECT area from area_items");
    const areas = areaResult.map((area) => {
      return area.area;
    });

    const [ownerResult] = await connect_SQL.query(
      "SELECT owner from owner_items"
    );
    const owners = ownerResult.map((owner) => {
      return owner.owner;
    });

    const [guardianResult] = await connect_SQL.query(
      "SELECT guardian from guardian_items"
    );
    const guardians = guardianResult.map((guardian) => {
      return guardian.guardian;
    });
    res.json({
      uniqueDepartments,
      departments,
      areas,
      localizations,
      owners,
      guardians,
    });
  } catch (error) {
    logEvents(
      `fkRaportController, getFKSettingsItems: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

//funckja zapisujaca działy, ownerów, lokalizacje
const saveItemsData = async (req, res) => {
  const { info } = req.params;
  const { departments, localizations, areas, owners, guardians, aging } =
    req.body;

  // Mapowanie nazw na odpowiadające im klucze
  const dataMap = {
    departments,
    localizations,
    areas,
    owners,
    guardians,
    aging,
  };
  const type = info.slice(0, -1);
  try {
    if (info !== "aging") {
      await connect_SQL.query(`TRUNCATE TABLE ${type}_items`);
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT ${type} FROM ${type}_items WHERE ${type} = ?`,
          [item]
        );
        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            `INSERT IGNORE INTO ${type}_items (${type}) VALUES (?)`,
            [item]
          );
        }
      }
    } else {
      await connect_SQL.query("TRUNCATE TABLE aging_items");
      for (const item of dataMap[info]) {
        const [checkDuplicate] = await connect_SQL.query(
          `SELECT title FROM aging_items WHERE title = ?`,
          [item.title]
        );

        if (!checkDuplicate[0]) {
          await connect_SQL.query(
            "INSERT IGNORE INTO aging_items (firstValue, secondValue, title, type ) VALUES (?, ?, ?, ?)",
            [item.firstValue, item.secondValue, item.title, item.type]
          );
        }
      }
      // await FKRaport.updateOne(
      //   {},
      //   { $set: { "items.aging": aging } },
      //   { new: true, upsert: true }
      // );
    }

    res.end();
  } catch (error) {
    logEvents(`fkRaportController, saveItemsData: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobierająca kpl owner, dział, lokalizacja dla "Dopasuj dane"
const getPreparedItems = async (req, res) => {
  try {
    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );
    res.json(preparedItems);
  } catch (error) {
    logEvents(`fkRaportController, savePrepareItems: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
const savePreparedItems = async (req, res) => {
  const { department, localization, area, owner, guardian } = req.body;
  try {
    const [duplicate] = await connect_SQL.query(
      "SELECT department FROM join_items WHERE department = ?",
      [department]
    );
    if (duplicate[0]?.department) {
      await connect_SQL.query(
        "UPDATE join_items SET localization = ?, area = ?, owner = ?, guardian = ? WHERE department = ?",
        [
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
          department,
        ]
      );
    } else {
      await connect_SQL.query(
        "INSERT INTO join_items (department, localization, area, owner, guardian) VALUES (?, ?, ?, ?, ?)",
        [
          department,
          localization,
          area,
          JSON.stringify(owner),
          JSON.stringify(guardian),
        ]
      );
    }
    res.end();
  } catch (error) {
    logEvents(`fkRaportController, savePrepareItems: ${error}`, "reqServerErrors.txt");
    res.status(500).json({ error: "Server error" });
  }
};

// funkcja pobiera unikalne nazwy działów z pliku księgowego
const getDepfromDocuments = async (req, res) => {
  try {
    const [getDepartments] = await connect_SQL.query(
      "SELECT distinct DZIAL from documents"
    );

    const departments = getDepartments.map((dep) => {
      return dep.DZIAL;
    });

    res.json(departments);
  } catch (error) {
    logEvents(
      `fkRaportController, getDepfromAccountancy: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

const dataFkAccocuntancyFromExcel = async (req, res) => {
  const { documents_data } = req.body;
  try {
    const [preparedItems] = await connect_SQL.query(
      "SELECT department, localization, area, owner, guardian FROM join_items ORDER BY department"
    );
    // dodaje wygenerowane na działy na podstawie nazwy documentu
    const resultDep = prepareDepartments(documents_data);

    if (!resultDep) {
      return res.status(500).json({ error: "Server error" });
    }

    const addItems = generateItems(preparedItems, resultDep);

    if (!addItems) {
      return res.status(500).json({ error: "Server error" });
    } else if (addItems.errorDepartments.length) {
      return res.json({ errorDepartments: addItems.errorDepartments });
    }

    const addDocDate = await docDateUpdate(addItems.generateData);
    if (!addDocDate) {
      return res.status(500).json({ error: "Server error" });
    }

    const updateSettlements = await updateSettlementDescription(addDocDate);
    if (!updateSettlements) {
      return res.status(500).json({ error: "Server error" });
    }

    await savePreparedData(updateSettlements, 'accountancy');

    res.end();
  }
  catch (error) {
    logEvents(
      `fkRaportController, dataFkAccocuntancyFromExcel: ${error}`,
      "reqServerErrors.txt"
    );
    return res.status(500).json({ error: "Server error" });
  }
};

module.exports = {
  getRaportData,
  getRaportDataV2,
  getDateCounter,
  deleteDataRaport,
  generateRaport,
  generateRaportV2,
  getDataItems,
  getFKSettingsItems,
  saveItemsData,
  savePreparedItems,
  getPreparedItems,
  getDepfromDocuments,
  dataFkAccocuntancyFromExcel
};
