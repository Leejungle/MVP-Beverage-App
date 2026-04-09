import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// Allowed base unit values. Any ingredient type may use any of these.
const ALLOWED_UNITS = ["ml", "g", "piece", "shot", "portion"] as const;
type AllowedUnit = (typeof ALLOWED_UNITS)[number];

function isAllowedUnit(value: string): value is AllowedUnit {
  return (ALLOWED_UNITS as readonly string[]).includes(value);
}

// ─── GET /api/ingredients ─────────────────────────────────────────────────────
// Returns all ingredients ordered newest first.
export async function GET() {
  try {
    const ingredients = await prisma.ingredient.findMany({
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ data: ingredients });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch ingredients" },
      { status: 500 }
    );
  }
}

// ─── POST /api/ingredients ────────────────────────────────────────────────────
// Creates a new ingredient.
// Required fields: name, purchasePrice, unit, purchaseQuantity
export async function POST(request: NextRequest) {
  try {
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

    const ingredient = await prisma.ingredient.create({
      data: { name, purchasePrice, unit, purchaseQuantity },
    });

    return NextResponse.json({ data: ingredient }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create ingredient" },
      { status: 500 }
    );
  }
}
