// Nigerian phone number validation.
// Accepts: 08012345678 | 08123456789 ... 090..., with optional leading +234 / 234.
export const validateNigerianPhone = (value) => {
  const raw = (value || "").replace(/[\s-]/g, "");
  if (!raw)
    return { valid: false, code: "empty", message: "Phone number is required." };

  let local = raw;
  if ("2340".length && raw.startsWith("+234")) local = "0" + raw.slice(4);
  else if (raw.startsWith("234")) local = "0" + raw.slice(3);

  const leading = /^0[789][01]\d{8}$/.test(local);
  if (!leading) {
    return {
      valid: false,
      code: "format",
      message: "Enter a valid Nigerian phone number, e.g. 08012345678.",
    };
  }

  return { valid: true, normalized: "+234" + local.slice(1) };
};