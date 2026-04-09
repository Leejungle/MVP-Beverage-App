// @ts-nocheck — Historical backfill script for pre-S1 data. Schema has since
// been updated (S10) and outputMl no longer exists. Script is kept as a record
// but should not be executed on the current schema.
/**
 * Backfill script — S1: purchaseQuantity for existing Ingredients
 *
 * For every Ingredient where purchaseQuantity is NULL (created before S1),
 * sets purchaseQuantity = outputMl. The unit field already defaults to "ml"
 * in the schema, so no unit update is needed.
 *
 * Run with:  npx tsx scripts/backfill-ingredient-quantity.ts
 *
 * Idempotent — rows that already have a non-null purchaseQuantity are skipped.
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Starting purchaseQuantity backfill for Ingredients…\n");

  const ingredients = await prisma.ingredient.findMany({
    where: { purchaseQuantity: null },
  });

  if (ingredients.length === 0) {
    console.log(
      "✓ No ingredients need backfilling — all purchaseQuantity values are already set."
    );
    return;
  }

  console.log(
    `Found ${ingredients.length} ingredient(s) with null purchaseQuantity. Backfilling…\n`
  );

  let updated = 0;
  let failed = 0;

  for (const ingredient of ingredients) {
    try {
      if (ingredient.outputMl <= 0) {
        console.warn(
          `  SKIP  Ingredient #${ingredient.id} "${ingredient.name}" — outputMl is ${ingredient.outputMl} (invalid)`
        );
        failed++;
        continue;
      }

      await prisma.ingredient.update({
        where: { id: ingredient.id },
        data: { purchaseQuantity: ingredient.outputMl },
      });

      console.log(
        `  OK    Ingredient #${ingredient.id} "${ingredient.name}" → purchaseQuantity = ${ingredient.outputMl} (unit: ${ingredient.unit})`
      );
      updated++;
    } catch (err) {
      console.error(`  ERROR Ingredient #${ingredient.id}:`, err);
      failed++;
    }
  }

  console.log(`\n─────────────────────────────────────`);
  console.log(`Updated : ${updated}`);
  console.log(`Skipped / failed: ${failed}`);
  console.log(`─────────────────────────────────────`);

  if (failed === 0) {
    console.log("\n✓ Backfill complete — all ingredients updated successfully.");
  } else {
    console.log(
      "\n⚠ Backfill finished with some skipped/failed rows. Check output above."
    );
    process.exit(1);
  }
}

main()
  .catch((err) => {
    console.error("Fatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
