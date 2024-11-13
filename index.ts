// performance-test.ts
import { PrismaClient } from "@prisma/client";
import { performance } from "perf_hooks";
import mysql from "mysql2/promise";
import {
  getTopSpendingRaw,
  getTopSpendingPrisma,
  getCountForSpenderCategoryRaw,
  getCountForSpenderCategoryPrisma,
  getLast10WeekSalesRaw,
  getLast10WeekSalesPrisma,
} from "./functions";

async function main() {
  const prisma = new PrismaClient();
  const connection = await mysql.createConnection({
    host: "localhost",
    user: "root",
    password: "Pixicode",
    database: "demo",
  });

  const measurePerformance = async (name: string, fn: () => Promise<any>) => {
    const start = performance.now();
    await fn();
    const end = performance.now();
    return {
      name,
      duration: end - start,
    };
  };

  // example 1 - get top sependers
  // using rawQuery
  const rawTopSpendingQuery = async () => {
    return await getTopSpendingRaw(connection);
  };

  // using prisma
  const prismaTopSpendingQuery = async () => {
    return await getTopSpendingPrisma(prisma);
  };

  // example 2 - get count for spender category
  // using rawQuery
  const rawCountQuery = async () => {
    return await getCountForSpenderCategoryRaw(connection);
  };

  // using prisma
  const prismaCountQuery = async () => {
    return await getCountForSpenderCategoryPrisma(prisma);
  };

  // example 3 - get last 10 week sales
  // using rawQuery
  const rawLast10WeekSalesQuery = async () => {
    return await getLast10WeekSalesRaw(connection);
  };

  // using prisma
  const prismaLast10WeekSalesQuery = async () => {
    return await getLast10WeekSalesPrisma(prisma);
  };

  const runPerformanceTests = async () => {
    const tests = [
      { name: "Raw SQL - Complex Join", fn: rawTopSpendingQuery },
      { name: "Prisma - Complex Join", fn: prismaTopSpendingQuery },
      { name: "Raw SQL - Count Case", fn: rawCountQuery },
      { name: "Prisma - Count Case", fn: prismaCountQuery },
      { name: "Raw SQL - Weekly Sales", fn: rawLast10WeekSalesQuery },
      { name: "Prisma - Weekly Sales", fn: prismaLast10WeekSalesQuery },
    ];

    // Warm up
    for (const test of tests) {
      await test.fn();
    }

    // Actual tests
    const results = [];
    for (const test of tests) {
      const iterations = 100;
      let totalTime = 0;

      for (let i = 0; i < iterations; i++) {
        const { duration } = await measurePerformance(test.name, test.fn);
        totalTime += duration;
      }

      results.push({
        name: test.name,
        avgDuration_ms: parseFloat((totalTime / iterations).toFixed(2)),
      });
    }

    return results;
  };

  const results = await runPerformanceTests();
  console.table(results);
  await prisma.$disconnect();
  await connection.end();
  return;
}

main().catch(console.error);
