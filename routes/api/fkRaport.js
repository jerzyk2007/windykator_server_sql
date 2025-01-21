const express = require("express");
const router = express.Router();
const fKRaport = require("../../controllers/fkRaportController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");


// pobieranie danych do raportu FK wg wstępnego filtrowania
router
  .route("/get-raport-data")
  .post(verifyRoles(ROLES_LIST.FK), fKRaport.getRaportData);

// pobieranie danych do raportu FK v2 wg wstępnego filtrowania
router
  .route("/get-raport-data-v2")
  .post(verifyRoles(ROLES_LIST.FK), fKRaport.getRaportDataV2);

//funckja odczytująca działy, ownerów, lokalizacje
router
  .route("/get-items-data")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getDataItems);

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
router
  .route("/get-fksettings-data")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getFKSettingsItems);

//funckja zapisujaca działy, ownerów, lokalizacje
router
  .route("/save-items-data/:info")
  .patch(verifyRoles(ROLES_LIST.FK), fKRaport.saveItemsData);

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
router
  .route("/save-prepared-items")
  .patch(verifyRoles(ROLES_LIST.FK), fKRaport.savePreparedItems);

// funkcja pobierająca kpl owner, dział, lokalizacja
router
  .route("/get-prepared-items")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getPreparedItems);

// funkcja pobiera unikalne nazwy działów z pliku księgowego
router
  .route("/get-uniques-dep")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getDepfromDocuments);

// pobieram daty  aktualizacji plików excel dla raportu FK
router
  .route("/get-date-counter")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.getDateCounter);

// usuwam wszystkie dane wczytanych plików excel raportu FK
router
  .route("/delete-data-raport")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.deleteDataRaport);

// generowanie raportu FK i zapisanie w tabeli
router
  .route("/generate-raport")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.generateRaport);

// generowanie raportu FK wersja 2 i zapisanie w tabeli
router
  .route("/generate-raport-v2")
  .get(verifyRoles(ROLES_LIST.FK), fKRaport.generateRaportV2);

//sprawdza czy w pliku wiekowanie znajdują się dokumentu do których jest przygotowany dział (lokalizacja, owner itp) jeśli nie ma zwraca ionformacje o brakach
router
  .route("/send-accountancy-fk")
  .post(
    verifyRoles(ROLES_LIST.FK),
    fKRaport.dataFkAccocuntancyFromExcel
  );

// pobierane dane z front po wygenerowaniu raportu fk dla dodania znacznika
router
  .route("/send-document-mark-fk")
  .post(
    verifyRoles(ROLES_LIST.FK),
    fKRaport.saveMark
  );

module.exports = router;
