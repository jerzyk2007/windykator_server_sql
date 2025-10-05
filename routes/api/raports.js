const express = require("express");
const router = express.Router();
const raports = require("../../controllers/raportsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
  .route("/get-data/:id_user")
  .get(verifyRoles(ROLES_LIST.User), raports.getDataRaport);

// pobieranie pliku excel dla raport area - raport chwilowy dla Marty
// router
//   .route("/get-raport-area")
//   .post(verifyRoles(ROLES_LIST.User), raports.getRaportArea);

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
    raports.getStructureOrganization
  );

// dane różnic pomiędzy AS a FK
router
  .route("/get-fifferences-as-fk/:id_user")
  .get(verifyRoles(ROLES_LIST.Admin), raports.getRaportDifferncesAsFk);

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
    raports.getRaportDocumentsControlBL
  );

module.exports = router;
