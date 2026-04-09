import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeRecipeCostOrNull } from "@/lib/costEngine";
import { Prisma } from "../../../../generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { recipeItems: { include: { ingredient: true } } };
}>;

// ─── Prisma include shape — reused in GET and POST ───────────────────────────

const productInclude = {
  recipeItems: { include: { ingredient: true } },
} as const;

// ─── Local helper ─────────────────────────────────────────────────────────────
// Attaches derived cost / profit / margin to a product that already has
// recipeItems included. Called after every read so the response shape is
// always consistent.

function withDerived(product: ProductWithRelations) {
  const recipeCost = computeRecipeCostOrNull(product.recipeItems);
  const profit =
    recipeCost !== null ? Math.round(product.salePrice - recipeCost) : null;
  const margin =
    recipeCost !== null && product.salePrice > 0
      ? Math.round(((product.salePrice - recipeCost) / product.salePrice) * 1000) / 10
      : null;

  return { ...product, recipeCost, profit, margin };
}

// ─── GET /api/products ────────────────────────────────────────────────────────
// Returns all products newest first, each with recipeItems and derived fields.
export async function GET() {
  try {
    const products = await prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: productInclude,
    });

    return NextResponse.json({ data: products.map(withDerived) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch products" },
      { status: 500 }
    );
  }
}

// ─── POST /api/products ───────────────────────────────────────────────────────
// Creates a new product. Requires name and salePrice only.
// Ingredient cost is managed entirely through the Recipe Builder (ProductRecipeItem).
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    const name = typeof body.name === "string" ? body.name.trim() : "";
    const salePrice = Number(body.salePrice);

    const errors: string[] = [];
    if (!name) errors.push("name is required");
    if (!isFinite(salePrice) || salePrice <= 0)
      errors.push("salePrice must be > 0");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    const product = await prisma.product.create({
      data: { name, salePrice },
      include: productInclude,
    });

    return NextResponse.json({ data: withDerived(product) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create product" },
      { status: 500 }
    );
  }
}
