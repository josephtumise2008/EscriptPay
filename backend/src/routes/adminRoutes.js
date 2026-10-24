const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { overview, resolveTransaction, updateMessage } = require("../controllers/adminController");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", overview);
router.post("/transactions/:id/resolve", resolveTransaction);
router.post("/messages/:id", updateMessage);

module.exports = router;
