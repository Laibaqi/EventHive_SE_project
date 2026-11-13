// Where OTP rows are kept. prismaStore is used in the app; memoryStore is used by the tests
// (and lets Laiba/Zain try the flow before the database is ready).

function prismaStore(prisma) {
  return {
    findLatest: (email, purpose) =>
      prisma.otpCode.findFirst({ where: { email, purpose }, orderBy: { createdAt: 'desc' } }),
    findActive: (email, purpose) =>
      prisma.otpCode.findFirst({ where: { email, purpose, usedAt: null }, orderBy: { createdAt: 'desc' } }),
    create: (data) => prisma.otpCode.create({ data }),
    invalidateActive: (email, purpose, at) =>
      prisma.otpCode.updateMany({ where: { email, purpose, usedAt: null }, data: { usedAt: at } }),
    incrementAttempts: async (id) =>
      (await prisma.otpCode.update({ where: { id }, data: { attempts: { increment: 1 } } })).attempts,
    markUsed: async (id, at) =>
      (await prisma.otpCode.updateMany({ where: { id, usedAt: null }, data: { usedAt: at } })).count === 1,
  };
}

function memoryStore() {
  const rows = [];
  let nextId = 1;
  const newest = (list) => list.sort((a, b) => b.createdAt - a.createdAt)[0] || null;
  return {
    rows,
    findLatest: async (email, purpose) => newest(rows.filter((r) => r.email === email && r.purpose === purpose)),
    findActive: async (email, purpose) =>
      newest(rows.filter((r) => r.email === email && r.purpose === purpose && !r.usedAt)),
    create: async (data) => { const r = { id: nextId++, ...data }; rows.push(r); return r; },
    invalidateActive: async (email, purpose, at) => {
      rows.filter((r) => r.email === email && r.purpose === purpose && !r.usedAt).forEach((r) => { r.usedAt = at; });
    },
    incrementAttempts: async (id) => { const r = rows.find((x) => x.id === id); r.attempts += 1; return r.attempts; },
    markUsed: async (id, at) => {
      const r = rows.find((x) => x.id === id);
      if (!r || r.usedAt) return false;
      r.usedAt = at;
      return true;
    },
  };
}

module.exports = { prismaStore, memoryStore };
