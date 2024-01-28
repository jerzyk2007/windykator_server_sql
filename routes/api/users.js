const express = require("express");
const router = express.Router();
const usersController = require("../../controllers/usersController");
const ROLES_LIST = require("../../config/roles_list");
const verifyRoles = require("../../middleware/verifyRoles");

router
    .route("/change-pass")
    .patch(verifyRoles(ROLES_LIST.User), usersController.changePassword);

router
    .route("/another-user-change-pass")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.changePasswordAnotherUser);

router
    .route("/change-login")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangeLogin);

router
    .route("/change-name")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.handleChangeName);

router
    .route("/change-permissions")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeUserPermissions);

router
    .route("/change-departments")
    .patch(verifyRoles(ROLES_LIST.Admin), usersController.changeUserDepartments);

router
    .route("/register")
    .post(verifyRoles(ROLES_LIST.Admin), usersController.createNewUser);

router
    .route("/delete-user/:_id")
    .delete(verifyRoles(ROLES_LIST.Admin), usersController.deleteUser);

router
    .route("/get-userdata")
    .get(verifyRoles(ROLES_LIST.Admin), usersController.getUsersData);

router
    .route("/save-table-settings")
    .patch(verifyRoles(ROLES_LIST.User), usersController.saveTableSettings);

router
    .route("/get-table-settings")
    .get(verifyRoles(ROLES_LIST.User), usersController.getTableSettings);


// router
//     .route("/register")
//     .post(usersController.handleNewUser);

// router
// .route("/register")
// .post(verifyRoles(ROLES_LIST.Admin), usersController.handleNewUser);

module.exports = router;
