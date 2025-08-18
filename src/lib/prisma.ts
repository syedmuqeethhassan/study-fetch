import { PrismaClient } from '@prisma/client';

// Ensure a single PrismaClient instance across hot reloads in development
const globalForPrisma = globalThis as unknown as {
	prisma: PrismaClient | undefined;
};

export const prisma: PrismaClient =
	globalForPrisma.prisma ?? new PrismaClient();

if (process.env.NODE_ENV !== 'production') {
	globalForPrisma.prisma = prisma;
}


