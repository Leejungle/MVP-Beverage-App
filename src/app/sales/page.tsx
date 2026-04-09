"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Product {
  id: number;
  name: string;
  salePrice: number;
  recipeCost: number | null;
}

// DraftItem chỉ tồn tại trong React state — chưa ghi vào DB cho đến khi hoàn thành đơn.
interface DraftItem {
  productId: number;
  productName: string;
  quantity: number;
  unitPrice: number;   // snapshot của product.salePrice tại thời điểm thêm vào
  costPerCup: number;
  profitPerCup: number;
}

// SavedOrder và SavedOrderItem phản ánh đúng shape trả về từ GET /api/orders.
interface SavedOrderItem {
  id: number;
  productId: number;
  quantity: number;
  unitPrice: number;
  costPerCup: number;
  profitPerCup: number;
  lineRevenue: number;
  lineCost: number;
  lineProfit: number;
  product: { id: number; name: string };
}

interface SavedOrder {
  id: number;
  orderDate: string;
  createdAt: string;
  totalCups: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  items: SavedOrderItem[];
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatVND(value: number): string {
  return Math.round(value).toLocaleString("vi-VN") + " ₫";
}

/**
 * Trả về giá thành của sản phẩm trong bản nháp đơn hàng.
 * Ưu tiên dùng recipeCost (luôn có sau S9). Phòng thủ: trả 0 nếu null.
 */
function effectiveCostForProduct(product: Product): number {
  return product.recipeCost ?? 0;
}

function formatTime(iso: string): string {
  try {
    return new Date(iso).toLocaleTimeString("vi-VN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return iso;
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SalesPage() {
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [products, setProducts] = useState<Product[]>([]);
  const [orders, setOrders] = useState<SavedOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // draftItems === null  → chưa có đơn nháp (hiện nút "Đơn hàng mới")
  // draftItems === []    → đơn đã bắt đầu nhưng chưa có món
  // draftItems.length>0  → đơn đang trong tiến trình
  const [draftItems, setDraftItems] = useState<DraftItem[] | null>(null);

  const [completing, setCompleting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [ordersLoading, setOrdersLoading] = useState(false);

  // ─── Data fetching ─────────────────────────────────────────────────────────

  async function loadOrders(date: string) {
    setOrdersLoading(true);
    try {
      const res = await fetch(`/api/orders?date=${date}`);
      const json = await res.json();
      if (!res.ok) throw new Error(json.error ?? "Không thể tải đơn hàng");
      setOrders(json.data ?? []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Không thể tải đơn hàng.",
      });
    } finally {
      setOrdersLoading(false);
    }
  }

  async function loadData() {
    setLoading(true);
    try {
      const [pRes, oRes] = await Promise.all([
        fetch("/api/products"),
        fetch(`/api/orders?date=${selectedDate}`),
      ]);
      const pJson = await pRes.json();
      const oJson = await oRes.json();
      if (!pRes.ok) throw new Error(pJson.error ?? "Không thể tải sản phẩm");
      if (!oRes.ok) throw new Error(oJson.error ?? "Không thể tải đơn hàng");
      setProducts(pJson.data ?? []);
      setOrders(oJson.data ?? []);
    } catch (err) {
      setFeedback({
        type: "error",
        message: err instanceof Error ? err.message : "Không thể tải dữ liệu.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Date change ───────────────────────────────────────────────────────────

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    // Xóa đơn nháp để không bao giờ gửi sai ngày
    setDraftItems(null);
    // Xóa đơn cũ ngay lập tức để không hiện dữ liệu nhầm ngày
    setOrders([]);
    setFeedback(null);
    loadOrders(newDate);
  }

  // ─── Draft order: thêm sản phẩm ───────────────────────────────────────────

  function handleAddProduct(product: Product) {
    setDraftItems((prev) => {
      const items = prev ?? [];
      const existing = items.find((i) => i.productId === product.id);
      if (existing) {
        return items.map((i) =>
          i.productId === product.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      const cost = effectiveCostForProduct(product);
      return [
        ...items,
        {
          productId: product.id,
          productName: product.name,
          quantity: 1,
          unitPrice: product.salePrice,
          costPerCup: cost,
          profitPerCup: Math.round(product.salePrice - cost),
        },
      ];
    });
  }

  // ─── Draft order: tăng / giảm số lượng ────────────────────────────────────

  function handleIncrement(productId: number) {
    setDraftItems((prev) =>
      (prev ?? []).map((i) =>
        i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i
      )
    );
  }

  function handleDecrement(productId: number) {
    setDraftItems((prev) => {
      if (!prev) return null;
      return prev
        .map((i) =>
          i.productId === productId ? { ...i, quantity: i.quantity - 1 } : i
        )
        .filter((i) => i.quantity > 0);
    });
  }

  // ─── Draft order: hủy bỏ ──────────────────────────────────────────────────

  function handleCancelOrder() {
    setDraftItems(null);
    setFeedback(null);
  }

  // ─── Hoàn thành đơn ───────────────────────────────────────────────────────

  async function handleCompleteOrder() {
    if (!draftItems || draftItems.length === 0) return;

    setCompleting(true);
    setFeedback(null);

    try {
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          orderDate: selectedDate,
          items: draftItems.map((i) => ({
            productId: i.productId,
            quantity: i.quantity,
          })),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: json.error ?? "Không thể hoàn thành đơn hàng.",
        });
        return;
      }

      const saved = json.data as SavedOrder;
      setDraftItems(null);
      setFeedback({
        type: "success",
        message: `Đơn #${saved.id} đã hoàn thành — ${saved.totalCups} sản phẩm, doanh thu ${formatVND(saved.totalRevenue)}.`,
      });
      await loadOrders(selectedDate);
    } catch {
      setFeedback({
        type: "error",
        message: "Yêu cầu thất bại. Vui lòng thử lại.",
      });
    } finally {
      setCompleting(false);
    }
  }

  // ─── Xóa đơn hàng đã hoàn thành ──────────────────────────────────────────

  async function handleDeleteOrder(order: SavedOrder) {
    const confirmed = window.confirm(
      `Xóa Đơn #${order.id} (${order.totalCups} sản phẩm, ${formatVND(order.totalRevenue)})?\nThao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setFeedback(null);

    try {
      const res = await fetch(`/api/orders/${order.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        setFeedback({
          type: "error",
          message: json.error ?? "Không thể xóa đơn hàng.",
        });
        return;
      }

      setFeedback({ type: "success", message: `Đã xóa Đơn #${order.id}.` });
      await loadOrders(selectedDate);
    } catch {
      setFeedback({
        type: "error",
        message: "Yêu cầu xóa thất bại. Vui lòng thử lại.",
      });
    }
  }

  // ─── Tổng đơn nháp (chỉ để xem trước phía client) ────────────────────────

  const draftTotalCups = (draftItems ?? []).reduce((s, i) => s + i.quantity, 0);
  const draftTotalRevenue = (draftItems ?? []).reduce(
    (s, i) => s + i.quantity * i.unitPrice,
    0
  );
  const draftTotalCost = (draftItems ?? []).reduce(
    (s, i) => s + i.quantity * i.costPerCup,
    0
  );
  const draftTotalProfit = draftTotalRevenue - draftTotalCost;

  const noProducts = !loading && products.length === 0;
  const hasActiveDraft = draftItems !== null && draftItems.length > 0;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Bán hàng</h1>

      {/* ── Chọn ngày ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-4">
        <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
          Ngày bán
        </label>
        <input
          type="date"
          value={selectedDate}
          onChange={handleDateChange}
          className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
        />
        <span className="text-sm text-gray-500">
          Đang xem đơn hàng ngày:{" "}
          <span className="font-medium text-gray-800">{selectedDate}</span>
        </span>
      </div>

      {/* ── Cảnh báo chưa có sản phẩm ── */}
      {noProducts && (
        <div className="mb-6 px-4 py-3 rounded-md text-sm border bg-yellow-50 text-yellow-800 border-yellow-200">
          Chưa có sản phẩm. Vui lòng{" "}
          <a href="/products" className="underline font-medium">
            tạo sản phẩm
          </a>{" "}
          trước khi nhập đơn hàng.
        </div>
      )}

      {/* ── Khu vực nhập đơn ── */}
      {!noProducts && !loading && (
        <div className="mb-6">

          {/* Chưa có đơn nháp → hiện nút Đơn hàng mới */}
          {draftItems === null && (
            <button
              onClick={() => setDraftItems([])}
              className="bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold px-5 py-2.5 rounded-md transition-colors"
            >
              + Đơn hàng mới
            </button>
          )}

          {/* Đang có đơn nháp → hiện giao diện nhập đơn */}
          {draftItems !== null && (
            <div className="bg-white border-2 border-amber-300 rounded-lg overflow-hidden">

              {/* Header đơn nháp */}
              <div className="px-5 py-3 bg-amber-50 border-b border-amber-200 flex items-center justify-between">
                <span className="text-sm font-semibold text-amber-800">
                  Đơn hàng mới — {selectedDate}
                </span>
                <button
                  onClick={handleCancelOrder}
                  className="text-xs text-gray-500 hover:text-red-600 transition-colors"
                >
                  Hủy bỏ
                </button>
              </div>

              {/* Lưới chọn nhanh sản phẩm */}
              <div className="p-5 border-b border-gray-100">
                <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                  Thêm sản phẩm
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {products.map((product) => (
                    <div
                      key={product.id}
                      className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border border-gray-200 bg-gray-50 hover:border-amber-300 hover:bg-amber-50 transition-colors"
                    >
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-900 truncate">
                          {product.name}
                        </p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {formatVND(product.salePrice)} · giá thành{" "}
                          {formatVND(effectiveCostForProduct(product))} · lợi nhuận{" "}
                          <span className="text-green-600 font-medium">
                            {formatVND(
                              Math.round(
                                product.salePrice - effectiveCostForProduct(product)
                              )
                            )}
                          </span>
                        </p>
                      </div>
                      <button
                        onClick={() => handleAddProduct(product)}
                        className="flex-shrink-0 w-9 h-9 rounded-full bg-amber-600 hover:bg-amber-700 text-white text-xl font-bold flex items-center justify-center transition-colors shadow-sm"
                        title={`Thêm ${product.name}`}
                      >
                        +
                      </button>
                    </div>
                  ))}
                </div>
              </div>

              {/* Danh sách món trong đơn hoặc gợi ý */}
              {draftItems.length === 0 ? (
                <div className="px-5 py-6 text-sm text-gray-400 text-center">
                  Nhấn <strong>+</strong> vào sản phẩm bên trên để thêm vào đơn hàng.
                </div>
              ) : (
                <div className="p-5">
                  <p className="text-xs font-semibold uppercase tracking-widest text-gray-400 mb-3">
                    Đơn hàng hiện tại
                  </p>

                  {/* Dòng từng món */}
                  <div className="space-y-1 mb-5">
                    {draftItems.map((item) => {
                      const lineRevenue = item.quantity * item.unitPrice;
                      const lineCost = item.quantity * item.costPerCup;
                      const lineProfit = lineRevenue - lineCost;
                      return (
                        <div
                          key={item.productId}
                          className="flex items-center gap-3 py-2.5 border-b border-gray-100 last:border-0"
                        >
                          {/* Nút +/− */}
                          <div className="flex items-center gap-1.5 shrink-0">
                            <button
                              onClick={() => handleDecrement(item.productId)}
                              className="w-7 h-7 rounded border border-gray-300 text-sm font-bold text-gray-500 hover:bg-red-50 hover:border-red-300 hover:text-red-600 flex items-center justify-center transition-colors"
                            >
                              −
                            </button>
                            <span className="w-8 text-center text-sm font-bold text-gray-900">
                              {item.quantity}
                            </span>
                            <button
                              onClick={() => handleIncrement(item.productId)}
                              className="w-7 h-7 rounded border border-gray-300 text-sm font-bold text-gray-500 hover:bg-amber-50 hover:border-amber-300 hover:text-amber-700 flex items-center justify-center transition-colors"
                            >
                              +
                            </button>
                          </div>

                          {/* Tên sản phẩm + đơn giá */}
                          <div className="flex-1 min-w-0">
                            <span className="text-sm font-medium text-gray-900">
                              {item.productName}
                            </span>
                            <span className="text-xs text-gray-500 ml-2">
                              × {formatVND(item.unitPrice)}
                            </span>
                          </div>

                          {/* Tài chính từng dòng */}
                          <div className="text-right shrink-0">
                            <p className="text-sm font-semibold text-gray-800">
                              {formatVND(lineRevenue)}
                            </p>
                            <p className="text-xs text-gray-500">
                              giá thành {formatVND(lineCost)} · lợi nhuận{" "}
                              <span className="text-green-600 font-medium">
                                {formatVND(lineProfit)}
                              </span>
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Tổng đơn nháp */}
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                    {(
                      [
                        { label: "Số lượng", value: String(draftTotalCups), highlight: false },
                        { label: "Doanh thu", value: formatVND(draftTotalRevenue), highlight: false },
                        { label: "Chi phí", value: formatVND(draftTotalCost), highlight: false },
                        { label: "Lợi nhuận", value: formatVND(draftTotalProfit), highlight: true },
                      ] as const
                    ).map(({ label, value, highlight }) => (
                      <div
                        key={label}
                        className={`rounded-lg p-3 text-center border ${
                          highlight
                            ? "bg-amber-50 border-amber-200"
                            : "bg-gray-50 border-gray-200"
                        }`}
                      >
                        <p
                          className={`text-xs font-semibold uppercase tracking-wide mb-1 ${
                            highlight ? "text-amber-600" : "text-gray-500"
                          }`}
                        >
                          {label}
                        </p>
                        <p
                          className={`text-sm font-bold ${
                            highlight ? "text-amber-700" : "text-gray-800"
                          }`}
                        >
                          {value}
                        </p>
                      </div>
                    ))}
                  </div>

                  {/* Nút hành động */}
                  <div className="flex gap-3">
                    <button
                      onClick={handleCompleteOrder}
                      disabled={completing || !hasActiveDraft}
                      className="bg-green-600 hover:bg-green-700 disabled:opacity-50 text-white text-sm font-semibold px-6 py-2 rounded-md transition-colors"
                    >
                      {completing ? "Đang lưu…" : "Hoàn thành đơn"}
                    </button>
                    <button
                      onClick={handleCancelOrder}
                      className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-md transition-colors"
                    >
                      Hủy
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Phản hồi ── */}
      {feedback && (
        <div
          className={`mb-6 px-4 py-3 rounded-md text-sm border ${
            feedback.type === "success"
              ? "bg-green-50 text-green-800 border-green-200"
              : "bg-red-50 text-red-800 border-red-200"
          }`}
        >
          {feedback.message}
        </div>
      )}

      {/* ── Danh sách đơn đã hoàn thành ── */}
      <div>
        <h2 className="text-base font-semibold mb-3">
          Đơn hàng đã hoàn thành — {selectedDate}
        </h2>

        {loading || ordersLoading ? (
          <p className="text-sm text-gray-500">Đang tải…</p>
        ) : orders.length === 0 ? (
          <p className="text-sm text-gray-500">
            Chưa có đơn hàng hoàn thành trong ngày này.
          </p>
        ) : (
          <div className="space-y-3">
            {orders.map((order) => (
              <div
                key={order.id}
                className="bg-white border border-gray-200 rounded-lg overflow-hidden"
              >
                {/* Header đơn hàng */}
                <div className="px-5 py-3 bg-gray-50 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4 flex-wrap">
                    <span className="text-sm font-semibold text-gray-800">
                      Đơn #{order.id}
                    </span>
                    <span className="text-xs text-gray-500">
                      {formatTime(order.createdAt)}
                    </span>
                    <span className="text-xs text-gray-500">
                      {order.totalCups} sản phẩm
                    </span>
                    <span className="text-xs text-gray-600">
                      Doanh thu:{" "}
                      <span className="font-medium">{formatVND(order.totalRevenue)}</span>
                    </span>
                    <span className="text-xs text-gray-600">
                      Chi phí:{" "}
                      <span className="font-medium">{formatVND(order.totalCost)}</span>
                    </span>
                    <span className="text-xs text-green-700 font-semibold">
                      Lợi nhuận: {formatVND(order.totalProfit)}
                    </span>
                  </div>
                  <button
                    onClick={() => handleDeleteOrder(order)}
                    className="text-xs text-red-500 hover:text-red-700 font-medium transition-colors"
                  >
                    Xóa
                  </button>
                </div>

                {/* Chi tiết các món */}
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-gray-100 text-gray-500">
                        <th className="text-left px-5 py-2 font-medium">Sản phẩm</th>
                        <th className="text-right px-4 py-2 font-medium">SL</th>
                        <th className="text-right px-4 py-2 font-medium">Đơn giá</th>
                        <th className="text-right px-4 py-2 font-medium">Doanh thu</th>
                        <th className="text-right px-4 py-2 font-medium">Chi phí</th>
                        <th className="text-right px-5 py-2 font-medium">Lợi nhuận</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-50">
                      {order.items.map((item) => (
                        <tr key={item.id} className="hover:bg-gray-50">
                          <td className="px-5 py-2 font-medium text-gray-700">
                            {item.product.name}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {item.quantity}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {formatVND(item.unitPrice)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {formatVND(item.lineRevenue)}
                          </td>
                          <td className="px-4 py-2 text-right text-gray-600">
                            {formatVND(item.lineCost)}
                          </td>
                          <td className="px-5 py-2 text-right font-medium text-green-700">
                            {formatVND(item.lineProfit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
