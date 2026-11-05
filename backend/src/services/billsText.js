// Reads exam PINs out of the supplier's text, e.g.
// "Serial No:WRN200343867, pin: 572871474684; Serial No:…" -> [{ serial, pin }]
const parsePins = (text) => {
  const out = [];
  const re = /serial\s*(?:no|number)?\s*[:.-]?\s*([A-Z0-9-]+)[\s,;|]+pin\s*[:.-]?\s*([A-Z0-9-]+)/gi;
  let m;
  while ((m = re.exec(String(text || ""))) && out.length < 20) out.push({ serial: m[1], pin: m[2] });
  return out;
};

module.exports = { parsePins };
