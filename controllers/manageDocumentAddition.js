const bcryptjs = require("bcryptjs");
const crypto = require("crypto");

const dzialMap = {
  D048: "D048/D058",
  D058: "D048/D058",
  D068: "D068/D078",
  D078: "D068/D078",
  D118: "D118/D148",
  D148: "D118/D148",
  D168: "D118/D148",
  D308: "D308/D318",
  D318: "D308/D318",
};

// rozkodowuje nr działu na podstawie numeru faktury, chyba że RAC
const addDepartment = (documents) => {
  return documents.map((document) => {
    const { FIRMA, NUMER } = document;

    // 1. Jeśli firma RAC i numer kończy się na /xxxx (rok)
    if (FIRMA === "RAC" && NUMER && /\/\d{4}$/.test(NUMER)) {
      return { ...document, DZIAL: "RAC" };
    }

    // 2. Jeśli numer zawiera Dxxx
    const match = NUMER?.match(/D(\d+)/);
    if (match) {
      const dzialNumber = match[1].padStart(3, "0");
      return {
        ...document,
        DZIAL: dzialMap[`D${dzialNumber}`] || `D${dzialNumber}`,
      };
    }

    // 3. Fallback
    return { ...document, DZIAL: "KSIĘGOWOŚĆ" };
  });
};

// zamiana daty na format yyyy-mm-dd
const checkDate = (data) => {
  const year = data.getFullYear();
  const month = String(data.getMonth() + 1).padStart(2, "0"); // Dodajemy +1, bo miesiące są liczone od 0
  const day = String(data.getDate()).padStart(2, "0");
  const yearNow = `${year}-${month}-${day}`;
  return yearNow;
};

// zamiana godziny na format hh-mm
const checkTime = (data) => {
  const hour = String(data.getHours()).padStart(2, "0");
  const min = String(data.getMinutes()).padStart(2, "0");
  const timeNow = `${hour}:${min}`;

  return timeNow;
};

// nadaje nazwę dla typu dokumentów np. faktura, korekta, inne ...
const documentsType = (data) => {
  let documentsType = "";
  if (data.includes("KF/ZAL")) {
    documentsType = "Korekta zaliczki";
  } else if (data.includes("KF/")) {
    documentsType = "Korekta";
  } else if (data.includes("KP/")) {
    documentsType = "KP";
  } else if (data.includes("NO/")) {
    documentsType = "Nota";
  } else if (data.includes("PP/")) {
    documentsType = "Paragon";
  } else if (data.includes("PK")) {
    documentsType = "PK";
  } else if (data.includes("IP/")) {
    documentsType = "Karta Płatnicza";
  } else if (data.includes("FV/ZAL")) {
    documentsType = "Faktura zaliczkowa";
  } else if (data.includes("FV/")) {
    documentsType = "Faktura";
  } else {
    documentsType = "Inne";
  }

  return documentsType;
};

const generatePassword = async (length = 12) => {
  const chars = {
    lower: "abcdefghijklmnopqrstuvwxyz",
    upper: "ABCDEFGHIJKLMNOPQRSTUVWXYZ",
    digits: "0123456789",
    special: "!@#$%",
  };

  const getRandomChar = (set) => set[crypto.randomInt(0, set.length)];

  let password = [
    getRandomChar(chars.lower),
    getRandomChar(chars.upper),
    getRandomChar(chars.digits),
    getRandomChar(chars.special),
    ...Array.from({ length: length - 4 }, () =>
      getRandomChar(Object.values(chars).join(""))
    ),
  ]
    .sort(() => Math.random() - 0.5)
    .join("");

  const hashedPwd = await bcryptjs.hash(password, 10);

  return {
    password,
    hashedPwd,
  };
};

const userProfile = (profile) => {
  const selectProfile = {
    insider: "Pracownik",
    partner: "Kancelaria",
    insurance: "Polisy",
    vindex: "Koordynator",
  };
  return selectProfile[profile];
};
function safeParseJSON(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;

  try {
    return JSON.parse(value);
  } catch (err) {
    console.error("Błąd parsowania JSON:", err);
    return [];
  }
}

const mergeJsonLogs = (oldData, chatLog) => {
  const oldChat = safeParseJSON(oldData?.[0]?.KANAL_KOMUNIKACJI);
  const newChat = chatLog?.documents?.KANAL_KOMUNIKACJI?.length
    ? chatLog.documents.KANAL_KOMUNIKACJI
    : [];

  const oldLog = safeParseJSON(oldData?.[0]?.DZIENNIK_ZMIAN);
  const newLog = chatLog?.documents?.DZIENNIK_ZMIAN?.length
    ? chatLog.documents.DZIENNIK_ZMIAN
    : [];

  return {
    mergeChat: [...oldChat, ...newChat],
    mergeLog: [...oldLog, ...newLog],
  };
};

module.exports = mergeJsonLogs;

module.exports = {
  addDepartment,
  checkDate,
  checkTime,
  documentsType,
  generatePassword,
  userProfile,
  mergeJsonLogs,
};
