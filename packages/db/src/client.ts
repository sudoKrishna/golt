import "dotenv/config";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client";

const connectionString = `${process.env.DATABASE_URL}`;
const adapter = new PrismaPg({ connectionString });
export const prisma = new PrismaClient({ adapter });

export async function withRetry<T>(fn: () => Promise<T>, retries = 5): Promise<T> {
  for (let i = 0; i < retries; i++) {
    try {
      return await fn();
    } catch (err: any) {
          console.log("ERR CODE:", err.code);
  console.log("ERR MESSAGE:", JSON.stringify(err.message));
  console.log("ERR KEYS:", Object.keys(err));
  console.log("ERR META:", err.meta);
      const isConnectionError =
  err.code === "ETIMEDOUT" ||
  err.code === "ECONNRESET" ||
  err.code === "ECONNREFUSED" ||
  err.code === "P1001" ||
  err.code === "P1008" ||
  err.code === "P1017" ||
  err.code === "P2010" ||
  err.message?.includes("Connection terminated") ||
  err.message?.includes("Can't reach database") ||
  err.message?.includes("connection") ||
  err.message?.includes("SSL") ||
  err.message === "";

      if (isConnectionError && i < retries - 1) {
        console.log(`DB connection error (${err.code || err.message}), retrying (${i + 1}/${retries - 1})...`);
        await prisma.$disconnect();
        await new Promise(r => setTimeout(r, 3000 * (i + 1))); 
        await prisma.$connect();
        continue;
      }
      throw err;
    }
  }
  throw new Error("unreachable");
}