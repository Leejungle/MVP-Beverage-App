# Cost Engine Specification

> Defines all cost calculation rules. Agents implementing cost logic MUST follow this spec.

## Calculation Tiers

### Tier 1 — Ingredient Cost per Base Unit
```
costPerBaseUnit = Math.round(purchasePrice / purchaseQuantity)
```
- Inputs: ingredient.purchasePrice, ingredient.purchaseQuantity (or legacy outputMl)
- Output: VND per base unit (integer)
- Edge case: if purchaseQuantity <= 0 or invalid → return 0

### Tier 2 — Recipe Line Cost
```
lineCost = Math.round(quantityUsed × costPerBaseUnit)
```
- Inputs: recipeItem.quantityUsed, ingredient.costPerBaseUnit
- Output: VND contribution of this ingredient to one serving

### Tier 3 — Product Total Cost
```
productTotalCost = Σ (each recipeItem lineCost)
```
- If product has recipeItems → sum all line costs
- If product has NO recipeItems (legacy) → fallback to coffeeMlPerCup × costPerMl

### Tier 4 — Product Display Metrics
```
profit = salePrice - productTotalCost
margin = Math.round((profit / salePrice) × 1000) / 10   // 1 decimal %
```

### Tier 5 — OrderItem Snapshot (at Complete Order time)
```
unitCost = productTotalCost   // snapshot, stored permanently
unitPrice = product.salePrice  // snapshot, already implemented
```

### Tier 6 — Order Read (from snapshots only)
```
lineRevenue = quantity × unitPrice
lineCost    = quantity × unitCost
lineProfit  = lineRevenue - lineCost
```
**NEVER recompute unitCost from ingredients for saved orders.**

### Tier 7 — Daily/Monthly Aggregation
```
dailyProfit = Σ (all OrderItems for date) lineProfit
monthlyProfit = Σ (all OrderItems for month) lineProfit
```

## Rounding Rules
- All VND values: `Math.round()` to nearest integer
- Margin percentage: 1 decimal place
- No floating point accumulation errors: round at each tier, not just at the end

## Fallback Logic (during migration)

| Scenario | Action |
|----------|--------|
| Product WITH recipeItems | Use recipe-based cost (Tier 1-3) |
| Product WITHOUT recipeItems | Use legacy: `coffeeMlPerCup × (purchasePrice / outputMl)` |
| OrderItem WITH unitCost | Use snapshot (Tier 6) |
| OrderItem WITHOUT unitCost (null) | Fallback: compute from product's current cost |

## Example: Cà Phê Sữa Đá (salePrice = 25,000 VND)

| Ingredient | purchasePrice | purchaseQty | unit | costPerBase | qtyUsed | lineCost |
|-----------|--------------|-------------|------|-------------|---------|----------|
| Cà phê Robusta | 200,000 | 1,000 | ml | 200 | 40 | 8,000 |
| Sữa đặc | 30,000 | 500 | g | 60 | 30 | 1,800 |
| Đá viên | 30,000 | 200 | portion | 150 | 1 | 150 |
| Ly nhựa 400ml | 45,000 | 100 | piece | 450 | 1 | 450 |
| Ống hút | 20,000 | 200 | piece | 100 | 1 | 100 |

**productTotalCost** = 8,000 + 1,800 + 150 + 450 + 100 = **10,500 VND**
**profit** = 25,000 - 10,500 = **14,500 VND** (margin 58%)
