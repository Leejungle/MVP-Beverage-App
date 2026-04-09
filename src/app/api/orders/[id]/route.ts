import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

// In Next.js 15+, dynamic route params are wrapped in a Promise.
type Params = Promise<{ id: string }>;

// ─── DELETE /api/orders/[id] ──────────────────────────────────────────────────
// Voids and removes a completed order.
// Because OrderItem → Order uses ON DELETE RESTRICT, order items must be
// deleted before the order itself. Both operations run inside a transaction
// so the database is never left in a partially-deleted state.
export async function DELETE(
  _request: NextRequest,
  { params }: { params: Params }
) {
  try {
    const { id: idStr } = await params;
    const id = parseInt(idStr, 10);

    if (isNaN(id) || id <= 0) {
      return NextResponse.json({ error: "Invalid id" }, { status: 400 });
    }

    await prisma.$transaction(async (tx) => {
      // Step 1: remove all items belonging to this order.
      // deleteMany does not throw if no rows match — safe when order has 0 items.
      await tx.orderItem.deleteMany({ where: { orderId: id } });

      // Step 2: delete the order itself.
      // Throws P2025 if the order does not exist, rolling back step 1.
      await tx.order.delete({ where: { id } });
    });

    return NextResponse.json({
      data: { message: "Order deleted successfully" },
    });
  } catch (error) {
    const e = error as { code?: string };
    if (e.code === "P2025") {
      return NextResponse.json(
        { error: "Order not found" },
        { status: 404 }
      );
    }
    return NextResponse.json(
      { error: "Failed to delete order" },
      { status: 500 }
    );
  }
}
