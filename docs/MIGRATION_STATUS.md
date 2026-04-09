# Migration Status

> Updated after each step is completed. Agents MUST read this before starting work.

## Current Phase: Phase 4 — COMPLETE

**Migration complete. All products use recipe-based cost. Legacy code fully removed.**

## Step Progress

| Step | Phase | Description | Status | Notes |
|------|-------|-------------|--------|-------|
| S0 | 0 | unitCost snapshot safety upgrade | **DONE** | unitCost snapshotted on POST /api/orders; enrichItem + accumulateItem use snapshot-first logic; backfill script run successfully |
| S1 | 1 | Ingredient model upgrade (unit + purchaseQuantity) | **DONE** | unit (default "ml") + purchaseQuantity (nullable) added; POST + PUT accept new fields, backward-compat maintained; backfill script run |
| S2 | 1 | Ingredient page UI refresh | **DONE** | Unit dropdown + dynamic Purchase Quantity label + live cost preview + new table (Name/Unit/Price/Quantity/Cost per Unit); outputMl sent silently for backward compat |
| S3 | 2 | ProductRecipeItem schema + API | **DONE** | ProductRecipeItem model + migration; GET/POST /api/products/[id]/recipe; DELETE /api/products/[id]/recipe/[itemId]; GET /api/products returns recipeItems + recipeCost |
| S4 | 2 | Cost engine module (costEngine.ts) | **DONE** | src/lib/costEngine.ts created with all pure functions (ingredientCostPerBaseUnit, recipeLineCost, productRecipeCost, productProfit, productMargin, computeUnitCost, computeRecipeCostOrNull); Products API refactored to use costEngine |
| S5 | 2 | Product page Recipe Builder UI | **DONE** | New table (Name/Sale Price/Cost/Profit/Margin/Actions); expandable Recipe Builder per product; add/remove recipe items; per-line cost + recipe totals |
| S6 | 2 | Orders integration with recipe-based cost | **DONE** | POST /api/orders fetches recipeItems; unitCost snapshot uses computeUnitCost() from costEngine |
| S7 | 2-3 | Sales page polish | **DONE** | Product interface updated; effectiveCostForProduct() uses recipeCost; product grid shows effective cost |
| S8 | 3 | Dashboard daily/monthly reporting | **DONE** | API extended: ?month=YYYY-MM returns monthly totals + dailyBreakdown; page adds Day/Month toggle, TotalsGrid, Margin card, monthly table with drill-down; beverage-generic labels |
| S9 | 3 | Data backfill script | **DONE** | scripts/backfill-product-recipes.ts; all legacy products migrated to ProductRecipeItem; idempotent + --dry-run + $transaction; cost PASS for all |
| S10 | 4 | Legacy cleanup | **DONE** | All legacy fields removed from schema; DailySale model dropped; calculations.ts deleted; costEngine.ts simplified; all APIs and pages updated; tsc --noEmit = 0 errors |

## Known Issues

None. Migration is complete.

## What was removed in S10

### Schema
- `Ingredient.outputMl` — removed (superseded by `purchaseQuantity`)
- `Ingredient.purchaseWeightKg` — removed (informational only, never used in cost)
- `Ingredient.products` — removed (direct FK from Product to Ingredient is gone)
- `Product.coffeeMlPerCup` — removed (superseded by ProductRecipeItem)
- `Product.ingredientId` — removed (superseded by N:N through ProductRecipeItem)
- `Product.ingredient` — removed (direct relation)
- `Product.dailySales` — removed (DailySale model dropped)
- `DailySale` model — dropped entirely

### Files
- `src/lib/calculations.ts` — deleted (superseded by costEngine.ts)
- `src/app/api/sales/route.ts` — deleted (DailySale-based, replaced by orders API)
- `src/app/api/sales/[id]/route.ts` — deleted (DailySale-based)

### Backfill scripts
Scripts in `scripts/` are preserved as historical records but annotated with
`@ts-nocheck` since they reference fields that no longer exist in the schema.
They must not be run on the current database.
