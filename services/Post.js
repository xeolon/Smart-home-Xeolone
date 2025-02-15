const express = require("express");
const router = express.Router();

router.get("/hello", (req, res) => {
    res.json({ message: "xin chao" });
});

module.exports = router; // Phải export router, không phải object khác

