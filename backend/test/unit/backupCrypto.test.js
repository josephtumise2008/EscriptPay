const test = require("node:test");
const assert = require("node:assert/strict");
const { encryptBackup, decryptBackup } = require("../../src/services/backupCrypto");

const PASS = "correct horse battery staple";

test("a backup opens with the right password and gives back the exact data", () => {
  const json = JSON.stringify({ users: [{ email: "a@b.c", balance: 150000 }], note: "₦ naira ✓" });
  const file = encryptBackup(json, PASS);
  assert.equal(file.subarray(0, 5).toString(), "EPBK1");
  assert.equal(file.toString("utf8").includes("a@b.c"), false, "nothing readable in the file");
  assert.equal(decryptBackup(file, PASS), json);
});

test("wrong password, a changed byte or a non-backup file is refused", () => {
  const file = encryptBackup("{\"x\":1}", PASS);
  assert.throws(() => decryptBackup(file, "wrong password here!!"), { code: "bad_password" });
  const tampered = Buffer.from(file);
  tampered[tampered.length - 1] ^= 1;
  assert.throws(() => decryptBackup(tampered, PASS), { code: "bad_password" });
  assert.throws(() => decryptBackup(Buffer.from("hello world, not a backup at all......................."), PASS), { code: "bad_file" });
});

test("short passwords are not allowed", () => {
  assert.throws(() => encryptBackup("{}", "short"), { code: "weak_passphrase" });
});
