import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// In Next.js 15+, dynamic route params are wrapped in a Promise.
type Params = Promise<{ id: string; itemId: string }>;

// ─── DELETE /api/products/[id]/recipe/[itemId] ────────────────────────────────
// Removes a single ingredient from the product's recipe.
//
// Verifies that the recipe item exists AND belongs to the product in the URL
// (prevents cross-product deletions). Returns 404 if not found.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr, itemId: itemIdStr } = await params;
    const productId = parseInt(idStr, 10);
    const itemId = parseInt(itemIdStr, 10);

    if (isNaN(productId) || productId <= 0) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 });
    }
    if (isNaN(itemId) || itemId <= 0) {
      return NextResponse.json(
        { error: "Invalid recipe item id" },
        { status: 400 }
      );
    }

    // Verify the item exists and belongs to this product
    const recipeItem = await prisma.productRecipeItem.findFirst({
      where: { id: itemId, productId },
    });
    if (!recipeItem) {
      return NextResponse.json(
        { error: "Recipe item not found for this product" },
        { status: 404 }
      );
    }

    await prisma.productRecipeItem.delete({ where: { id: itemId } });

    return NextResponse.json({
      data: { message: "Recipe item removed successfully" },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to delete recipe item" },
      { status: 500 }
    );
  }
}
