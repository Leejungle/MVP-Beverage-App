// ─────────────────────────────────────────────────────────────────────────────
// Beverage Shop — Recipe-Based Cost Engine
//
// Pure functions only — no Prisma, no I/O, no side effects.
// All functions accept plain interfaces (not Prisma types) so this module
// is framework-independent and trivially unit-testable.
//
// Currency: VND (Vietnamese Dong).
// Rounding rule: Math.round() at EVERY tier to avoid floating-point
// accumulation errors.
//
// Spec reference: docs/COST_ENGINE_SPEC.md
// ─────────────────────────────────────────────────────────────────────────────

// ─── Input interfaces ─────────────────────────────────────────────────────────

/** Minimum ingredient fields required for cost calculations. */
export interface IngredientForCost {
  purchasePrice: number;
  purchaseQuantity: number;
}

/** One line of a product's recipe. */
export interface RecipeItemForCost {
  quantityUsed: number;
  ingredient: IngredientForCost;
}

/** Minimum product fields needed for the unitCost snapshot. */
export interface ProductForCost {
  salePrice: number;
  recipeItems: RecipeItemForCost[];
}

// ─── Tier 1: Ingredient cost per base unit ────────────────────────────────────

/**
 * Cost of one base unit of this ingredient (1 ml / 1 g / 1 piece / etc.).
 *
 * Formula: Math.round(purchasePrice / purchaseQuantity)
 *
 * Returns 0 for invalid or zero-quantity inputs.
 */
export function ingredientCostPerBaseUnit(ing: IngredientForCost): number {
  if (
    !isFinite(ing.purchasePrice) ||
    !isFinite(ing.purchaseQuantity) ||
    ing.purchaseQuantity <= 0
  ) {
    return 0;
  }
  return Math.round(ing.purchasePrice / ing.purchaseQuantity);
}

// ─── Tier 2: Recipe line cost ─────────────────────────────────────────────────

/**
 * Cost contribution of one recipe line to a single serving.
 *
 * Formula: Math.round(quantityUsed × costPerBaseUnit)
 *
 * Returns 0 for invalid or negative inputs.
 */
export function recipeLineCost(
  quantityUsed: number,
  costPerBaseUnit: number
): number {
  if (
    !isFinite(quantityUsed) ||
    !isFinite(costPerBaseUnit) ||
    quantityUsed < 0
  ) {
    return 0;
  }
  return Math.round(quantityUsed * costPerBaseUnit);
}

// ─── Tier 3: Product total cost ───────────────────────────────────────────────

/**
 * Sum of all recipe line costs for one serving of a product.
 *
 * Formula: Σ (recipeLineCost(item.quantityUsed, ingredientCostPerBaseUnit(item.ingredient)))
 *
 * Returns 0 when recipeItems is empty.
 */
export function productRecipeCost(recipeItems: RecipeItemForCost[]): number {
  let total = 0;
  for (const item of recipeItems) {
    const cpbu = ingredientCostPerBaseUnit(item.ingredient);
    total += recipeLineCost(item.quantityUsed, cpbu);
  }
  return total;
}

// ─── Tier 4: Product display metrics ─────────────────────────────────────────

/**
 * Profit per serving given the sale price and total product cost.
 * Can be negative (selling at a loss).
 */
export function productProfit(salePrice: number, totalCost: number): number {
  if (!isFinite(salePrice) || !isFinite(totalCost)) return 0;
  return Math.round(salePrice - totalCost);
}

/**
 * Profit margin as a percentage rounded to 1 decimal place.
 * Returns 0 when salePrice is zero or invalid.
 *
 * Formula: Math.round((profit / salePrice) × 1000) / 10
 */
export function productMargin(salePrice: number, totalCost: number): number {
  if (!isFinite(salePrice) || salePrice <= 0) return 0;
  const profit = salePrice - totalCost;
  return Math.round((profit / salePrice) * 1000) / 10;
}

// ─── Tier 5: OrderItem snapshot helper ───────────────────────────────────────

/**
 * Computes the unitCost value to snapshot into OrderItem when an order is
 * completed (Tier 5 of the cost engine spec).
 *
 * All products have recipe items after S9. Recipe-based cost is always used.
 * If recipeItems is empty (defensive), returns 0.
 */
export function computeUnitCost(product: ProductForCost): number {
  if (product.recipeItems.length > 0) {
    return productRecipeCost(product.recipeItems);
  }
  // Defensive fallback — should never be reached after S9 backfill.
  return 0;
}

// ─── API response helper ──────────────────────────────────────────────────────

/**
 * Returns the recipe-based total cost for the Products API `recipeCost` field.
 *
 * Returns null  when the product has no recipe items.
 * Returns number when recipe items exist — the computed total recipe cost.
 */
export function computeRecipeCostOrNull(
  recipeItems: RecipeItemForCost[]
): number | null {
  if (recipeItems.length === 0) return null;
  return productRecipeCost(recipeItems);
}
