// Email templates: simple, mobile-friendly, inline styles (email clients
// ignore <style> blocks). Every email has a plain-text version too.

const escape = (s) =>
  String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);

const layout = (title, inner) => `<!doctype html><html><body style="margin:0;background:#f4f3ff;font-family:Inter,Segoe UI,Arial,sans-serif;color:#0f172a">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 12px"><tr><td align="center">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border-radius:20px;overflow:hidden;box-shadow:0 10px 30px rgba(91,79,240,.12)">
<tr><td style="background:linear-gradient(135deg,#7c3aed,#5b4ff0 50%,#0ea5e9);padding:22px 28px;color:#ffffff;font-size:20px;font-weight:800;letter-spacing:-.01em">EscriptPay</td></tr>
<tr><td style="padding:28px">
<h1 style="margin:0 0 12px;font-size:20px;line-height:1.3">${escape(title)}</h1>
${inner}
</td></tr>
<tr><td style="padding:16px 28px 24px;font-size:12px;color:#64748b;border-top:1px solid #eef2f7">You received this email because of activity on your EscriptPay account. If this wasn't you, you can ignore it.</td></tr>
</table></td></tr></table></body></html>`;

const verificationCode = ({ name, code, minutes }) => {
  const first = escape(String(name || "").split(" ")[0] || "there");
  const spaced = code.split("").join(" ");
  return {
    subject: `${code} is your EscriptPay verification code`,
    html: layout(
      "Confirm your email",
      `<p style="margin:0 0 18px;font-size:15px;line-height:1.6;color:#334155">Hi ${first}, use this code to verify your email address:</p>
<div style="font-size:34px;font-weight:800;letter-spacing:.3em;text-align:center;background:#f5f3ff;border-radius:14px;padding:18px 0;color:#5b21b6">${spaced}</div>
<p style="margin:18px 0 0;font-size:13px;color:#64748b">The code expires in ${minutes} minutes. Never share it with anyone — EscriptPay will never ask you for it.</p>`
    ),
    text: `Hi ${first}, your EscriptPay verification code is ${code}. It expires in ${minutes} minutes. Never share it with anyone.`,
  };
};

const passwordReset = ({ name, link, minutes }) => {
  const first = escape(String(name || "").split(" ")[0] || "there");
  return {
    subject: "Reset your EscriptPay password",
    html: layout(
      "Reset your password",
      `<p style="margin:0 0 20px;font-size:15px;line-height:1.6;color:#334155">Hi ${first}, we received a request to reset your password. Tap the button below to choose a new one.</p>
<p style="margin:0 0 20px"><a href="${escape(link)}" style="display:inline-block;background:#6d28d9;color:#ffffff;text-decoration:none;font-weight:700;padding:14px 26px;border-radius:12px">Reset password</a></p>
<p style="margin:0;font-size:13px;color:#64748b">This link expires in ${minutes} minutes and can only be used once. If you didn't ask for this, ignore this email — your password won't change.</p>`
    ),
    text: `Hi ${first}, reset your EscriptPay password here (expires in ${minutes} minutes): ${link}\nIf you didn't ask for this, ignore this email.`,
  };
};

module.exports = { verificationCode, passwordReset };
