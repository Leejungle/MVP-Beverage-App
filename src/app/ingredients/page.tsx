"use client";

import { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface Ingredient {
  id: number;
  name: string;
  purchasePrice: number;
  unit: string;
  purchaseQuantity: number;
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const UNITS = [
  { value: "ml",      label: "ml — mililít",  plural: "ml" },
  { value: "g",       label: "g — gram",       plural: "g" },
  { value: "piece",   label: "cái/chiếc",      plural: "cái" },
  { value: "shot",    label: "shot",            plural: "shot" },
  { value: "portion", label: "phần",            plural: "phần" },
] as const;

type UnitValue = (typeof UNITS)[number]["value"];

function unitPlural(unit: string): string {
  return UNITS.find((u) => u.value === unit)?.plural ?? unit;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const emptyForm = {
  name: "",
  unit: "ml" as UnitValue,
  purchasePrice: "",
  purchaseQuantity: "",
};

function formatVND(value: number): string {
  return Math.round(value).toLocaleString("vi-VN") + " ₫";
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function IngredientsPage() {
  const [ingredients, setIngredients] = useState<Ingredient[]>([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // ─── Load ──────────────────────────────────────────────────────────────────

  async function loadIngredients() {
    try {
      const res = await fetch("/api/ingredients");
      const json = await res.json();
      setIngredients(json.data ?? []);
    } catch {
      setFeedback({ type: "error", message: "Không thể tải danh sách nguyên liệu." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadIngredients();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Edit mode ─────────────────────────────────────────────────────────────

  function handleEdit(ingredient: Ingredient) {
    setEditingId(ingredient.id);
    setForm({
      name: ingredient.name,
      unit: (ingredient.unit as UnitValue) ?? "ml",
      purchasePrice: String(ingredient.purchasePrice),
      purchaseQuantity: String(ingredient.purchaseQuantity),
    });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFeedback(null);
  }

  // ─── Create / Update ───────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const url = editingId ? `/api/ingredients/${editingId}` : "/api/ingredients";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          unit: form.unit,
          purchasePrice: Number(form.purchasePrice),
          purchaseQuantity: Number(form.purchaseQuantity),
        }),
      });

      const json = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: json.error ?? "Đã có lỗi xảy ra." });
        return;
      }

      setFeedback({
        type: "success",
        message: editingId ? "Đã cập nhật nguyên liệu." : "Đã thêm nguyên liệu.",
      });
      setForm(emptyForm);
      setEditingId(null);
      await loadIngredients();
    } catch {
      setFeedback({ type: "error", message: "Yêu cầu thất bại. Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Delete ────────────────────────────────────────────────────────────────

  async function handleDelete(ingredient: Ingredient) {
    const confirmed = window.confirm(
      `Xóa "${ingredient.name}"? Thao tác này không thể hoàn tác.`
    );
    if (!confirmed) return;

    setFeedback(null);

    try {
      const res = await fetch(`/api/ingredients/${ingredient.id}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: json.error ?? "Không thể xóa." });
        return;
      }

      setFeedback({ type: "success", message: "Đã xóa nguyên liệu." });

      if (editingId === ingredient.id) {
        setEditingId(null);
        setForm(emptyForm);
      }

      await loadIngredients();
    } catch {
      setFeedback({ type: "error", message: "Yêu cầu xóa thất bại. Vui lòng thử lại." });
    }
  }

  // ─── Live cost preview ─────────────────────────────────────────────────────

  const previewPrice = Number(form.purchasePrice);
  const previewQty = Number(form.purchaseQuantity);
  const previewCost =
    isFinite(previewPrice) &&
    previewPrice > 0 &&
    isFinite(previewQty) &&
    previewQty > 0
      ? Math.round(previewPrice / previewQty)
      : null;

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Nguyên liệu</h1>

      {/* ── Form ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">
          {editingId ? "Chỉnh sửa nguyên liệu" : "Thêm nguyên liệu"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">

            {/* Tên — full width */}
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên nguyên liệu
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Arabica Blend, Sữa tươi, Ly nhựa 400ml"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Đơn vị */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Đơn vị
              </label>
              <select
                value={form.unit}
                onChange={(e) =>
                  setForm({ ...form, unit: e.target.value as UnitValue })
                }
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              >
                {UNITS.map((u) => (
                  <option key={u.value} value={u.value}>
                    {u.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Số lượng mua */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Số lượng mua ({unitPlural(form.unit)})
              </label>
              <input
                type="number"
                value={form.purchaseQuantity}
                onChange={(e) =>
                  setForm({ ...form, purchaseQuantity: e.target.value })
                }
                placeholder={
                  form.unit === "ml"      ? "VD: 1000"  :
                  form.unit === "g"       ? "VD: 500"   :
                  form.unit === "piece"   ? "VD: 100"   :
                  form.unit === "shot"    ? "VD: 60"    :
                                           "VD: 50"
                }
                min="0.01"
                step="any"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            {/* Giá mua */}
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giá mua (VND)
              </label>
              <input
                type="number"
                value={form.purchasePrice}
                onChange={(e) =>
                  setForm({ ...form, purchasePrice: e.target.value })
                }
                placeholder="VD: 200000"
                min="0"
                step="1000"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Xem trước chi phí */}
          {previewCost !== null ? (
            <div className="mb-4 px-4 py-2.5 rounded-md bg-amber-50 border border-amber-200 text-sm text-amber-800">
              Chi phí mỗi {form.unit}:{" "}
              <strong>
                {formatVND(previewCost)}/{form.unit}
              </strong>
            </div>
          ) : (
            <div className="mb-4 px-4 py-2.5 rounded-md bg-gray-50 border border-gray-200 text-sm text-gray-400">
              Nhập Giá mua và Số lượng để xem chi phí mỗi {form.unit}.
            </div>
          )}

          {/* Buttons */}
          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
            >
              {submitting ? "Đang lưu…" : editingId ? "Cập nhật" : "Thêm nguyên liệu"}
            </button>

            {editingId && (
              <button
                type="button"
                onClick={handleCancelEdit}
                className="text-sm text-gray-600 hover:text-gray-900 px-4 py-2 border border-gray-300 rounded-md transition-colors"
              >
                Hủy
              </button>
            )}
          </div>
        </form>
      </div>

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

      {/* ── Bảng nguyên liệu ── */}
      {loading ? (
        <p className="text-sm text-gray-500">Đang tải…</p>
      ) : ingredients.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có nguyên liệu. Thêm mới ở trên.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">
                  Tên
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">
                  Đơn vị
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Giá mua
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Số lượng
                </th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">
                  Chi phí / Đơn vị
                </th>
                <th className="px-4 py-3 font-medium text-gray-600">
                  Thao tác
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {ingredients.map((ingredient) => {
                const qty = ingredient.purchaseQuantity;
                const unit = ingredient.unit ?? "ml";
                const costPerUnit =
                  qty > 0
                    ? Math.round(ingredient.purchasePrice / qty)
                    : 0;
                const isEditing = editingId === ingredient.id;

                return (
                  <tr
                    key={ingredient.id}
                    className={isEditing ? "bg-amber-50" : "hover:bg-gray-50"}
                  >
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {ingredient.name}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-block text-xs font-medium px-2 py-0.5 rounded-full bg-gray-100 text-gray-600">
                        {unit}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {formatVND(ingredient.purchasePrice)}
                    </td>
                    <td className="px-4 py-3 text-right text-gray-700">
                      {qty.toLocaleString("vi-VN")}{" "}
                      <span className="text-gray-400 text-xs">{unitPlural(unit)}</span>
                    </td>
                    <td className="px-4 py-3 text-right font-medium text-amber-700">
                      {formatVND(costPerUnit)}
                      <span className="text-xs font-normal text-amber-500">
                        /{unit}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex gap-3">
                        <button
                          onClick={() => handleEdit(ingredient)}
                          className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                        >
                          Sửa
                        </button>
                        <button
                          onClick={() => handleDelete(ingredient)}
                          className="text-xs text-red-600 hover:text-red-800 font-medium"
                        >
                          Xóa
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
