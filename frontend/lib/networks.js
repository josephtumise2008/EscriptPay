// Guess a Nigerian number's network from its prefix. Numbers can be ported to
// another network, so this only pre-selects; the customer can always change it.
const PREFIXES = {
  MTN: ["0703", "0704", "0706", "0803", "0806", "0810", "0813", "0814", "0816", "0903", "0906", "0913", "0916", "07025", "07026"],
  Airtel: ["0701", "0708", "0802", "0808", "0812", "0901", "0902", "0904", "0907", "0911", "0912"],
  Glo: ["0705", "0805", "0807", "0811", "0815", "0905", "0915"],
  "9mobile": ["0809", "0817", "0818", "0908", "0909"],
};

const LOOKUP = Object.entries(PREFIXES)
  .flatMap(([network, list]) => list.map((prefix) => [prefix, network]))
  .sort((a, b) => b[0].length - a[0].length); // 5-digit prefixes first

// "+234 803…" / "234803…" / "0803…" -> "0803…"
export const toLocalNumber = (value) => {
  const raw = String(value || "").replace(/[^\d+]/g, "");
  if (raw.startsWith("+234")) return `0${raw.slice(4)}`;
  if (raw.startsWith("234") && raw.length > 10) return `0${raw.slice(3)}`;
  return raw;
};

export const detectNetwork = (value) => {
  const local = toLocalNumber(value);
  if (local.length < 4) return null;
  const hit = LOOKUP.find(([prefix]) => local.startsWith(prefix));
  return hit ? hit[1] : null;
};

export const prefixOf = (value) => toLocalNumber(value).slice(0, 5);
