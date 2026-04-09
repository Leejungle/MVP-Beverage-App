import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeRecipeCostOrNull } from "@/lib/costEngine";
import { Prisma } from "../../../../../generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

type ProductWithRelations = Prisma.ProductGetPayload<{
  include: { recipeItems: { include: { ingredient: true } } };
}>;

// ─── Prisma include shape ─────────────────────────────────────────────────────

const productInclude = {
  recipeItems: { include: { ingredient: true } },
} as const;

// ─── Local helper ─────────────────────────────────────────────────────────────

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

// In Next.js 15+, dynamic route params are wrapped in a Promise.
type Params = Promise<{ id: string }>;

// ─── PUT /api/products/[id] ───────────────────────────────────────────────────
// Updates a product's name and/or salePrice. Returns 404 if not found.
export async function PUT(
  request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

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

    const product = await prisma.product.update({
      where: { id },
      data: { name, salePrice },
      include: productInclude,
    });

    return NextResponse.json({ data: withDerived(product) });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update product" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/products/[id] ────────────────────────────────────────────────
// Deletes a product. Returns 404 if not found.
// Returns 409 if the product is referenced by OrderItem rows.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await prisma.product.delete({ where: { id } });

    return NextResponse.json({
      data: { message: "Product deleted successfully" },
    });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Product not found" },
        { status: 404 }
      );
    }
    if (e.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this product because it has recorded orders. Remove those orders first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete product" },
      { status: 500 }
    );
  }
}
