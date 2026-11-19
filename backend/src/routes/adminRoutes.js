const express = require("express");
const { requireAuth, requireAdmin } = require("../middleware/auth");
const { overview, resolveTransaction, updateMessage } = require("../controllers/adminController");
const { selfOrderInfo, selfOrder } = require("../controllers/ownerOrderController");

const router = express.Router();

router.use(requireAuth, requireAdmin);

router.get("/overview", overview);
router.post("/transactions/:id/resolve", resolveTransaction);
router.post("/messages/:id", updateMessage);
router.get("/self-order", selfOrderInfo);
router.post("/self-order", selfOrder);

module.exports = router;
