const express = require("express");
const router = express.Router();
const fKRaport = require("../../controllers/fkRaportController");
const generateRaport = require("../../controllers/generateRaportFK");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// generowanie danych do raportu FK v2 wg wstępnego filtrowania
router
  .route("/generate-data/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    generateRaport.generateRaportData
  );

// pobieranie raportu głównego dla zarządu - FK
router
  .route("/get-main-report/:company")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    generateRaport.getMainRaportFK
  );

// pobieranie raportu głównego dla zarządu - FK
router
  .route("/get-business-report/:company")
  .post(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    generateRaport.getBusinessRaportFK
  );

// pobieram daty  aktualizacji plików excel dla raportu FK
router
  .route("/get-date-counter/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    generateRaport.getDateCounter
  );

// usuwam wszystkie dane wczytanych plików excel raportu FK
// router
// .route("/delete-data-raport/:company")
// .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), fKRaport.deleteDataRaport);

// generowanie raportu FK wersja 2 i zapisanie w tabeli
router
  .route("/create-raport/:company")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    generateRaport.generateNewRaport
  );

// usuwanie znacznika na wybranym dokumencie dla raportu fk
router
  .route("/change-mark-document")
  .patch(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.changeMark
  );

// dane do raportu kontroli dokumentów BL
router
  .route("/get-data-raports-control-BL")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getRaportDocumentsControlBL
  );

// dane struktury orgaznizacji
router
  .route("/get-organization-structure")
  .get(
    verifyRoles(
      ROLES_LIST.Admin,
      ROLES_LIST.FK_KRT,
      ROLES_LIST.FK_KEM,
      ROLES_LIST.FK_RAC
    ),
    fKRaport.getStructureOrganization
  );

//dodaje ostateczną decyzję i datę do osobnej tabeli, dla wygenerowania historii w raporcie FK
router
  .route("/add-decision-date-fk")
  .post(verifyRoles(ROLES_LIST.User), fKRaport.addDecisionDate);

module.exports = router;
