// Reads a private value for admin scripts: from the environment first, then
// from git-ignored files in backend/ (.env.clubkonnect, .env.atlas).
// Values are never printed.
const fs = require("fs");
const path = require("path");
const readline = require("readline");

const FILES = [".env.clubkonnect", ".env.atlas"];

const readPrivate = (name) => {
  const fromEnv = (process.env[name] || "").trim();
  if (fromEnv) return fromEnv;
  for (const file of FILES) {
    const full = path.join(__dirname, "..", "..", file);
    if (!fs.existsSync(full)) continue;
    const line = fs
      .readFileSync(full, "utf8")
      .split(/\r?\n/)
      .find((l) => l.trim().startsWith(`${name}=`));
    if (line) return line.trim().slice(name.length + 1).trim().replace(/^["']|["']$/g, "");
  }
  return "";
};

// Loads ClubKonnect credentials into process.env for the adapter.
const loadClubkonnect = () => {
  const userId = readPrivate("CLUBKONNECT_USER_ID");
  const apiKey = readPrivate("CLUBKONNECT_API_KEY");
  if (!userId || !apiKey) {
    console.error(
      "ClubKonnect credentials not found.\n" +
        "Create the file backend/.env.clubkonnect (Git ignores it) with two lines:\n" +
        "  CLUBKONNECT_USER_ID=your user id\n" +
        "  CLUBKONNECT_API_KEY=your api key\n" +
        "Nothing was sent."
    );
    process.exit(1);
  }
  process.env.CLUBKONNECT_USER_ID = userId;
  process.env.CLUBKONNECT_API_KEY = apiKey;
};

const ask = (question) =>
  new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });

const askHidden = (question) =>
  new Promise((resolve) => {
    // Print the question on its own line first: some terminals swallow text
    // written on the same line once input echo is turned off.
    console.log(`\n${question.trim()}`);
    console.log("(Paste it and press Enter — it stays hidden, nothing will show while you paste.)");
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = () => {};
    rl.question("", (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    });
  });

const flag = (name) => process.argv.includes(`--${name}`);
const option = (name) => {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith("--") ? process.argv[i + 1] : null;
};

module.exports = { readPrivate, loadClubkonnect, ask, askHidden, flag, option };
