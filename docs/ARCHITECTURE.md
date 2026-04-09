# Beverage Management System — Architecture

> This file is the single source of truth for system architecture.
> Every Cursor agent session MUST read this file before making changes.

## System Overview

A beverage shop management system that tracks ingredients, products (with multi-ingredient recipes), orders, and profit reporting. Originally a coffee-only MVP, now evolving into a general beverage cost management system.

**Stack**: Next.js 16 + React 19 + Prisma 7 + SQLite (via @prisma/adapter-better-sqlite3)
**Generated Prisma client**: `generated/prisma/`
**Single user**: 1 employee currently — no auth needed

## Data Model (Target State)

### Ingredient
- Dynamic master data — owner can create any ingredient freely from UI
- Has `unit` (ml, g, piece, shot, portion) and `purchaseQuantity`
- `costPerBaseUnit` = purchasePrice / purchaseQuantity (computed, not stored)
- NOT limited to coffee — can be tea, milk, sugar, cups, straws, toppings, etc.

### Product
- Menu item with `name` and `salePrice`
- Linked to multiple Ingredients through `ProductRecipeItem` (N:N via junction table)
- `totalCost` = Σ(recipeItem.quantityUsed × ingredient.costPerBaseUnit) — computed

### ProductRecipeItem (junction table)
- Links Product ↔ Ingredient with `quantityUsed`
- Recipe = the collection of ProductRecipeItems for one Product
- `@@unique([productId, ingredientId])`

### Order
- One customer transaction
- `orderDate` (string YYYY-MM-DD), `createdAt`, `items[]`

### OrderItem
- One line in an order: `productId`, `quantity`, `unitPrice` (snapshot), `unitCost` (snapshot)
- **CRITICAL**: Both unitPrice AND unitCost are snapshotted at Complete Order time
- Historical orders MUST use snapshots — NEVER recompute from current ingredient data

### DailySale (DEPRECATED)
- Legacy model — do NOT write new code that reads from or writes to DailySale
- Will be removed in Phase 4

## Source of Truth

| Data | Source | Notes |
|------|--------|-------|
| Sales volume | Order + OrderItem | Primary since order-based upgrade |
| Cost (current product) | Ingredient + ProductRecipeItem | For display on Product page |
| Cost (historical order) | **OrderItem.unitCost** | NEVER recompute from ingredients |
| Revenue (historical) | **OrderItem.unitPrice** | Already snapshotted |
| Daily/Monthly reporting | Computed from Orders | No summary table needed yet |

## Cost Engine Rules

```
Ingredient level:  costPerBaseUnit = purchasePrice / purchaseQuantity
Recipe line:       lineCost = quantityUsed × costPerBaseUnit
Product total:     productCost = Σ lineCosts
Order snapshot:    unitCost = productCost at Complete Order time
Order read:        profit = (quantity × unitPrice) - (quantity × unitCost)
```

All VND values: `Math.round()` to nearest integer.

## Key Principles

1. **Ingredients are dynamic** — no hard-coded ingredient lists or types
2. **Recipes are dynamic** — built from ingredient catalog, no code changes needed
3. **Staff only sees products** — Sales page: New Order → + / − → Complete Order
4. **Snapshots are sacred** — unitPrice and unitCost never change after order completion
5. **Backward compatibility** — legacy fields kept until Phase 4, fallback logic everywhere
6. **Sales flow never breaks** — Sales page UX must work throughout all migration phases

## What NOT to Do

- Do NOT read cost from current ingredient data for historical orders
- Do NOT hard-code ingredient types or fixed ingredient lists
- Do NOT break Sales page UX flow (New Order → + / − → Complete)
- Do NOT remove legacy fields (coffeeMlPerCup, ingredientId, outputMl, purchaseWeightKg) until Phase 4
- Do NOT remove DailySale model until Phase 4
- Do NOT add auth, payment, multi-branch, ERP, or inventory tracking

## File Structure

```
src/
├── lib/
│   ├── prisma.ts           # PrismaClient singleton
│   ├── calculations.ts     # LEGACY cost functions — will be replaced by costEngine.ts
│   └── costEngine.ts       # NEW recipe-based cost functions (added in Phase 2)
├── app/
│   ├── layout.tsx
│   ├── page.tsx            # Home/landing
│   ├── NavBar.tsx
│   ├── ingredients/page.tsx
│   ├── products/page.tsx
│   ├── sales/page.tsx
│   ├── dashboard/page.tsx
│   └── api/
│       ├── ingredients/     # CRUD
│       ├── products/        # CRUD + recipe sub-routes (Phase 2)
│       ├── orders/          # GET (by date), POST (create), DELETE
│       ├── dashboard/       # GET (daily + monthly reporting)
│       └── sales/           # DEPRECATED — DailySale routes
prisma/
└── schema.prisma
docs/
├── ARCHITECTURE.md          # This file
├── MIGRATION_STATUS.md      # Progress tracking
├── COST_ENGINE_SPEC.md      # Cost calculation specification
└── REPORTING_STRATEGY.md    # Reporting design decisions
```
