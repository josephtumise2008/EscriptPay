const bills = require("../services/bills");
const { vtu } = require("../services");
const { logEvent } = require("../utils/logger");

// GET /api/bills/catalog — cable packages, electricity companies, exam PINs
// with our prices (no costs). Same for everyone, so the CDN may cache it.
const getCatalog = async (req, res) => {
  try {
    const catalog = await bills.publicCatalog();
    res.set("Cache-Control", "public, max-age=0, s-maxage=120, stale-while-revalidate=600");
    return res.json({ success: true, catalog });
  } catch (error) {
    logEvent("bill.catalog_error", { message: error && error.message });
    return res.status(502).json({ success: false, message: "Could not load services right now. Please try again." });
  }
};

// POST /api/bills/verify { service, provider, account, meterType }
// -> { name } — shown to the customer to confirm before paying.
const verify = async (req, res) => {
  const b = req.body || {};
  const service = String(b.service || "");
  const provider = String(b.provider || "").trim().toLowerCase();
  const account = String(b.account || "").replace(/\s/g, "");
  const meterType = String(b.meterType || "");
  const ok =
    /^\d{6,16}$/.test(account) &&
    ((service === "cable" && bills.CABLE_PROVIDERS.some((p) => p.id === provider)) ||
      (service === "electricity" && bills.DISCOS.some((d) => d.code === provider) && ["01", "02"].includes(meterType)) ||
      (service === "exam" && provider === "jamb"));
  if (!ok) return res.status(400).json({ success: false, message: "Check the details and try again." });
  try {
    const result = await vtu.verifyAccount({ service, provider, account, meterType });
    if (!result.valid) {
      return res.status(404).json({
        success: false,
        code: "invalid_account",
        message:
          service === "cable"
            ? "That smartcard / IUC number wasn't found."
            : service === "electricity"
              ? "That meter number wasn't found for this company and meter type."
              : "That JAMB Profile ID wasn't found.",
      });
    }
    return res.json({ success: true, name: result.name });
  } catch (error) {
    logEvent("bill.verify_error", { service, code: error && error.code });
    return res.status(502).json({ success: false, message: "We couldn't check that right now. Please try again." });
  }
};

module.exports = { getCatalog, verify };
