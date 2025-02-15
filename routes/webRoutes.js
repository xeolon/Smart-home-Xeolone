// routes/webRoutes.js
const express = require("express");
const path = require("path");
const router = express.Router();
const checkAuth = require("../middlewares/auth");
const checkProfilePermission = require("../middlewares/checkProfilePermission")

// homepage
router.get("/", checkAuth, (req, res) => {
    res.sendFile(path.join(__dirname, "../views/home/home.html"));
});

// page login
router.get("/login", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/login_register/login.html"));
});

// page register
router.get("/register", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/login_register/register.html"));
});

// Route xem profile (cho phép mọi người xem)
router.get("/profile", (req, res) => {
    res.sendFile(path.join(__dirname, "../views/profile/views/profile.html"));
});

// Route chỉnh sửa profile (chỉ admin hoặc chủ sở hữu)
router.get("/edit-profile", checkAuth, checkProfilePermission, (req, res) => {
   res.sendFile(path.join(__dirname, "../views/profile/admin/edit-profile.html"));
});



module.exports = router;

