const express = require("express");
const router = express.Router();
const items = require("../../controllers/itemsController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");


//dodanie nowego elementu Item
router
    .route("/new-item/:info")
    .post(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.newItem);

router
    .route("/get-items")
    .get(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.getDataItems);

//usuwanie
router
    .route("/delete-item/:id/:info")
    .delete(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.deleteItem
    );

// zmiana pojedyńczego item
router
    .route("/change-item/:id/:info")
    .patch(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.changeItem
    );

// funkcja pobiera zapisane wartości dla działów, ownerów, lokalizacji, opiekunów i obszarów, z odrzuceniem danych zbędnych jak np aging
router
    .route("/get-fksettings-data")
    .get(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.getFKSettingsItems);

// funkcja zapisujaca zmiany kpl - owner, dział, lokalizacja
router
    .route("/save-prepared-items")
    .patch(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.savePreparedItems);

router
    .route("/delete-prepared-item/:dep/:comp")
    .delete(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.deletePreparedItem);


router
    .route("/check-doc-payment")
    .post(
        verifyRoles(ROLES_LIST.Admin, ROLES_LIST.FK_KRT, ROLES_LIST.FK_KEM, ROLES_LIST.FK_RAC),
        items.checkDocPayment);

module.exports = router;
