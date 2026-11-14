// One shared Prisma client. Everyone: const prisma = require('../lib/prisma');
// Prisma 7 needs a driver adapter to connect to PostgreSQL (@prisma/adapter-pg).
const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');

function createClient() {
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
  return new PrismaClient({ adapter });
}

const prisma = global.__prisma || createClient();
if (process.env.NODE_ENV !== 'production') global.__prisma = prisma;

module.exports = prisma;
