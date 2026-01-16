const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");

// Oblicza datę Wielkanocy (Metoda Gaussa)
const getEaster = (year) => {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(Date.UTC(year, month - 1, day));
};

//   Sprawdza, czy dany dzień jest wolny (sobota, niedziela lub święto)
const isFreeDay = (date, customHolidays = []) => {
  const d = new Date(date);
  const dayOfWeek = d.getUTCDay(); // 0 = Niedziela, 6 = Sobota
  if (dayOfWeek === 0 || dayOfWeek === 6) return true;

  const year = d.getUTCFullYear();
  const day = d.getUTCDate();
  const month = d.getUTCMonth() + 1;

  // 1. Sprawdź święta stałe zdefiniowane przez użytkownika (np. z React/SQL)
  const isFixedHoliday = customHolidays.some(
    (h) => Number(h.day) === day && Number(h.month) === month
  );
  if (isFixedHoliday) return true;

  // 2. Sprawdź święta ruchome (Wielkanoc i Boże Ciało)
  const easter = getEaster(year);
  const easterMonday = new Date(easter);
  easterMonday.setUTCDate(easter.getUTCDate() + 1);
  const corpusChristi = new Date(easter);
  corpusChristi.setUTCDate(easter.getUTCDate() + 60);

  const checkSameDate = (d1, d2) =>
    d1.getUTCDate() === d2.getUTCDate() &&
    d1.getUTCMonth() === d2.getUTCMonth();

  if (checkSameDate(d, easterMonday) || checkSameDate(d, corpusChristi))
    return true;

  return false;
};

//   Wyznacza pierwszy dzień naliczania odsetek zgodnie z Art. 115 K.c.

const getInterestStartDate = (deadlineStr, customHolidays) => {
  let date = new Date(deadlineStr + "T00:00:00Z");

  // Jeśli termin przypada w dzień wolny, przesuń na kolejny roboczy
  while (isFreeDay(date, customHolidays)) {
    date.setUTCDate(date.getUTCDate() + 1);
  }

  // Odsetki zaczynają się dzień PO ostatecznym (skorygowanym) terminie
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().split("T")[0];
};

// Pomocnicza funkcja do formatowania dat i dni tygodnia po polsku
const formatPLDate = (dateStr) => {
  const date = new Date(dateStr + "T00:00:00Z");
  const days = [
    "niedziela",
    "poniedziałek",
    "wtorek",
    "środa",
    "czwartek",
    "piątek",
    "sobota",
  ];
  return `${date.getUTCDate().toString().padStart(2, "0")}.${(
    date.getUTCMonth() + 1
  )
    .toString()
    .padStart(2, "0")}.${date.getUTCFullYear()}, ${days[date.getUTCDay()]}`;
};

// Oblicza odsetki w transakcjach handlowych
const calculateCommercialInterest1 = async (
  amount,
  deadlineDate,
  paymentDate
) => {
  try {
    // 1. Pobierz dane z bazy (Procenty i Dni Wolne)
    const [configData] = await connect_SQL.query(
      "SELECT PROCENTY_ROK, WOLNE_USTAWOWE FROM company_settings WHERE id_setting = 1"
    );
    const historyczneOdsetki = configData[0]?.PROCENTY_ROK ?? [];
    const customHolidays = configData[0]?.WOLNE_USTAWOWE ?? [];

    // 2. Skoryguj datę rozpoczęcia (Art. 115 K.c.)
    const adjustedStartStr = getInterestStartDate(deadlineDate, customHolidays);
    const start = Date.parse(adjustedStartStr + "T00:00:00Z");
    const end = Date.parse(paymentDate + "T00:00:00Z") + 24 * 60 * 60 * 1000;

    if (start >= end) return 0;

    // 3. Przygotuj stawki
    const sortedRates = [...historyczneOdsetki].sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date)
    );

    let totalInterest = 0;

    // 4. Pętla obliczeniowa
    for (let i = 0; i < sortedRates.length; i++) {
      const rateInfo = sortedRates[i];
      const rateStart = Date.parse(rateInfo.date + "T00:00:00Z");
      const nextRateStart = sortedRates[i + 1]
        ? Date.parse(sortedRates[i + 1].date + "T00:00:00Z")
        : Date.parse("2099-12-31");

      const actualStart = Math.max(start, rateStart);
      const actualEnd = Math.min(end, nextRateStart);

      if (actualStart < actualEnd) {
        const diffDays = Math.round(
          (actualEnd - actualStart) / (1000 * 60 * 60 * 24)
        );

        // Obliczenie i zaokrąglenie cząstkowe (standard księgowy)
        const interestForPeriod =
          Math.round(
            ((amount * (rateInfo.percent / 100) * diffDays) / 365) * 100
          ) / 100;

        totalInterest += interestForPeriod;
      }
    }

    return parseFloat(totalInterest.toFixed(2));
  } catch (error) {
    logEvents(
      `payGuard, calculateCommercialInterest: ${error}`,
      "reqServerErrors.txt"
    );
    return null;
  }
};
const calculateCommercialInterest = async (
  amount,
  deadlineDate,
  paymentDate,
  type
) => {
  try {
    const [configData] = await connect_SQL.query(
      "SELECT PROCENTY_ROK, WOLNE_USTAWOWE FROM company_settings WHERE id_setting = 1"
    );
    const historyczneOdsetki = configData[0]?.PROCENTY_ROK ?? [];
    const customHolidays = configData[0]?.WOLNE_USTAWOWE ?? [];

    // 1. Przygotowanie danych podstawowych do obiektu wynikowego
    const wynik = {
      kwota_zobowiazania: amount,
      termin_zaplaty: formatPLDate(deadlineDate),
      uiszczenie_zaplaty: formatPLDate(paymentDate),
      warning: null,
      szczegoly: [],
      razem_odsetki: 0,
    };

    // 2. Obsługa Art. 115 K.c. (Przesunięcie terminu)
    const originalDeadline = new Date(deadlineDate + "T00:00:00Z");
    const adjustedStartStr = getInterestStartDate(deadlineDate, customHolidays);
    const adjustedDeadlineDate = new Date(adjustedStartStr + "T00:00:00Z");
    adjustedDeadlineDate.setUTCDate(adjustedDeadlineDate.getUTCDate() - 1);

    if (originalDeadline.getTime() !== adjustedDeadlineDate.getTime()) {
      wynik.warning = `UWAGA ! Termin zapłaty przypada na dzień ustawowo wolny od pracy lub sobotę - zatem na podstawie art. 115 K.c. zostaje przesunięty na ${formatPLDate(
        adjustedDeadlineDate.toISOString().split("T")[0]
      )}`;
    }

    const start = Date.parse(adjustedStartStr + "T00:00:00Z");
    const end = Date.parse(paymentDate + "T00:00:00Z") + 24 * 60 * 60 * 1000;

    if (start >= end) {
      return wynik; // Zwróci obiekt z zerowymi odsetkami
    }

    const sortedRates = [...historyczneOdsetki].sort(
      (a, b) => Date.parse(a.date) - Date.parse(b.date)
    );

    let totalInterest = 0;

    // 3. Pętla obliczeniowa wypełniająca "szczegoly"
    for (let i = 0; i < sortedRates.length; i++) {
      const rateInfo = sortedRates[i];
      const rateStart = Date.parse(rateInfo.date + "T00:00:00Z");
      const nextRateStart = sortedRates[i + 1]
        ? Date.parse(sortedRates[i + 1].date + "T00:00:00Z")
        : Date.parse("2099-12-31");

      const actualStart = Math.max(start, rateStart);
      const actualEnd = Math.min(end, nextRateStart);

      if (actualStart < actualEnd) {
        const diffDays = Math.round(
          (actualEnd - actualStart) / (1000 * 60 * 60 * 24)
        );
        const interestForPeriod =
          Math.round(
            ((amount * (rateInfo.percent / 100) * diffDays) / 365) * 100
          ) / 100;

        // Dodanie wiersza do tabeli szczegółów
        wynik.szczegoly.push({
          od_do: `${new Date(actualStart)
            .toISOString()
            .split("T")[0]
            .split("-")
            .reverse()
            .join(".")} - ${new Date(actualEnd - 86400000)
            .toISOString()
            .split("T")[0]
            .split("-")
            .reverse()
            .join(".")}`,
          liczba_dni: diffDays,
          stawka: `${rateInfo.percent.toFixed(2)}%`,
          kwota: interestForPeriod,
        });

        totalInterest += interestForPeriod;
      }
    }

    wynik.razem_odsetki = parseFloat(totalInterest.toFixed(2));

    return type === "single" ? parseFloat(totalInterest.toFixed(2)) : wynik; // Zwracamy pełny obiekt
  } catch (error) {
    logEvents(`payGuard error: ${error}`, "reqServerErrors.txt");
    return null;
  }
};

module.exports = {
  calculateCommercialInterest,
};
