import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// In Next.js 15+, dynamic route params are wrapped in a Promise.
type Params = Promise<{ id: string }>;

// ─── GET /api/products/[id]/recipe ────────────────────────────────────────────
// Returns all recipe items for the given product, each including full
// Ingredient data. Returns 404 if the product does not exist.
export async function GET(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr } = await params;
    const productId = parseInt(idStr, 10);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const recipeItems = await prisma.productRecipeItem.findMany({
      where: { productId },
      include: { ingredient: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({ data: recipeItems });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch recipe items" },
      { status: 500 }
    );
  }
}

// ─── POST /api/products/[id]/recipe ───────────────────────────────────────────
// Adds one ingredient to the product's recipe.
// Body: { ingredientId: number, quantityUsed: number }
//
// Returns 404 if the product does not exist.
// Returns 400 if the ingredient does not exist.
// Returns 409 if this ingredient is already in the recipe
//   (use PUT /api/products/[id]/recipe/[itemId] to update quantity).
export async function POST(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr } = await params;
    const productId = parseInt(idStr, 10);
    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    const body = await request.json();
    const ingredientId = parseInt(body.ingredientId, 10);
    const quantityUsed = Number(body.quantityUsed);

    const errors: string[] = [];
    if (isNaN(ingredientId) || ingredientId <= 0)
      errors.push("ingredientId must be a valid integer > 0");
    if (!isFinite(quantityUsed) || quantityUsed <= 0)
      errors.push("quantityUsed must be > 0");

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    const ingredient = await prisma.ingredient.findUnique({
      where: { id: ingredientId },
    });
    if (!ingredient) {
      return NextResponse.json(
        { error: "Referenced ingredient does not exist" },
        { status: 400 }
      );
    }

    const recipeItem = await prisma.productRecipeItem.create({
      data: { productId, ingredientId, quantityUsed },
      include: { ingredient: true },
    });

    return NextResponse.json({ data: recipeItem }, { status: 201 });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2002") {
      return NextResponse.json(
        {
          error:
            "This ingredient is already in the recipe for this product. Update the existing recipe entry instead.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create recipe item" },
      { status: 500 }
    );
  }
}
