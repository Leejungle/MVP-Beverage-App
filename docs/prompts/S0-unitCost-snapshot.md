# PROMPT S0 — unitCost Snapshot Safety Upgrade

> Copy toàn bộ nội dung bên dưới và paste vào Sonnet 4.6 agent trong Cursor.

---

## PROMPT BẮT ĐẦU TỪ ĐÂY:

You are implementing Step S0 of a phased migration plan for a beverage shop management app.

IMPORTANT: Read these files FIRST before doing anything:
- `docs/ARCHITECTURE.md` — system architecture
- `docs/MIGRATION_STATUS.md` — current progress
- `docs/COST_ENGINE_SPEC.md` — cost calculation rules

## MISSION

Add `unitCost` snapshot to OrderItem so that historical order profit is NEVER affected by future ingredient price changes.

Currently, `unitPrice` (sale price) is snapshotted at order creation — this is correct.
But cost is recomputed from CURRENT ingredient data every time an order is read — this is WRONG for a long-term system. If the shop owner updates ingredient prices, all historical profits silently change.

Your job: make cost as immutable as price for completed orders.

## WHAT YOU MUST DO (5 tasks, in order)

### Task 1: Schema — Add unitCost to OrderItem

File: `prisma/schema.prisma`

Find the OrderItem model and add `unitCost Float?` (nullable — for backward compat with existing orders that don't have it yet).

The field should be placed right after `unitPrice` with a clear comment.

After editing schema, run: `npx prisma migrate dev --name add-unit-cost`

If the migrate command asks for confirmation or has issues with SQLite, use `npx prisma db push` as fallback.

### Task 2: POST /api/orders — Snapshot unitCost at order creation

File: `src/app/api/orders/route.ts`

Currently, when creating an order, the code snapshots unitPrice but NOT unitCost:

```typescript
// Current code (around line 196):
unitPrice: productMap.get(productId)!.salePrice,
```

You must ALSO compute and snapshot unitCost using the EXISTING legacy cost logic (we're not changing the formula yet — just snapshotting it):

```
costPerMl = purchasePrice / outputMl
costPerCup = coffeeMlPerCup × costPerMl
```

The `products` variable already includes `{ ingredient: true }` from the findMany query, and `productMap` already has the full product+ingredient data. Use it.

Import `calculateCostPerMl` and `calculateCostPerCup` from `@/lib/calculations` (they are already imported at the top of this file).

In the `items.create` mapping, add unitCost calculation:

```typescript
unitPrice: productMap.get(productId)!.salePrice,
unitCost: (() => {
  const p = productMap.get(productId)!;
  const costPerMl = calculateCostPerMl(p.ingredient.purchasePrice, p.ingredient.outputMl);
  return calculateCostPerCup(p.coffeeMlPerCup, costPerMl);
})(),
```

IMPORTANT: Keep it simple. Use the existing calculation functions. Do NOT create new abstractions yet.

### Task 3: GET /api/orders — Use snapshot when available, fallback when not

File: `src/app/api/orders/route.ts`

Find the `enrichItem` function. Currently it ALWAYS recomputes cost from current ingredient data:

```typescript
function enrichItem(item: OrderItemWithProduct) {
  const costPerMl = calculateCostPerMl(
    item.product.ingredient.purchasePrice,
    item.product.ingredient.outputMl
  );
  const costPerCup = calculateCostPerCup(item.product.coffeeMlPerCup, costPerMl);
  // ...
}
```

Change it so that:
- If `item.unitCost` is not null → use it as `costPerCup` (the snapshot)
- If `item.unitCost` is null → fallback to the current computation (for old orders)

The logic should be:

```typescript
function enrichItem(item: OrderItemWithProduct) {
  let costPerCup: number;

  if (item.unitCost != null) {
    costPerCup = item.unitCost;
  } else {
    const costPerMl = calculateCostPerMl(
      item.product.ingredient.purchasePrice,
      item.product.ingredient.outputMl
    );
    costPerCup = calculateCostPerCup(item.product.coffeeMlPerCup, costPerMl);
  }

  const profitPerCup = calculateProfitPerCup(item.unitPrice, costPerCup);
  const lineRevenue = calculateRevenue(item.quantity, item.unitPrice);
  const lineCost = calculateTotalCost(item.quantity, costPerCup);
  const lineProfit = calculateProfit(lineRevenue, lineCost);

  return { ...item, costPerCup, profitPerCup, lineRevenue, lineCost, lineProfit };
}
```

NOTE: The return object no longer includes `costPerMl` since it's not always computed. Check if the Sales page frontend uses `costPerMl` from order items — if it does, either keep computing it or remove the dependency. The Sales page (`src/app/sales/page.tsx`) does NOT use `costPerMl` in its `SavedOrderItem` interface, so this is safe.

Also update the `OrderItemWithProduct` type. Currently it doesn't include `unitCost` in its Prisma payload type. The type is inferred from the include query, so if the schema has `unitCost`, it will be included automatically. Verify this works.

### Task 4: GET /api/dashboard — Same snapshot logic

File: `src/app/api/dashboard/route.ts`

Find the `accumulateItem` function. Currently it computes cost from current ingredient data:

```typescript
const costPerMl = calculateCostPerMl(
  item.product.ingredient.purchasePrice,
  item.product.ingredient.outputMl
);
const costPerCup = calculateCostPerCup(item.product.coffeeMlPerCup, costPerMl);
```

Apply the same snapshot-first logic:

For the FIRST item of a product (when `!map.has(productId)`):
```typescript
let costPerCup: number;
if (item.unitCost != null) {
  costPerCup = item.unitCost;
} else {
  const costPerMl = calculateCostPerMl(
    item.product.ingredient.purchasePrice,
    item.product.ingredient.outputMl
  );
  costPerCup = calculateCostPerCup(item.product.coffeeMlPerCup, costPerMl);
}
```

For SUBSEQUENT items of the same product (when `map.has(productId)`):
- The existing code reuses `acc.costPerCup` from the first item — this is fine
- But if a subsequent item has a different unitCost (e.g., price changed mid-day), we should use THAT item's unitCost for its own line calculation
- For simplicity in S0: keep the current behavior (use first item's cost for all items of same product). This is acceptable because price changes mid-day are extremely rare for a 1-employee shop.

IMPORTANT: The `costPerMl` field is used in `buildBreakdownRow`. If we don't always compute it, we need to handle this. Options:
- Set `costPerMl` to 0 when using snapshot (it's only displayed in the breakdown, not critical)
- Or keep computing it regardless (for display only)

Choose the simpler option: keep computing costPerMl for display purposes, but use snapshot for the actual cost calculation.

### Task 5: Backfill script for existing orders

Create file: `scripts/backfill-unit-cost.ts`

This script should:
1. Find all OrderItems where unitCost is null
2. For each, load the product + ingredient
3. Compute unitCost using legacy formula: `coffeeMlPerCup × (purchasePrice / outputMl)`
4. Update the OrderItem with the computed unitCost
5. Log progress: how many updated, how many skipped
6. Be idempotent: running it again should not change already-filled values

Make this a simple standalone script runnable with: `npx tsx scripts/backfill-unit-cost.ts`

Add `tsx` to devDependencies if not already present.

## WHAT YOU MUST NOT DO

- Do NOT modify `src/lib/calculations.ts`
- Do NOT modify `src/app/sales/page.tsx` (Sales page UI must stay exactly the same)
- Do NOT modify Ingredient model or Product model in schema
- Do NOT remove any existing fields from any model
- Do NOT touch DailySale model or `/api/sales` routes
- Do NOT create new pages or new API routes (except the backfill script)
- Do NOT add new npm dependencies (except tsx for scripts, if needed)
- Do NOT modify `src/app/ingredients/page.tsx` or `src/app/products/page.tsx`

## VERIFICATION CHECKLIST

After completing all tasks, verify:

1. [ ] `npx prisma migrate dev` or `npx prisma db push` succeeds
2. [ ] App starts without errors: `npm run dev`
3. [ ] Create a new order on Sales page → check database: OrderItem has non-null unitCost
4. [ ] View completed orders on Sales page → revenue/cost/profit display correctly
5. [ ] View Dashboard for today → numbers are correct
6. [ ] Old orders (created before this change) still display correctly (fallback works)
7. [ ] TypeScript compiles without errors: `npx tsc --noEmit` (or no red squiggles)

## AFTER COMPLETION

Update `docs/MIGRATION_STATUS.md`:
- Change S0 status from "**NEXT**" to "**DONE**"
- Change S1 status to "**NEXT**"
- Remove the Known Issues entry about unitCost
- Update "Current Phase" to "Phase 0 — COMPLETE"
