const express = require("express");
const { requireAuth } = require("../middleware/auth");
const {
  signup,
  login,
  logout,
  me,
  updateProfile,
  changePassword,
  forgotPassword,
  resetPassword,
  sendEmailCode,
  confirmEmailCode,
} = require("../controllers/authController");

const router = express.Router();

router.post("/signup", signup);
router.post("/login", login);
router.post("/logout", logout);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password", resetPassword);

router.get("/me", requireAuth, me);
router.put("/me", requireAuth, updateProfile);
router.post("/change-password", requireAuth, changePassword);
router.post("/verify-email/send", requireAuth, sendEmailCode);
router.post("/verify-email", requireAuth, confirmEmailCode);

module.exports = router;