const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  signup,
  login,
  logout,
  me,
  updateProfile,
  changePassword,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);

router.get("/me", requireAuth, me);
router.put("/me", requireAuth, updateProfile);
router.post("/change-password", requireAuth, changePassword);

module.exports = router;