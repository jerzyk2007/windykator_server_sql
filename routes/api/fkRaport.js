const express = require("express");
const router = express.Router();
const fKRaport = require("../../controllers/fkRaportController");
const generateRaport = require("../../controllers/generateRaportFK");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// pobieranie danych do raportu FK v2 wg wstępnego filtrowania
router
  .route("/get-raport-data/:company")
  .post(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), generateRaport.getRaportData);

// pobieram daty  aktualizacji plików excel dla raportu FK
router
  .route("/get-date-counter/:company")
  .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), generateRaport.getDateCounter);

// usuwam wszystkie dane wczytanych plików excel raportu FK
router
  .route("/delete-data-raport/:company")
  .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), fKRaport.deleteDataRaport);

// generowanie raportu FK wersja 2 i zapisanie w tabeli
router
  .route("/generate-raport/:company")
  .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), generateRaport.generateNewRaport);

// usuwanie znacznika na wybranym dokumencie dla raportu fk 
router
  .route("/change-mark-document")
  .patch(
    verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin),
    fKRaport.changeMark
  );

// dane do raportu kontroli dokumentów BL
router
  .route("/get-data-raports-control-BL")
  .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Controller, ROLES_LIST.Admin), fKRaport.getRaportDocumentsControlBL);

// dane struktury orgaznizacji
router
  .route("/get-organization-structure")
  .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), fKRaport.getStructureOrganization);

//dodaje ostateczną decyzję i datę do osobnej tabeli, dla wygenerowania historii w raporcie FK
router
  .route("/add-decision-date-fk")
  .post(verifyRoles(ROLES_LIST.User), fKRaport.addDecisionDate);

module.exports = router;
