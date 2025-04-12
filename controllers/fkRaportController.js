const { connect_SQL } = require("../config/dbConn");
const { checkDate, checkTime } = require('./manageDocumentAddition');
const { documentsType } = require('./manageDocumentAddition');


const { logEvents } = require("../middleware/logEvents");

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika - wersja 1 - będzie niebawem usuwana
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

// do wyszukiwania różnic pomiędzy FK a AS
const differencesAS_FK = async () => {
  try {
    //pobieram wszytskie numery faktur z programu
    const [docAS] = await connect_SQL.query(`SELECT D.NUMER_FV FROM documents AS D LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV WHERE S.NALEZNOSC !=0`);
    const fvAS = docAS.map(item => item.NUMER_FV);

    const [docFK] = await connect_SQL.query(`SELECT NR_DOKUMENTU FROM fk_raport_v2`);
    const fvFK = docFK.map(item => item.NR_DOKUMENTU);

    const filteredFvAS = fvAS.filter(fv => !fvFK.includes(fv));

    const sqlCondition = filteredFvAS?.length > 0 ? `(${filteredFvAS.map(dep => `D.NUMER_FV = '${dep}'`).join(' OR ')})` : null;

    const [getDoc] = await connect_SQL.query(
      `SELECT D.NUMER_FV AS NR_DOKUMENTU, D.DZIAL, IFNULL(JI.localization, 'BRAK DANYCH') AS LOKALIZACJA, D.KONTRAHENT, S.NALEZNOSC AS DO_ROZLICZENIA_AS, 
      D.DATA_FV AS DATA_WYSTAWIENIA_FV, D.TERMIN AS TERMIN_PLATNOSCI_FV,
      IFNULL(JI.area, 'BRAK DANYCH') AS OBSZAR, IFNULL(JI.guardian, 'BRAK DANY') AS OPIEKUN_OBSZARU_CENTRALI, 
      IFNULL(JI.owner,  'BRAK DANY') AS OWNER
      FROM documents AS D 
      LEFT JOIN settlements AS S ON D.NUMER_FV = S.NUMER_FV 
      LEFT JOIN join_items AS JI ON D.DZIAL = JI.department
      WHERE S.NALEZNOSC !=0 AND ${sqlCondition}`
    );

    const safeParseJSON = (data) => {
      try {
        return data ? JSON.parse(data) : data;
      } catch (error) {
        return data; // Zwraca oryginalną wartość, jeśli parsowanie się nie powiodło
      }
    };

    const addDocType = getDoc.map(item => {
      return {
        ...item,
        TYP_DOKUMENTU: documentsType(item.NR_DOKUMENTU),
        OWNER: safeParseJSON(item.OWNER),
        OPIEKUN_OBSZARU_CENTRALI: safeParseJSON(item.OPIEKUN_OBSZARU_CENTRALI)
      };
    });

    return addDocType;
  }
  catch (error) {
    logEvents(`fkRaportController, differencesAS_FK: ${error}`, "reqServerErrors.txt");
    return [];
  }
};

//funkcja pobiera dane do raportu FK, filtrując je na podstawie wyboru użytkonika, wersja poprawiona
const getRaportDataV2 = async (req, res) => {
  try {
    const [dataRaport] = await connect_SQL.query('SELECT HFD.HISTORY_DOC AS HISTORIA_WPISOW, FK_V2.* FROM fk_raport_v2 AS FK_V2 LEFT JOIN history_fk_documents AS HFD ON FK_V2.NR_DOKUMENTU = HFD.NUMER_FV');
    //usuwam z każdego obiektu klucz id_fk_raport
    dataRaport.forEach(item => {
      delete item.id_fk_raport;
    });


    const getDifferencesFK_AS = await differencesAS_FK();
    res.json({ dataRaport, differences: getDifferencesFK_AS });
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
    await connect_SQL.query('TRUNCATE mark_documents');
    await connect_SQL.query("TRUNCATE TABLE fk_raport_v2");

    res.json({ result: "delete" });
  } catch (error) {
    logEvents(
      `fkRaportController, deleteDataRaport: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });
  }
};

// generowanie raportu wersji 1 i zapisanie do bazy danych
const generateRaport = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query('SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, DA.DATA_WYDANIA_AUTA, DA.JAKA_KANCELARIA_TU, DA.KWOTA_WINDYKOWANA_BECARED, R.STATUS_AKTUALNY, R.FIRMA_ZEWNETRZNA, S.NALEZNOSC AS NALEZNOSC_AS, SD.OPIS_ROZRACHUNKU, SD.DATA_ROZL_AS FROM raportFK_accountancy AS RA LEFT JOIN join_items AS JI ON RA.DZIAL = JI.department LEFT JOIN documents AS D ON RA.NUMER_FV = D.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN rubicon_raport_fk AS R ON RA.NUMER_FV = R.NUMER_FV LEFT JOIN settlements AS S ON RA.NUMER_FV = S.NUMER_FV LEFT JOIN settlements_description AS SD ON RA.NUMER_FV = SD.NUMER ');

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
      const differenceInTime = date1 - date2 - 1;


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

// generowanie raportu w wersji poprawionej 
const generateRaportV2 = async (req, res) => {
  try {
    const [getData] = await connect_SQL.query(`SELECT RA.TYP_DOKUMENTU, RA.NUMER_FV, RA.KONTRAHENT, RA.NR_KONTRAHENTA, RA.DO_ROZLICZENIA AS NALEZNOSC_FK, 
RA.KONTO, RA.TERMIN_FV, RA.DZIAL, JI.localization, JI.area, JI.owner, JI.guardian, D.DATA_FV, D.VIN, D.DORADCA, 
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


    // const [getAging] = await connect_SQL.query('SELECT firstValue, secondValue, title, type FROM aging_items');
    const [getAging] = await connect_SQL.query('SELECT \`FROM_TIME\`, TO_TIME, TITLE, TYPE FROM aging_items');

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

    const normalizeDate = (date) => {
      const d = new Date(date);
      d.setHours(0, 0, 0, 0); // Ustawienie godziny na 00:00:00
      return d;
    };

    // przypisywanie przedziału wiekowania
    const checkAging = (TERMIN_FV) => {
      // const date1 = new Date();
      // const date2 = new Date(TERMIN_FV);

      // // Oblicz różnicę w czasie (w milisekundach)
      // const differenceInTime = date1 - date2;

      // // Przelicz różnicę w milisekundach na dni
      // const differenceInDays = Math.round(differenceInTime / (1000 * 60 * 60 * 24));


      const date1 = normalizeDate(new Date());
      const date2 = normalizeDate(new Date(TERMIN_FV));

      // Oblicz różnicę w dniach
      const differenceInDays = Math.round((date1 - date2) / (1000 * 60 * 60 * 24));

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
    const cleanData = getData.map(doc => {
      const ROZNICA_FK_AS = doc.NALEZNOSC_FK - doc.NALEZNOSC_AS != 0 ? doc.NALEZNOSC_FK - doc.NALEZNOSC_AS : "NULL";
      const DATA_FV = doc.DATA_FV ? doc.DATA_FV : changeDate(doc.TERMIN_FV);
      // const BRAK_DATY_WYSTAWIENIA_FV = doc.DATA_FV ? null : "TAK";
      const ILE_DNI_NA_PLATNOSC_FV = howManyDays(DATA_FV, doc.TERMIN_FV);
      const PRZETER_NIEPRZETER = isOlderThanToday(doc.TERMIN_FV) ? "Przeterminowane" : "Nieprzeterminowane";
      const CZY_SAMOCHOD_WYDANY = doc.DATA_WYDANIA_AUTA && (doc.area === "SAMOCHODY NOWE" || doc.area === "SAMOCHODY UŻYWANE") ? "TAK" : null;
      const PRZEDZIAL_WIEKOWANIE = checkAging(doc.TERMIN_FV);
      const JAKA_KANCELARIA = doc.FIRMA_ZEWNETRZNA ? doc.FIRMA_ZEWNETRZNA : doc.JAKA_KANCELARIA_TU && doc.area === 'BLACHARNIA' ? doc.JAKA_KANCELARIA_TU : null;
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
        DORADCA: doc.DORADCA,
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
      item.DORADCA ?? null,
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
      (BRAK_DATY_WYSTAWIENIA_FV, CZY_SAMOCHOD_WYDANY_AS, CZY_W_KANCELARI, DATA_ROZLICZENIA_AS, DATA_WYDANIA_AUTA, DATA_WYSTAWIENIA_FV, DO_ROZLICZENIA_AS, DORADCA, DZIAL, ETAP_SPRAWY, HISTORIA_ZMIANY_DATY_ROZLICZENIA, ILE_DNI_NA_PLATNOSC_FV, INFORMACJA_ZARZAD, JAKA_KANCELARIA, KONTRAHENT, KWOTA_DO_ROZLICZENIA_FK, KWOTA_WPS, LOKALIZACJA, NR_DOKUMENTU, NR_KLIENTA, OBSZAR, OSTATECZNA_DATA_ROZLICZENIA, OPIEKUN_OBSZARU_CENTRALI, OPIS_ROZRACHUNKU, OWNER, PRZEDZIAL_WIEKOWANIE, PRZETER_NIEPRZETER, RODZAJ_KONTA, ROZNICA, TERMIN_PLATNOSCI_FV, TYP_DOKUMENTU, VIN) 
    VALUES 
      ${values.map(() => "(?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)").join(", ")}
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
    console.error(error);
    logEvents(
      `fkRaportController, generateRaportV2: ${error}`,
      "reqServerErrors.txt"
    );
    res.status(500).json({ error: "Server error" });

  }
};

//funkcja dodaje dane z pliku wiekowania i sprawdza czy w pliku wiekowanie znajdują się dokumentu do których jest przygotowany dział (lokalizacja, owner itp) jeśli nie ma zwraca ionformacje o brakach
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

// funkcja która robi znaczniki przy dokumentach,m zgodnych z dokumentami z fkraport, żeby user mógł mieć dostęp tylko do dokumentów omawianych w fkraport
const saveMark = async (req, res) => {
  const documents = req.body;
  try {
    // // await connect_SQL.query(`UPDATE mark_documents SET RAPORT_FK = 0`);
    await connect_SQL.query('TRUNCATE mark_documents');


    // // Teraz przygotuj dane do wstawienia
    const values = documents.map(item => [
      item
    ]);

    const query = `
       INSERT IGNORE INTO mark_documents
         (NUMER_FV, RAPORT_FK) 
       VALUES 
         ${values.map(() => "(?, 1)").join(", ")}
     `;

    // // Wykonanie zapytania INSERT
    await connect_SQL.query(query, values.flat());

    connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Zaktualizowano.",
        'Dokumenty Raportu FK'
      ]);
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, saveMark: ${error}`, "reqServerErrors.txt");
    connect_SQL.query(
      "UPDATE updates SET  date = ?, hour = ?, update_success = ? WHERE data_name = ?",
      [
        checkDate(new Date()),
        checkTime(new Date()),
        "Błąd aktualizacji",
        'Dokumenty Raportu FK'
      ]);
  }
};

// usunięcie danego dokumentu z wyświetlania w tabeli dla danego działu
const changeMark = async (req, res) => {
  const { NUMER_FV, MARK_FK } = req.body;
  try {

    await connect_SQL.query(
      "UPDATE mark_documents SET RAPORT_FK = ? WHERE NUMER_FV = ?",
      [
        MARK_FK,
        NUMER_FV
      ]
    );
    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, changeMark: ${error}`, "reqServerErrors.txt");

  }
};


// pobiera dane do raportu kontroli dokuemntów BL
const getRaportDocumentsControlBL = async (req, res) => {
  try {
    // const [dataReport] = await connect_SQL.query(
    //   "SELECT CD.*, FKR.NR_DOKUMENTU, D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE,  datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM fk_raport_v2 AS FKR LEFT JOIN documents AS D ON FKR.NR_DOKUMENTU = D.NUMER_FV LEFT JOIN settlements as S ON FKR.NR_DOKUMENTU = S.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN control_documents AS CD ON FKR.NR_DOKUMENTU = CD.NUMER_FV WHERE FKR.OBSZAR ='BLACHARNIA' AND FKR.CZY_W_KANCELARI = 'NIE' AND FKR.PRZEDZIAL_WIEKOWANIE !=' < 0' AND FKR.PRZEDZIAL_WIEKOWANIE !='1 - 7' AND FKR.DO_ROZLICZENIA_AS > 0"
    // );
    // const [dataReport] = await connect_SQL.query(
    //   "SELECT CD.*, FKR.NR_DOKUMENTU, D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, D.DORADCA, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE,  datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM fk_raport_v2 AS FKR LEFT JOIN documents AS D ON FKR.NR_DOKUMENTU = D.NUMER_FV LEFT JOIN settlements as S ON FKR.NR_DOKUMENTU = S.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN control_documents AS CD ON FKR.NR_DOKUMENTU = CD.NUMER_FV LEFT JOIN mark_documents AS MD ON FKR.NR_DOKUMENTU = MD.NUMER_FV WHERE FKR.OBSZAR ='BLACHARNIA' AND MD.RAPORT_FK = 1 AND S.NALEZNOSC !=0"
    // );
    const [dataReport] = await connect_SQL.query(
      "SELECT CD.*, D.NUMER_FV,  D.KONTRAHENT, D.NR_SZKODY, D.BRUTTO, D.DZIAL, D.DORADCA, S.NALEZNOSC, datediff(NOW(), D.TERMIN) AS ILE_DNI_PO_TERMINIE, datediff(D.TERMIN, D.DATA_FV) AS ILE_DNI_NA_PLATNOSC FROM documents AS D LEFT JOIN settlements as S ON D.NUMER_FV = S.NUMER_FV LEFT JOIN documents_actions AS DA ON D.id_document = DA.document_id LEFT JOIN control_documents AS CD ON D.NUMER_FV = CD.NUMER_FV LEFT JOIN join_items AS JI ON D.DZIAL = JI.department LEFT JOIN rubicon AS R ON R.NUMER_FV = D.NUMER_FV WHERE JI.area = 'BLACHARNIA' AND S.NALEZNOSC > 0 AND DA.JAKA_KANCELARIA_TU IS NULL AND R.FIRMA_ZEWNETRZNA IS NULL AND D.TERMIN < DATE_SUB(CURDATE(), INTERVAL 7 DAY)"
    );
    if (dataReport.length) {
      const cleanedData = dataReport.map(({ id_control_documents, ...rest }) => rest);
      res.json(cleanedData);
    } else {
      res.json([]);
    }

  }
  catch (error) {
    logEvents(`fkRaportController, getRaportDocumentsControlBL: ${error}`, "reqServerErrors.txt");
    ;
  }
};

// pobiera dane struktury orgaznizacji
const getStructureOrganization = async (req, res) => {
  try {
    const [data] = await connect_SQL.query(
      "SELECT * FROM join_items ORDER BY department"
    );

    const findMail = await Promise.all(
      data.map(async (item) => {
        const ownerMail = await Promise.all(
          item.owner.map(async (own) => {
            const [mail] = await connect_SQL.query(
              `SELECT owner_mail FROM owner_items WHERE owner = ?`, [own]
            );

            // Zamiana null na "Brak danych"
            return mail.map(row => row.owner_mail || "Brak danych");
          })
        );

        return {
          ...item,
          mail: ownerMail.flat() // Spłaszczamy tablicę wyników
        };
      })
    );

    const [accounts] = await connect_SQL.query(
      "SELECT username, usersurname,userlogin, departments  FROM users"
    );

    if (data.length && accounts.length) {
      const structure = findMail.map(({ id_join_items, ...rest }) => rest);

      return res.json({ structure, accounts });
    } else {
      return res.json({ structure: [], accounts: [] });
    }
  }
  catch (error) {
    logEvents(`fkRaportController, getStructureOrganization: ${error}`, "reqServerErrors.txt");
    ;
  }
};

const generateHistoryDocuments = async (req, res) => {
  try {

    const [raportDate] = await connect_SQL.query(`SELECT date FROM  fk_updates_date WHERE title = 'accountancy'`);

    const [markDocuments] = await connect_SQL.query(`SELECT NUMER_FV FROM mark_documents WHERE RAPORT_FK = 1`);



    //mapuje wszytskie dokumenty oznaczone znacznikiem wsytępowania i dodaję do nich opisy, daty
    // const addDesc = markDocuments.map(async (item) => {
    for (const item of markDocuments) {
      // sprawdzam czy dokument ma wpisy histori w tabeli management_decision_FK
      const [getDoc] = await connect_SQL.query(`SELECT * FROM management_decision_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ?`, [item.NUMER_FV, raportDate[0].date]);

      //szukam czy jest wpis histori w tabeli history_fk_documents
      const [getDocHist] = await connect_SQL.query(`SELECT HISTORY_DOC FROM history_fk_documents WHERE NUMER_FV = ?`, [item.NUMER_FV]);


      if (!getDocHist.length) {

        const newHistory = {
          info: `1 raport utworzono ${raportDate[0].date}`,
          historyDate: [],
          historyText: []
        };

        // Przechodzimy przez każdy obiekt w getDoc i dodajemy wartości do odpowiednich tablic
        getDoc.forEach(doc => {
          if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
            newHistory.historyDate.push(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
          }
          if (doc.INFORMACJA_ZARZAD) {
            newHistory.historyText.push(doc.INFORMACJA_ZARZAD);
          }
        });

        await connect_SQL.query(`INSERT INTO history_fk_documents (NUMER_FV, HISTORY_DOC) VALUES (?, ?)`,
          [item.NUMER_FV, JSON.stringify([newHistory])]);
      } else {

        const newHistory = {
          info: `${getDocHist[0].HISTORY_DOC.length + 1} raport utworzono ${raportDate[0].date}`,
          historyDate: [],
          historyText: []
        };
        getDoc.forEach(doc => {
          if (doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {
            newHistory.historyDate.push(doc.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
          }
          if (doc.INFORMACJA_ZARZAD) {
            newHistory.historyText.push(doc.INFORMACJA_ZARZAD);
          }
        });
        const prepareArray = [...getDocHist[0].HISTORY_DOC, newHistory];
        await connect_SQL.query(`UPDATE  history_fk_documents SET HISTORY_DOC = ? WHERE NUMER_FV = ?`,
          [JSON.stringify(prepareArray), item.NUMER_FV]);
      }
    };

    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, generateHistoryDocuments: ${error}`, "reqServerErrors.txt");

  }
};

const addDecisionDate = async (req, res) => {
  const { NUMER_FV, data } = req.body;
  try {
    const [raportDate] = await connect_SQL.query(`SELECT date FROM  fk_updates_date WHERE title = 'accountancy'`);

    if (!raportDate[0].date) {
      return res.end();
    }




    if (data.INFORMACJA_ZARZAD.length && raportDate[0].date) {
      for (item of data.INFORMACJA_ZARZAD) {
        await connect_SQL.query(`INSERT INTO management_decision_FK (NUMER_FV, INFORMACJA_ZARZAD, WYKORZYSTANO_RAPORT_FK) VALUES (?, ?, ?)`, [
          NUMER_FV,
          item,
          raportDate[0].date
        ]);
      }
    }
    if (data.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length && raportDate[0].date) {

      for (item of data.HISTORIA_ZMIANY_DATY_ROZLICZENIA) {

        await connect_SQL.query(`INSERT INTO management_decision_FK (NUMER_FV, HISTORIA_ZMIANY_DATY_ROZLICZENIA, WYKORZYSTANO_RAPORT_FK) VALUES (?, ?, ?)`, [
          NUMER_FV,
          item,
          raportDate[0].date
        ]);
      }
    }


    // robię zapis równoległy do nowej tabelimanagement_date_description_FK
    const [searchDuplicate] = await connect_SQL.query(`SELECT * FROM  management_date_description_FK WHERE NUMER_FV = ? AND WYKORZYSTANO_RAPORT_FK = ?`,
      [NUMER_FV, raportDate[0].date]);
    if (searchDuplicate[0]?.id_management_date_description_FK) {
      // console.log(raportDate[0].date);
      const id = searchDuplicate[0].id_management_date_description_FK;
      // const NUMER_FV = searchDuplicate[0].NUMER_FV;
      const HISTORIA_ZMIANY_DATY_ROZLICZENIA = searchDuplicate[0].HISTORIA_ZMIANY_DATY_ROZLICZENIA;
      const INFORMACJA_ZARZAD = searchDuplicate[0].INFORMACJA_ZARZAD;
      // const WYKORZYSTANO_RAPORT_FK = searchDuplicate[0].WYKORZYSTANO_RAPORT_FK;


      if (Array.isArray(data.INFORMACJA_ZARZAD) && data.INFORMACJA_ZARZAD.length) {
        INFORMACJA_ZARZAD.push(...data.INFORMACJA_ZARZAD);
      }

      if (Array.isArray(data.HISTORIA_ZMIANY_DATY_ROZLICZENIA) && data.HISTORIA_ZMIANY_DATY_ROZLICZENIA.length) {
        HISTORIA_ZMIANY_DATY_ROZLICZENIA.push(...data.HISTORIA_ZMIANY_DATY_ROZLICZENIA);
      }

      // const nr = 'FV/UBL/1349/24/A/D8';
      // const infoMAN = [
      //   '03-04-2025 - Ostanówko - W szkodzie są dwie faktury. Do pełnego rozliczenia szkody (dwóch faktur) brakuje 3175,38 PLNTU potwierdziło dopłatę jednak nie przesłali decyzji. Ponownie poprosiłem o dosłanie.',
      // ];
      // const dateMan = [];
      // const rep = '2025-03-23';

      // console.log(NUMER_FV);
      // console.log(INFORMACJA_ZARZAD);
      // console.log(HISTORIA_ZMIANY_DATY_ROZLICZENIA);
      // console.log(WYKORZYSTANO_RAPORT_FK);
      // console.log(id);

      // console.log(searchDuplicate[0]);

      // JSON.stringify(filteredObject),


      await connect_SQL.query(`UPDATE management_date_description_FK SET INFORMACJA_ZARZAD = ?, HISTORIA_ZMIANY_DATY_ROZLICZENIA = ? WHERE id_management_date_description_FK = ?  `,
        [JSON.stringify(INFORMACJA_ZARZAD), JSON.stringify(HISTORIA_ZMIANY_DATY_ROZLICZENIA), id]
      );



    } else {


      await connect_SQL.query(`INSERT INTO management_date_description_FK (NUMER_FV, INFORMACJA_ZARZAD, HISTORIA_ZMIANY_DATY_ROZLICZENIA, WYKORZYSTANO_RAPORT_FK) VALUES (?, ?, ?, ?)`,
        [NUMER_FV, JSON.stringify(data.INFORMACJA_ZARZAD), JSON.stringify(data.HISTORIA_ZMIANY_DATY_ROZLICZENIA), raportDate[0].date]
      );
    }



    res.end();
  }
  catch (error) {
    logEvents(`fkRaportController, addDecision: ${error}`, "reqServerErrors.txt");

  }
};

module.exports = {
  getRaportData,
  getRaportDataV2,
  getDateCounter,
  deleteDataRaport,
  generateRaport,
  generateRaportV2,
  dataFkAccocuntancyFromExcel,
  saveMark,
  changeMark,
  getRaportDocumentsControlBL,
  getStructureOrganization,
  generateHistoryDocuments,
  addDecisionDate
};
