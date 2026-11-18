const express = require("express");
const { requireAuth } = require("../middleware/auth");
const { listNumbers, saveNumber, removeNumber } = require("../controllers/numbersController");

const router = express.Router();

router.use(requireAuth);
router.get("/", listNumbers);
router.post("/", saveNumber);
router.delete("/:phone", removeNumber);

module.exports = router;
