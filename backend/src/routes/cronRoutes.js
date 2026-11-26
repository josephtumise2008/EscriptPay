const express = require("express");
const { sweep, backup, giftPush } = require("../controllers/cronController");

const router = express.Router();

router.get("/sweep", sweep);
router.get("/backup", backup);
router.get("/gift-push", giftPush);

module.exports = router;
