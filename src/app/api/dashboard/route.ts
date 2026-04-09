import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "../../../../generated/prisma/client";

// ─── Validation ───────────────────────────────────────────────────────────────

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;

// ─── Types ────────────────────────────────────────────────────────────────────

type OrderItemWithProduct = Prisma.OrderItemGetPayload<{
  include: { product: true };
}>;

// Internal accumulator used to aggregate per-product totals across all orders.
// firstUnitPrice: the unitPrice from the first OrderItem encountered for this
// product on the selected date — used as the representative salePrice and for
// computing profitPerUnit in the breakdown row.
interface ProductAccum {
  productId: number;
  productName: string;
  firstUnitPrice: number;
  costPerUnit: number;
  totalQuantity: number;
  totalRevenue: number;
  totalLineCost: number;
  totalLineProfit: number;
}

// ─── Helper: accumulate one OrderItem into the product map ────────────────────

function accumulateItem(
  map: Map<number, ProductAccum>,
  item: OrderItemWithProduct
): void {
  const productId = item.productId;
  // Always use the snapshotted unitCost. Defensive: 0 if null (pre-S0 rows).
  const costPerUnit = item.unitCost ?? 0;

  if (map.has(productId)) {
    const acc = map.get(productId)!;
    const lineRevenue = Math.round(item.quantity * item.unitPrice);
    const lineCost = Math.round(item.quantity * acc.costPerUnit);
    const lineProfit = Math.round(lineRevenue - lineCost);
    acc.totalQuantity += item.quantity;
    acc.totalRevenue += lineRevenue;
    acc.totalLineCost += lineCost;
    acc.totalLineProfit += lineProfit;
  } else {
    const lineRevenue = Math.round(item.quantity * item.unitPrice);
    const lineCost = Math.round(item.quantity * costPerUnit);
    const lineProfit = Math.round(lineRevenue - lineCost);

    map.set(productId, {
      productId,
      productName: item.product.name,
      firstUnitPrice: item.unitPrice,
      costPerUnit,
      totalQuantity: item.quantity,
      totalRevenue: lineRevenue,
      totalLineCost: lineCost,
      totalLineProfit: lineProfit,
    });
  }
}

// ─── Helper: turn a ProductAccum into a dashboard breakdown row ───────────────
// saleId is set to productId for backward compatibility with the dashboard page,
// which uses saleId as the React list key.

function buildBreakdownRow(acc: ProductAccum) {
  return {
    saleId: acc.productId,
    productId: acc.productId,
    productName: acc.productName,
    quantity: acc.totalQuantity,
    salePrice: acc.firstUnitPrice,
    costPerUnit: acc.costPerUnit,
    profitPerUnit: Math.round(acc.firstUnitPrice - acc.costPerUnit),
    revenue: acc.totalRevenue,
    totalCost: acc.totalLineCost,
    profit: acc.totalLineProfit,
  };
}

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
// Accepts EITHER:
//   ?date=YYYY-MM-DD  → daily summary
//   ?month=YYYY-MM    → monthly summary with per-day breakdown
//
// Providing both params returns 400.
// Providing neither returns 400.
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const date = searchParams.get("date");
    const month = searchParams.get("month");

    // ── Mutual-exclusion check ────────────────────────────────────────────────
    if (date && month) {
      return NextResponse.json(
        { error: "Provide either date or month, not both" },
        { status: 400 }
      );
    }

    if (!date && !month) {
      return NextResponse.json(
        { error: "Provide either date (YYYY-MM-DD) or month (YYYY-MM)" },
        { status: 400 }
      );
    }

    // ── Daily mode ────────────────────────────────────────────────────────────
    if (date) {
      if (!DATE_REGEX.test(date)) {
        return NextResponse.json(
          { error: "date query parameter must be in YYYY-MM-DD format" },
          { status: 400 }
        );
      }

      const orders = await prisma.order.findMany({
        where: { orderDate: date },
        include: {
          items: {
            include: { product: true },
          },
        },
      });

      const productMap = new Map<number, ProductAccum>();
      for (const order of orders) {
        for (const item of order.items) {
          accumulateItem(productMap, item);
        }
      }

      const breakdown = Array.from(productMap.values()).map(buildBreakdownRow);

      const totals = {
        totalCupsSold: breakdown.reduce((sum, row) => sum + row.quantity, 0),
        totalRevenue: breakdown.reduce((sum, row) => sum + row.revenue, 0),
        totalCost: breakdown.reduce((sum, row) => sum + row.totalCost, 0),
        totalProfit: breakdown.reduce((sum, row) => sum + row.profit, 0),
        totalOrders: orders.length,
      };

      return NextResponse.json({
        data: { selectedDate: date, totals, breakdown },
      });
    }

    // ── Monthly mode ──────────────────────────────────────────────────────────
    const m = month as string;

    if (!MONTH_REGEX.test(m)) {
      return NextResponse.json(
        { error: "month query parameter must be in YYYY-MM format" },
        { status: 400 }
      );
    }

    // Fetch all orders whose orderDate starts with the month prefix.
    const orders = await prisma.order.findMany({
      where: { orderDate: { startsWith: m } },
      orderBy: { orderDate: "asc" },
      include: {
        items: {
          include: { product: true },
        },
      },
    });

    // Group by orderDate, accumulating per-day stats.
    interface DayAccum {
      totalOrders: number;
      totalCups: number;
      totalRevenue: number;
      totalCost: number;
      totalProfit: number;
    }

    const dayMap = new Map<string, DayAccum>();

    for (const order of orders) {
      const d = order.orderDate;
      const day = dayMap.get(d) ?? {
        totalOrders: 0,
        totalCups: 0,
        totalRevenue: 0,
        totalCost: 0,
        totalProfit: 0,
      };

      day.totalOrders += 1;

      for (const item of order.items) {
        // Always use the snapshotted unitCost; defensive 0 for pre-S0 rows.
        const costPerUnit = item.unitCost ?? 0;
        const lineRevenue = Math.round(item.quantity * item.unitPrice);
        const lineCost = Math.round(item.quantity * costPerUnit);
        const lineProfit = Math.round(lineRevenue - lineCost);

        day.totalCups += item.quantity;
        day.totalRevenue += lineRevenue;
        day.totalCost += lineCost;
        day.totalProfit += lineProfit;
      }

      dayMap.set(d, day);
    }

    // Build dailyBreakdown sorted by date ascending.
    const dailyBreakdown = Array.from(dayMap.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, day]) => ({ date, ...day }));

    const totals = {
      totalCupsSold: dailyBreakdown.reduce((s, d) => s + d.totalCups, 0),
      totalRevenue: dailyBreakdown.reduce((s, d) => s + d.totalRevenue, 0),
      totalCost: dailyBreakdown.reduce((s, d) => s + d.totalCost, 0),
      totalProfit: dailyBreakdown.reduce((s, d) => s + d.totalProfit, 0),
      totalOrders: dailyBreakdown.reduce((s, d) => s + d.totalOrders, 0),
    };

    return NextResponse.json({
      data: { month: m, totals, dailyBreakdown },
    });
  } catch {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
}
