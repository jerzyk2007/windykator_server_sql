const { connect_SQL } = require("../config/dbConn");
const { logEvents } = require("../middleware/logEvents");
const { mergeJsonLogs } = require("./manageDocumentAddition");

// pobiera dane do tabeli w zaleźności od wywołania

const getDataTable = async (req, res) => {
  const { info } = req.params;
  const refreshToken = req.cookies?.jwt;
  // Zabezpieczenie przed brakiem tokena
  if (!refreshToken) {
    return res.status(401).json({ message: "Brak autoryzacji." });
  }
  try {
    // 1. Pobranie danych o firmach użytkownika
    const [user] = await connect_SQL.query(
      "SELECT company FROM company_users WHERE refreshToken = ?",
      [refreshToken]
    );

    // Zabezpieczenie: jeśli nie ma użytkownika
    if (!user || user.length === 0) {
      return res.json([]);
    }

    // 2. Przygotowanie tablicy companyArray (obsługa JSON lub stringa)
    let companyArray = [];
    try {
      const rawCompany = user[0].company;
      if (Array.isArray(rawCompany)) {
        companyArray = rawCompany;
      } else if (typeof rawCompany === "string" && rawCompany.trim() !== "") {
        companyArray = JSON.parse(rawCompany);
      }
    } catch (error) {
      console.error("Błąd parsowania kolumny company:", error);
      companyArray = [];
    }

    // Zabezpieczenie: jeśli tablica jest pusta, zwracamy pusty wynik (user nie ma przypisanych firm)
    if (!Array.isArray(companyArray) || companyArray.length === 0) {
      return res.json([]);
    }

    // 3. Budowanie zapytania SQL w zależności od parametru "info"
    const baseQuery = "SELECT * FROM company_insurance_documents";
    let statusFilter = "";

    switch (info) {
      case "critical":
        statusFilter = "(STATUS != 'ZAKOŃCZONA' OR STATUS IS NULL)";
        break;
      case "completed":
        statusFilter = "STATUS = 'ZAKOŃCZONA'";
        break;
      case "settled":
        statusFilter = "STATUS = 'ZAKOŃCZONA' AND OW IS NOT NULL";
        break;
      case "pending":
        statusFilter = "STATUS = 'ZAKOŃCZONA' AND OW IS NULL";
        break;
      case "all":
        statusFilter = "1=1"; // Prawda dla każdego wiersza, aby łatwo dokleić AND FIRMA IN
        break;
      default:
        // Jeśli info nie pasuje do żadnego klucza, zwracamy pustą tablicę
        return res.json([]);
    }

    // 4. Wykonanie zapytania z filtrem firm (FIRMA IN (?))
    // mysql2 automatycznie obsłuży tablicę companyArray jako listę wartości
    const finalQuery = `${baseQuery} WHERE ${statusFilter} AND FIRMA IN (?)`;

    const [data] = await connect_SQL.query(finalQuery, [companyArray]);

    return res.json(data);
  } catch (error) {
    // Logowanie błędów
    if (typeof logEvents === "function") {
      logEvents(
        `insuranceController, getDataTable: ${error.message}`,
        "reqServerErrors.txt"
      );
    }
    console.error("Database Error:", error);
    return res
      .status(500)
      .json({ message: "Błąd serwera podczas pobierania danych." });
  }
};

module.exports = {
  getDataTable,
};
