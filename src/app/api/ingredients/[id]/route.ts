import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// In Next.js 15+, dynamic route params are wrapped in a Promise.
type Params = Promise<{ id: string }>;

// Allowed base unit values — must match POST /api/ingredients.
const ALLOWED_UNITS = ["ml", "g", "piece", "shot", "portion"] as const;
type AllowedUnit = (typeof ALLOWED_UNITS)[number];

function isAllowedUnit(value: string): value is AllowedUnit {
  return (ALLOWED_UNITS as readonly string[]).includes(value);
}

// ─── PUT /api/ingredients/[id] ────────────────────────────────────────────────
// Updates an existing ingredient. Returns 404 if not found.
// Required fields: name, purchasePrice, unit, purchaseQuantity
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
    const purchasePrice = Number(body.purchasePrice);
    const purchaseQuantity = Number(body.purchaseQuantity);
    const unit: string =
      typeof body.unit === "string" && body.unit.trim() !== ""
        ? body.unit.trim()
        : "ml";

    const errors: string[] = [];

    if (!name) errors.push("name is required");

    if (!isFinite(purchasePrice) || purchasePrice < 0)
      errors.push("purchasePrice must be >= 0");

    if (!isFinite(purchaseQuantity) || purchaseQuantity <= 0)
      errors.push("purchaseQuantity must be > 0");

    if (!isAllowedUnit(unit))
      errors.push(`unit must be one of: ${ALLOWED_UNITS.join(", ")}`);

    if (errors.length > 0) {
      return NextResponse.json({ error: errors.join(", ") }, { status: 400 });
    }

    const ingredient = await prisma.ingredient.update({
      where: { id },
      data: { name, purchasePrice, unit, purchaseQuantity },
    });

    return NextResponse.json({ data: ingredient });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Ingredient not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to update ingredient" },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/ingredients/[id] ────────────────────────────────────────────
// Deletes an ingredient. Returns 404 if not found.
// Returns 409 if the ingredient is still referenced by recipe items.
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

    await prisma.ingredient.delete({ where: { id } });

    return NextResponse.json({
      data: { message: "Ingredient deleted successfully" },
    });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Ingredient not found" },
        { status: 404 }
      );
    }
    if (e.code === "P2003") {
      return NextResponse.json(
        {
          error:
            "Cannot delete this ingredient because it is used in one or more product recipes. Remove those recipe items first.",
        },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete ingredient" },
      { status: 500 }
    );
  }
}
