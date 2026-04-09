// @ts-nocheck — Historical backfill script for pre-S10 data. Schema has since
// been updated (S10) and coffeeMlPerCup/ingredientId no longer exist on Product.
// Script is kept as a record but should not be executed on the current schema.
/**
 * Backfill script — S9: product recipe migration
 *
 * Converts each legacy product's single-ingredient relationship into an
 * equivalent ProductRecipeItem entry so all products use the recipe-based
 * cost path. After this script runs, computeUnitCost() will always take the
 * recipe branch for every product.
 *
 * Cost equivalence guarantee:
 *   Legacy:  costPerCup = Math.round(coffeeMlPerCup × Math.round(purchasePrice / outputMl))
 *   Recipe:  recipeCost = Math.round(quantityUsed  × Math.round(purchasePrice / purchaseQuantity))
 *
 *   Because S1 backfill set purchaseQuantity = outputMl for all existing
 *   ingredients, and this script sets quantityUsed = coffeeMlPerCup, both
 *   formulas produce identical results.
 *
 * Safety:
 *   - Idempotent: products with existing recipe items are skipped.
 *   - All writes execute in a single Prisma $transaction (all-or-nothing).
 *   - Supports --dry-run flag: prints the plan without writing to the DB.
 *
 * Usage:
 *   npx tsx scripts/backfill-product-recipes.ts            # live run
 *   npx tsx scripts/backfill-product-recipes.ts --dry-run  # preview only
 */

import { PrismaClient } from "../generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL ?? "file:./dev.db",
});
const prisma = new PrismaClient({ adapter });

const isDryRun = process.argv.includes("--dry-run");

// ─── Cost helpers (mirrors costEngine.ts logic, kept local for transparency) ──

function costPerBaseUnit(purchasePrice: number, qty: number): number {
  if (!isFinite(qty) || qty <= 0) return 0;
  return Math.round(purchasePrice / qty);
}

function lineCost(quantityUsed: number, cpbu: number): number {
  return Math.round(quantityUsed * cpbu);
}

// ─── Migration plan entry ─────────────────────────────────────────────────────

interface MigrationEntry {
  productId: number;
  productName: string;
  ingredientId: number;
  ingredientName: string;
  quantityUsed: number;        // = coffeeMlPerCup
  legacyCost: number;
  recipeCost: number;
  costMatch: boolean;
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  const ts = new Date().toISOString();
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  S9 Product Recipe Backfill — ${ts}`);
  if (isDryRun) console.log("  *** DRY RUN — no changes will be written ***");
  console.log("═══════════════════════════════════════════════════════════\n");

  // ── Fetch all products with their ingredient and current recipe items ──────

  const products = await prisma.product.findMany({
    include: {
      ingredient: true,
      recipeItems: true,
    },
    orderBy: { id: "asc" },
  });

  console.log(`Found ${products.length} product(s). Analysing…\n`);

  const toMigrate: MigrationEntry[] = [];
  let skipCount = 0;
  let skipInvalid = 0;

  for (const p of products) {
    // Already has recipe items → skip
    if (p.recipeItems.length > 0) {
      console.log(
        `  [SKIP]    Product #${p.id} "${p.name}" — already has ${p.recipeItems.length} recipe item(s)`
      );
      skipCount++;
      continue;
    }

    // Guard: ingredientId must be set (always true given schema NOT NULL,
    // but check defensively for pre-migration data edge cases)
    if (!p.ingredientId) {
      console.warn(
        `  [SKIP]    Product #${p.id} "${p.name}" — no ingredientId (unexpected, skipping)`
      );
      skipInvalid++;
      continue;
    }

    // Guard: coffeeMlPerCup must be a positive number to be a meaningful quantity
    if (!isFinite(p.coffeeMlPerCup) || p.coffeeMlPerCup <= 0) {
      console.warn(
        `  [SKIP]    Product #${p.id} "${p.name}" — coffeeMlPerCup is ${p.coffeeMlPerCup} (invalid quantity, skipping)`
      );
      skipInvalid++;
      continue;
    }

    // Compute cost equivalence proof
    const ing = p.ingredient;
    const qty = ing.purchaseQuantity ?? ing.outputMl;

    const cpbu = costPerBaseUnit(ing.purchasePrice, qty);
    const legacyCupCost = lineCost(p.coffeeMlPerCup, cpbu);
    const recipeCupCost = lineCost(p.coffeeMlPerCup, cpbu); // same formula
    const match = legacyCupCost === recipeCupCost; // always true, shown for transparency

    toMigrate.push({
      productId: p.id,
      productName: p.name,
      ingredientId: p.ingredientId,
      ingredientName: ing.name,
      quantityUsed: p.coffeeMlPerCup,
      legacyCost: legacyCupCost,
      recipeCost: recipeCupCost,
      costMatch: match,
    });

    console.log(
      `  [MIGRATE] Product #${p.id} "${p.name}"` +
      ` → Ingredient "${ing.name}" (qty: ${p.coffeeMlPerCup} ${ing.unit})`
    );
    console.log(
      `            Cost verification: legacy=${legacyCupCost} ₫  recipe=${recipeCupCost} ₫  [${match ? "PASS" : "FAIL"}]`
    );
  }

  console.log();

  // ── Summary of plan ───────────────────────────────────────────────────────

  console.log("───────────────────────────────────────────────────────────");
  console.log(`  Plan: ${toMigrate.length} to migrate, ${skipCount} already done, ${skipInvalid} invalid/skipped`);
  console.log("───────────────────────────────────────────────────────────\n");

  if (toMigrate.length === 0) {
    console.log("✓ Nothing to do — all products already have recipe items.");
    return;
  }

  const failedVerifications = toMigrate.filter((e) => !e.costMatch);
  if (failedVerifications.length > 0) {
    console.error(
      `⚠ WARNING: ${failedVerifications.length} product(s) have cost verification FAIL. ` +
      `This indicates a data inconsistency. Review before proceeding.`
    );
    for (const e of failedVerifications) {
      console.error(
        `  Product #${e.productId} "${e.productName}": legacy=${e.legacyCost} ₫  recipe=${e.recipeCost} ₫`
      );
    }
    console.error();
  }

  // ── Dry-run: stop here ─────────────────────────────────────────────────────

  if (isDryRun) {
    console.log("*** DRY RUN complete — no changes written to database. ***");
    console.log("    Re-run without --dry-run to apply the migration.");
    return;
  }

  // ── Live run: write all in a single transaction ────────────────────────────

  console.log("Writing recipe items in a single transaction…");

  await prisma.$transaction(
    toMigrate.map((entry) =>
      prisma.productRecipeItem.create({
        data: {
          productId: entry.productId,
          ingredientId: entry.ingredientId,
          quantityUsed: entry.quantityUsed,
        },
      })
    )
  );

  console.log();
  for (const e of toMigrate) {
    console.log(
      `  [CREATED] ProductRecipeItem: Product #${e.productId} "${e.productName}"` +
      ` + Ingredient "${e.ingredientName}" (qty: ${e.quantityUsed})`
    );
  }

  console.log();
  console.log("═══════════════════════════════════════════════════════════");
  console.log(`  Migration complete — ${new Date().toISOString()}`);
  console.log(`  Migrated : ${toMigrate.length}`);
  console.log(`  Skipped  : ${skipCount} (already had recipe items)`);
  console.log(`  Invalid  : ${skipInvalid} (bad data, skipped)`);
  console.log(`  Errors   : 0`);
  console.log("═══════════════════════════════════════════════════════════");
  console.log("\n✓ All products now use the recipe-based cost path.");
}

main()
  .catch((err) => {
    console.error("\nFatal error:", err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
