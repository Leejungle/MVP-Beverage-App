import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { computeUnitCost } from "@/lib/costEngine";
import { Prisma } from "../../../../generated/prisma/client";

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItemWithProduct = Prisma.OrderItemGetPayload<{
  include: { product: true };
}>;

type OrderWithItems = Prisma.OrderGetPayload<{
  include: { items: { include: { product: true } } };
}>;

// ─── Helpers ──────────────────────────────────────────────────────────────────
// enrichItem: attaches all derived financial fields to one OrderItem.
//
// Cost source: always item.unitCost (snapshotted at order creation).
// If unitCost is null (pre-S0 legacy orders), 0 is used as defensive fallback.
// Revenue and profit always use item.unitPrice (snapshotted at order time).

function enrichItem(item: OrderItemWithProduct) {
  const costPerCup = item.unitCost ?? 0;
  const profitPerCup = Math.round(item.unitPrice - costPerCup);
  const lineRevenue = Math.round(item.quantity * item.unitPrice);
  const lineCost = Math.round(item.quantity * costPerCup);
  const lineProfit = Math.round(lineRevenue - lineCost);

  return { ...item, costPerCup, profitPerCup, lineRevenue, lineCost, lineProfit };
}

// enrichOrder: enriches all items and aggregates order-level totals.

function enrichOrder(order: OrderWithItems) {
  const enrichedItems = order.items.map(enrichItem);

  const totalCups = enrichedItems.reduce((sum, i) => sum + i.quantity, 0);
  const totalRevenue = enrichedItems.reduce((sum, i) => sum + i.lineRevenue, 0);
  const totalCost = enrichedItems.reduce((sum, i) => sum + i.lineCost, 0);
  const totalProfit = enrichedItems.reduce((sum, i) => sum + i.lineProfit, 0);

  return { ...order, items: enrichedItems, totalCups, totalRevenue, totalCost, totalProfit };
}

// ─── GET /api/orders?date=YYYY-MM-DD ─────────────────────────────────────────
// Returns all completed orders for the selected date, newest first.
// Each order contains enriched items and order-level financial totals.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");

    if (!date) {
      return NextResponse.json(
        { error: "date query parameter is required (YYYY-MM-DD)" },
        { status: 400 }
      );
    }

    if (!DATE_REGEX.test(date)) {
      return NextResponse.json(
        { error: "date query parameter must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    const orders = await prisma.order.findMany({
      where: { orderDate: date },
      orderBy: { createdAt: "desc" },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json({ data: orders.map(enrichOrder) });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch orders" },
      { status: 500 }
    );
  }
}

// ─── POST /api/orders ─────────────────────────────────────────────────────────
// Creates one completed order with one or more items.
// Snapshots unitPrice from product.salePrice and unitCost from the recipe cost
// at creation time so historical profit is never affected by future changes.
// If the request contains duplicate productIds, their quantities are consolidated.
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();

    // ── Validate orderDate ────────────────────────────────────────────────────

    const orderDate =
      typeof body.orderDate === "string" ? body.orderDate.trim() : "";

    if (!orderDate) {
      return NextResponse.json(
        { error: "orderDate is required" },
        { status: 400 }
      );
    }

    if (!DATE_REGEX.test(orderDate)) {
      return NextResponse.json(
        { error: "orderDate must be in YYYY-MM-DD format" },
        { status: 400 }
      );
    }

    // ── Validate items array ──────────────────────────────────────────────────

    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json(
        { error: "items must be a non-empty array" },
        { status: 400 }
      );
    }

    const itemErrors: string[] = [];
    for (let i = 0; i < body.items.length; i++) {
      const raw = body.items[i] as Record<string, unknown>;
      const productId = parseInt(String(raw.productId), 10);
      const quantity = parseInt(String(raw.quantity), 10);

      if (isNaN(productId) || productId <= 0) {
        itemErrors.push(`items[${i}].productId must be a valid integer > 0`);
      }
      if (isNaN(quantity) || quantity < 1) {
        itemErrors.push(`items[${i}].quantity must be an integer >= 1`);
      }
    }

    if (itemErrors.length > 0) {
      return NextResponse.json({ error: itemErrors.join("; ") }, { status: 400 });
    }

    // ── Consolidate duplicate productIds by summing quantities ────────────────

    const consolidated = new Map<number, number>();
    for (const raw of body.items as Record<string, unknown>[]) {
      const productId = parseInt(String(raw.productId), 10);
      const quantity = parseInt(String(raw.quantity), 10);
      consolidated.set(productId, (consolidated.get(productId) ?? 0) + quantity);
    }
    const uniqueItems = Array.from(consolidated.entries()).map(
      ([productId, quantity]) => ({ productId, quantity })
    );

    // ── Verify all referenced products exist ──────────────────────────────────

    const productIds = uniqueItems.map((i) => i.productId);
    const products = await prisma.product.findMany({
      where: { id: { in: productIds } },
      include: {
        recipeItems: { include: { ingredient: true } },
      },
    });

    if (products.length !== productIds.length) {
      const foundIds = new Set(products.map((p) => p.id));
      const missingIds = productIds.filter((id) => !foundIds.has(id));
      return NextResponse.json(
        { error: `Products not found: ids ${missingIds.join(", ")}` },
        { status: 400 }
      );
    }

    const productMap = new Map(products.map((p) => [p.id, p]));

    // ── Create order with nested OrderItems ───────────────────────────────────
    // Both unitPrice (sale price) and unitCost (recipe cost) are snapshotted
    // at this exact moment so that historical profit is never affected by
    // future price or ingredient changes.

    const order = await prisma.order.create({
      data: {
        orderDate,
        items: {
          create: uniqueItems.map(({ productId, quantity }) => {
            const p = productMap.get(productId)!;
            const unitCost = computeUnitCost(p);
            return {
              productId,
              quantity,
              unitPrice: p.salePrice,
              unitCost,
            };
          }),
        },
      },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    return NextResponse.json({ data: enrichOrder(order) }, { status: 201 });
  } catch {
    return NextResponse.json(
      { error: "Failed to create order" },
      { status: 500 }
    );
  }
}
