// Saved and recent phone numbers for one-tap data/airtime top-ups.
//   GET    /api/numbers            -> { saved, recent }
//   POST   /api/numbers            { phone, label?, network? } (adds or renames)
//   DELETE /api/numbers/:phone
const mongoose = require("mongoose");
const User = require("../models/User");
const Transaction = require("../models/Transaction");
const { validateNigerianPhone } = require("../utils/validators");

const MAX_SAVED = 20;
const MAX_RECENT = 6;
const NETWORKS = ["MTN", "Airtel", "Glo", "9mobile"];

const toLocal = (p) => (String(p || "").startsWith("+234") ? `0${p.slice(4)}` : p);
const cleanLabel = (v) => String(v || "").replace(/[<>]/g, "").replace(/\s+/g, " ").trim().slice(0, 30);
const view = (n) => ({ phone: toLocal(n.phone), label: n.label || "", network: n.network || "" });

const loadSaved = async (userId) => {
  const u = await User.findById(userId, { savedNumbers: 1 }).lean();
  return (u && u.savedNumbers) || [];
};

const listNumbers = async (req, res) => {
  try {
    const saved = await loadSaved(req.userId);
    const savedSet = new Set(saved.map((n) => n.phone));
    const rows = await Transaction.aggregate([
      { $match: { user: new mongoose.Types.ObjectId(String(req.userId)), type: { $in: ["data", "airtime"] }, phone: { $type: "string" } } },
      { $sort: { createdAt: -1 } },
      { $limit: 200 },
      { $group: { _id: "$phone", network: { $first: "$network" }, lastUsedAt: { $first: "$createdAt" } } },
      { $sort: { lastUsedAt: -1 } },
      { $limit: MAX_RECENT + MAX_SAVED },
    ]);
    const recent = rows
      .filter((r) => !savedSet.has(r._id))
      .slice(0, MAX_RECENT)
      .map((r) => ({ phone: toLocal(r._id), network: NETWORKS.includes(r.network) ? r.network : "", lastUsedAt: r.lastUsedAt }));
    return res.json({ success: true, saved: saved.map(view), recent });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not load your numbers." });
  }
};

const saveNumber = async (req, res) => {
  try {
    const { phone, label, network } = req.body || {};
    const check = validateNigerianPhone(phone);
    if (!check.valid) return res.status(400).json({ success: false, message: check.message });
    const entry = {
      phone: check.normalized,
      label: cleanLabel(label),
      network: NETWORKS.includes(network) ? network : "",
      savedAt: new Date(),
    };

    const saved = await loadSaved(req.userId);
    const others = saved.filter((n) => n.phone !== entry.phone);
    if (others.length >= MAX_SAVED) {
      return res.status(400).json({ success: false, message: `You can save up to ${MAX_SAVED} numbers. Remove one first.` });
    }
    const next = [entry, ...others];
    await User.updateOne({ _id: req.userId }, { $set: { savedNumbers: next } });
    return res.json({ success: true, saved: next.map(view) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not save that number." });
  }
};

const removeNumber = async (req, res) => {
  try {
    const check = validateNigerianPhone(req.params.phone);
    if (!check.valid) return res.status(400).json({ success: false, message: check.message });
    await User.updateOne({ _id: req.userId }, { $pull: { savedNumbers: { phone: check.normalized } } });
    return res.json({ success: true, saved: (await loadSaved(req.userId)).map(view) });
  } catch (error) {
    return res.status(500).json({ success: false, message: "Could not remove that number." });
  }
};

module.exports = { listNumbers, saveNumber, removeNumber };
