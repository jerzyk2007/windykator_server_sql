const express = require("express");
const router = express.Router();
const items = require("../../controllers/itemsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");


//dodanie nowego elementu Item
router
    .route("/new-item/:info")
    .post(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.newItem);

router
    .route("/get-user-items")
    .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.getDataItems);



// router
//     .route("/get-data/:info")
//     .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.getItems);

//usuwanie
router
    .route("/delete-item/:id/:info")
    .delete(
        verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin),
        items.deleteItem
    );

// zmiana pojedyńczego item
router
    .route("/change-item/:id/:info")
    .patch(
        verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin),
        items.changeItem
    );

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
router
    .route("/get-fksettings-data")
    .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.getFKSettingsItems);

// funkcja pobiera unikalne nazwy działów z pliku księgowego
router
    .route("/get-uniques-dep")
    .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.getDepfromDocuments);

// funkcja pobierająca kpl owner, dział, lokalizacja
router
    .route("/get-prepared-items")
    .get(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.getPreparedItems);

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
router
    .route("/save-prepared-items")
    .patch(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.savePreparedItems);

router
    .route("/delete-prepared-item/:dep")
    .delete(verifyRoles(ROLES_LIST.FK, ROLES_LIST.Admin), items.deletePreparedItem);

module.exports = router;
