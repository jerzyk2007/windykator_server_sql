const express = require("express");
const router = express.Router();
const usersController = require("../../controllers/usersController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

// router
//     .route("/change-name")
//     .patch(verifyRoles(ROLES_LIST.User), usersController.handleChangeName);

router
    .route("/change-pass")
    .patch(verifyRoles(ROLES_LIST.User), usersController.handleChangePassword);

router
    .route("/another-user-change-pass")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangePasswordAnotherUser);

router
    .route("/change-name")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangeName);

router
    .route("/change-permissions")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangePermissions);

router
    .route("/save-table-settings")
    .patch(verifyRoles(ROLES_LIST.User), usersController.handleSaveTableSettings);

router
    .route("/get-table-settings")
    .get(verifyRoles(ROLES_LIST.User), usersController.handleGetTableSettings);

router
    .route("/register")
    .post(verifyRoles(ROLES_LIST.Admin), usersController.handleNewUser);

router
    .route("/get-username")
    .get(verifyRoles(ROLES_LIST.Root), usersController.handleGetUserName);

// router
//     .route("/register")
//     .post(usersController.handleNewUser);

// router
// .route("/register")
// .post(verifyRoles(ROLES_LIST.Admin), usersController.handleNewUser);

module.exports = router;
