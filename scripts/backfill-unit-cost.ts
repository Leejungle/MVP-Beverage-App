// @ts-nocheck — Historical backfill script for pre-S0 data. Schema has since
// been updated (S10) and these field names no longer exist. Script is kept as
// a record but should not be executed on the current schema.
/**
 * Backfill script — S0: unitCost snapshot
 *
 * Finds all OrderItems where unitCost is NULL (created before S0) and
 * computes their cost using the legacy formula:
 *
 *   costPerMl = purchasePrice / outputMl
 *   unitCost  = coffeeMlPerCup × costPerMl
 *
 * Run with:  npx tsx scripts/backfill-unit-cost.ts
 *
 * Idempotent — items that already have a non-null unitCost are skipped.
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting unitCost backfill…\n");

  // Fetch all OrderItems that still need backfilling, with product + ingredient.
  const items = await prisma.orderItem.findMany({
    where: { unitCost: null },
    include: {
      product: {
        include: { ingredient: true },
      },
    },
  });

  if (items.length === 0) {
    console.log("✓ No items need backfilling — all unitCost values are already set.");
    return;
  }

  console.log(`Found ${items.length} item(s) with null unitCost. Backfilling…\n`);

  let updated = 0;
  let failed = 0;

  for (const item of items) {
    try {
      const { purchasePrice, outputMl } = item.product.ingredient;
      const { coffeeMlPerCup } = item.product;

      if (outputMl <= 0) {
        console.warn(
          `  SKIP  OrderItem #${item.id} — ingredient outputMl is ${outputMl} (invalid, cannot divide)`
        );
        failed++;
        continue;
      }

      const costPerMl = purchasePrice / outputMl;
      const unitCost = Math.round(coffeeMlPerCup * costPerMl);

      await prisma.orderItem.update({
        where: { id: item.id },
        data: { unitCost },
      });

      console.log(
        `  OK    OrderItem #${item.id} (Order #${item.orderId}, Product "${item.product.name}") → unitCost = ${unitCost} ₫`
      );
      updated++;
    } catch (err) {
      console.error(`  ERROR OrderItem #${item.id}:`, err);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Updated : ${updated}`);
  console.log(`Skipped / failed: ${failed}`);
  console.log(`─────────────────────────────────────`);

  if (failed === 0) {
    console.log("\n✓ Backfill complete — all items updated successfully.");
  } else {
    console.log("\n⚠ Backfill finished with some skipped/failed items. Check output above.");
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
