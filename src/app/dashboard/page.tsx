"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Totals {
  totalCupsSold: number;  // giữ tên API; hiển thị là "Đã bán"
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
  totalOrders?: number;
}

interface BreakdownRow {
  saleId: number;
  productId: number;
  productName: string;
  quantity: number;
  salePrice: number;
  costPerUnit: number;
  profitPerUnit: number;
  revenue: number;
  totalCost: number;
  profit: number;
}

interface DailyDashboardData {
  selectedDate: string;
  totals: Totals;
  breakdown: BreakdownRow[];
}

interface DailyRow {
  date: string;
  totalOrders: number;
  totalCups: number;
  totalRevenue: number;
  totalCost: number;
  totalProfit: number;
}

interface MonthlyDashboardData {
  month: string;
  totals: Totals;
  dailyBreakdown: DailyRow[];
}

type ViewMode = "day" | "month";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayLocal(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function currentMonth(): string {
  const d = new Date();
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  return `${yyyy}-${mm}`;
}

function formatVND(value: number): string {
  return Math.round(value).toLocaleString("vi-VN") + " ₫";
}

/** Biên lợi nhuận tính bằng %, làm tròn 1 chữ số thập phân. */
function marginPct(revenue: number, profit: number): number {
  if (!isFinite(revenue) || revenue <= 0) return 0;
  return Math.round((profit / revenue) * 1000) / 10;
}

const emptyTotals: Totals = {
  totalCupsSold: 0,
  totalRevenue: 0,
  totalCost: 0,
  totalProfit: 0,
};

// ─── Sub-components ───────────────────────────────────────────────────────────

/** 5 thẻ tổng hợp dùng chung cho cả hai chế độ xem ngày và tháng. */
function TotalsGrid({ totals }: { totals: Totals }) {
  const margin = marginPct(totals.totalRevenue, totals.totalProfit);
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-3">
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Đã bán
        </p>
        <p className="text-2xl font-bold text-gray-900">
          {totals.totalCupsSold.toLocaleString("vi-VN")}
        </p>
        <p className="text-xs text-gray-400 mt-1">sản phẩm</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Doanh thu
        </p>
        <p className="text-2xl font-bold text-gray-900">
          {formatVND(totals.totalRevenue)}
        </p>
        <p className="text-xs text-gray-400 mt-1">đã thu được</p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <p className="text-xs font-medium text-gray-500 uppercase tracking-wide mb-1">
          Tổng chi phí
        </p>
        <p className="text-2xl font-bold text-gray-900">
          {formatVND(totals.totalCost)}
        </p>
        <p className="text-xs text-gray-400 mt-1">chi phí nguyên liệu</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">
          Lợi nhuận
        </p>
        <p className="text-2xl font-bold text-amber-700">
          {formatVND(totals.totalProfit)}
        </p>
        <p className="text-xs text-amber-500 mt-1">lợi nhuận thuần</p>
      </div>

      <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
        <p className="text-xs font-medium text-amber-700 uppercase tracking-wide mb-1">
          Biên lợi
        </p>
        <p className="text-2xl font-bold text-amber-700">{margin.toFixed(1)}%</p>
        <p className="text-xs text-amber-500 mt-1">lợi nhuận / doanh thu</p>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const [viewMode, setViewMode] = useState<ViewMode>("day");
  const [selectedDate, setSelectedDate] = useState(todayLocal);
  const [selectedMonth, setSelectedMonth] = useState(currentMonth);
  const [dayData, setDayData] = useState<DailyDashboardData | null>(null);
  const [monthData, setMonthData] = useState<MonthlyDashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // ─── Fetch helpers ─────────────────────────────────────────────────────────

  async function loadDashboard(date: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?date=${date}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không thể tải dữ liệu.");
        setDayData(null);
        return;
      }
      setDayData(json.data);
    } catch {
      setError("Yêu cầu thất bại. Vui lòng thử lại.");
      setDayData(null);
    } finally {
      setLoading(false);
    }
  }

  async function loadMonthly(month: string) {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/dashboard?month=${month}`);
      const json = await res.json();
      if (!res.ok) {
        setError(json.error ?? "Không thể tải dữ liệu.");
        setMonthData(null);
        return;
      }
      setMonthData(json.data);
    } catch {
      setError("Yêu cầu thất bại. Vui lòng thử lại.");
      setMonthData(null);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadDashboard(selectedDate);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Event handlers ────────────────────────────────────────────────────────

  function handleViewModeChange(mode: ViewMode) {
    if (mode === viewMode) return;
    setViewMode(mode);
    setError(null);
    if (mode === "day") {
      loadDashboard(selectedDate);
    } else {
      loadMonthly(selectedMonth);
    }
  }

  function handleDateChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    loadDashboard(newDate);
  }

  function handleMonthChange(e: React.ChangeEvent<HTMLInputElement>) {
    const newMonth = e.target.value;
    setSelectedMonth(newMonth);
    loadMonthly(newMonth);
  }

  /** Nhấp vào dòng ngày trong chế độ tháng → xem chi tiết ngày đó. */
  function handleDrillDown(date: string) {
    setSelectedDate(date);
    setViewMode("day");
    loadDashboard(date);
  }

  // ─── Derived ───────────────────────────────────────────────────────────────

  const totals = (viewMode === "day" ? dayData?.totals : monthData?.totals) ?? emptyTotals;
  const totalOrders = totals.totalOrders;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-1">Báo cáo</h1>
      <p className="text-sm text-gray-500 mb-5">
        Tổng hợp từ các đơn hàng đã hoàn thành
      </p>

      {/* ── Toggle Ngày / Tháng ── */}
      <div className="flex gap-1 mb-6 bg-gray-100 rounded-lg p-1 w-fit">
        {(["day", "month"] as ViewMode[]).map((mode) => (
          <button
            key={mode}
            onClick={() => handleViewModeChange(mode)}
            className={`px-4 py-1.5 rounded-md text-sm font-medium transition-colors ${
              viewMode === mode
                ? "bg-white text-gray-900 shadow-sm"
                : "text-gray-500 hover:text-gray-700"
            }`}
          >
            {mode === "day" ? "Theo ngày" : "Theo tháng"}
          </button>
        ))}
      </div>

      {/* ── Chọn ngày / tháng ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 mb-6 flex flex-wrap items-center gap-4">
        {viewMode === "day" ? (
          <>
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Ngày
            </label>
            <input
              type="date"
              value={selectedDate}
              onChange={handleDateChange}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-500">
              Đang xem:{" "}
              <span className="font-medium text-gray-800">{selectedDate}</span>
            </span>
          </>
        ) : (
          <>
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">
              Tháng
            </label>
            <input
              type="month"
              value={selectedMonth}
              onChange={handleMonthChange}
              className="border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
            />
            <span className="text-sm text-gray-500">
              Đang xem:{" "}
              <span className="font-medium text-gray-800">{selectedMonth}</span>
            </span>
          </>
        )}
      </div>

      {/* ── Lỗi ── */}
      {error && (
        <div className="mb-6 px-4 py-3 rounded-md text-sm border bg-red-50 text-red-800 border-red-200">
          {error}
        </div>
      )}

      {/* ── Đang tải ── */}
      {loading ? (
        <p className="text-sm text-gray-500">Đang tải…</p>
      ) : (
        <>
          {/* ── Thẻ tổng hợp (dùng chung cho cả hai chế độ) ── */}
          <TotalsGrid totals={totals} />

          {/* ── Số đơn hàng ── */}
          {typeof totalOrders === "number" ? (
            <p className="text-xs text-gray-500 mb-6">
              {totalOrders === 0
                ? "Không có đơn hàng trong kỳ này."
                : `Dựa trên ${totalOrders} đơn hàng đã hoàn thành.`}
            </p>
          ) : (
            <div className="mb-6" />
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* CHẾ ĐỘ NGÀY                                                        */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {viewMode === "day" && (
            <div>
              <h2 className="text-base font-semibold mb-3">
                Chi tiết đơn hàng — {selectedDate}
              </h2>

              {!dayData || dayData.breakdown.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Không có đơn hàng trong ngày này.
                </p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Sản phẩm
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          SL
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Giá bán
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Giá thành
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          LN/SP
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Doanh thu
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Tổng chi phí
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Lợi nhuận
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {dayData.breakdown.map((row) => (
                        <tr key={row.saleId} className="hover:bg-gray-50">
                          <td className="px-4 py-3 font-medium">
                            {row.productName}
                          </td>
                          <td className="px-4 py-3 text-right">{row.quantity}</td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatVND(row.salePrice)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatVND(row.costPerUnit)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatVND(row.profitPerUnit)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatVND(row.revenue)}
                          </td>
                          <td className="px-4 py-3 text-right text-gray-700">
                            {formatVND(row.totalCost)}
                          </td>
                          <td className="px-4 py-3 text-right font-medium text-green-700">
                            {formatVND(row.profit)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          Tổng cộng
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {dayData.totals.totalCupsSold}
                        </td>
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3" />
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {formatVND(dayData.totals.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {formatVND(dayData.totals.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {formatVND(dayData.totals.totalProfit)}
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════════ */}
          {/* CHẾ ĐỘ THÁNG                                                       */}
          {/* ══════════════════════════════════════════════════════════════════ */}
          {viewMode === "month" && (
            <div>
              <h2 className="text-base font-semibold mb-3">
                Chi tiết theo ngày — {selectedMonth}
              </h2>

              {!monthData || monthData.dailyBreakdown.length === 0 ? (
                <p className="text-sm text-gray-500">
                  Không có đơn hàng trong tháng này.
                </p>
              ) : (
                <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="bg-gray-50 border-b border-gray-200">
                        <th className="text-left px-4 py-3 font-medium text-gray-600">
                          Ngày
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Đơn hàng
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Sản phẩm
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Doanh thu
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Chi phí
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Lợi nhuận
                        </th>
                        <th className="text-right px-4 py-3 font-medium text-gray-600">
                          Biên lợi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {monthData.dailyBreakdown.map((row) => {
                        const rowMargin = marginPct(row.totalRevenue, row.totalProfit);
                        return (
                          <tr
                            key={row.date}
                            className="hover:bg-amber-50 cursor-pointer"
                            onClick={() => handleDrillDown(row.date)}
                            title={`Xem chi tiết ngày: ${row.date}`}
                          >
                            <td className="px-4 py-3 font-medium text-amber-700 underline decoration-dotted">
                              {row.date}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {row.totalOrders}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {row.totalCups}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {formatVND(row.totalRevenue)}
                            </td>
                            <td className="px-4 py-3 text-right text-gray-700">
                              {formatVND(row.totalCost)}
                            </td>
                            <td className="px-4 py-3 text-right font-medium text-green-700">
                              {formatVND(row.totalProfit)}
                            </td>
                            <td className="px-4 py-3 text-right text-amber-700 font-medium">
                              {rowMargin.toFixed(1)}%
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                    <tfoot className="border-t-2 border-gray-200 bg-gray-50">
                      <tr>
                        <td className="px-4 py-3 font-semibold text-gray-700">
                          Tổng cộng
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {monthData.totals.totalOrders ?? 0}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {monthData.totals.totalCupsSold}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {formatVND(monthData.totals.totalRevenue)}
                        </td>
                        <td className="px-4 py-3 text-right font-semibold text-gray-700">
                          {formatVND(monthData.totals.totalCost)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {formatVND(monthData.totals.totalProfit)}
                        </td>
                        <td className="px-4 py-3 text-right font-bold text-amber-700">
                          {marginPct(
                            monthData.totals.totalRevenue,
                            monthData.totals.totalProfit
                          ).toFixed(1)}%
                        </td>
                      </tr>
                    </tfoot>
                  </table>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
