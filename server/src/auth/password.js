// Password hashing with bcrypt (NFR-10: salted, adaptive; never logged or returned).

const bcrypt = require('bcrypt');

const ROUNDS = Number(process.env.BCRYPT_ROUNDS) || 10;

function hashPassword(plain) {
  return bcrypt.hash(plain, ROUNDS);
}

function checkPassword(plain, hash) {
  return bcrypt.compare(plain, hash);
}

// When the email doesn't exist we still do one bcrypt compare, so a wrong email
// takes as long as a wrong password (nobody can time the reply to find accounts).
let dummyHash;
async function wasteSameTime(plain) {
  if (!dummyHash) dummyHash = await bcrypt.hash('not-a-real-password-1', ROUNDS);
  await bcrypt.compare(plain, dummyHash);
}

module.exports = { hashPassword, checkPassword, wasteSameTime };
