"use client";

import React, { useEffect, useState } from "react";

// ─── Types ────────────────────────────────────────────────────────────────────

interface IngredientBase {
  id: number;
  name: string;
  unit: string;
  purchasePrice: number;
  purchaseQuantity: number;
}

interface RecipeItem {
  id: number;
  productId: number;
  ingredientId: number;
  quantityUsed: number;
  ingredient: IngredientBase;
}

interface Product {
  id: number;
  name: string;
  salePrice: number;
  recipeCost: number | null;
  profit: number | null;
  margin: number | null;
  recipeItems: RecipeItem[];
}

interface Feedback {
  type: "success" | "error";
  message: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const emptyForm = { name: "", salePrice: "" };
const emptyRecipeForm = { ingredientId: "", quantityUsed: "" };

function formatVND(value: number): string {
  return Math.round(value).toLocaleString("vi-VN") + " ₫";
}

function ingredientCostPerBaseUnit(ing: IngredientBase): number {
  if (!isFinite(ing.purchasePrice) || !isFinite(ing.purchaseQuantity) || ing.purchaseQuantity <= 0)
    return 0;
  return Math.round(ing.purchasePrice / ing.purchaseQuantity);
}

function recipeLineCost(item: RecipeItem): number {
  const cpbu = ingredientCostPerBaseUnit(item.ingredient);
  return Math.round(item.quantityUsed * cpbu);
}

function effectiveCost(product: Product): number {
  return product.recipeCost ?? 0;
}

function marginPct(salePrice: number, cost: number): number {
  if (!isFinite(salePrice) || salePrice <= 0) return 0;
  return Math.round(((salePrice - cost) / salePrice) * 1000) / 10;
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ProductsPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [ingredients, setIngredients] = useState<IngredientBase[]>([]);
  const [loading, setLoading] = useState(true);

  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  const [expandedProducts, setExpandedProducts] = useState<Record<number, boolean>>({});
  const [recipeForms, setRecipeForms] = useState<
    Record<number, { ingredientId: string; quantityUsed: string }>
  >({});
  const [recipeSubmitting, setRecipeSubmitting] = useState<Record<number, boolean>>({});
  const [recipeFeedback, setRecipeFeedback] = useState<Record<number, Feedback>>({});

  // ─── Load ──────────────────────────────────────────────────────────────────

  async function loadData() {
    try {
      const [productsRes, ingredientsRes] = await Promise.all([
        fetch("/api/products"),
        fetch("/api/ingredients"),
      ]);
      const productsJson = await productsRes.json();
      const ingredientsJson = await ingredientsRes.json();
      setProducts(productsJson.data ?? []);
      setIngredients(ingredientsJson.data ?? []);
    } catch {
      setFeedback({ type: "error", message: "Không thể tải dữ liệu." });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Product form handlers ─────────────────────────────────────────────────

  function handleEdit(product: Product) {
    setEditingId(product.id);
    setForm({ name: product.name, salePrice: String(product.salePrice) });
    setFeedback(null);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function handleCancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
    setFeedback(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setFeedback(null);

    const url = editingId ? `/api/products/${editingId}` : "/api/products";
    const method = editingId ? "PUT" : "POST";

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: form.name,
          salePrice: Number(form.salePrice),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: json.error ?? "Đã có lỗi xảy ra." });
        return;
      }

      setFeedback({
        type: "success",
        message: editingId ? "Đã cập nhật sản phẩm." : "Đã thêm sản phẩm.",
      });
      setForm(emptyForm);
      setEditingId(null);
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "Yêu cầu thất bại. Vui lòng thử lại." });
    } finally {
      setSubmitting(false);
    }
  }

  async function handleDelete(product: Product) {
    const confirmed = window.confirm(`Xóa "${product.name}"? Thao tác này không thể hoàn tác.`);
    if (!confirmed) return;
    setFeedback(null);

    try {
      const res = await fetch(`/api/products/${product.id}`, { method: "DELETE" });
      const json = await res.json();

      if (!res.ok) {
        setFeedback({ type: "error", message: json.error ?? "Không thể xóa." });
        return;
      }

      setFeedback({ type: "success", message: "Đã xóa sản phẩm." });
      if (editingId === product.id) {
        setEditingId(null);
        setForm(emptyForm);
      }
      setExpandedProducts((prev) => {
        const n = { ...prev };
        delete n[product.id];
        return n;
      });
      await loadData();
    } catch {
      setFeedback({ type: "error", message: "Yêu cầu xóa thất bại. Vui lòng thử lại." });
    }
  }

  // ─── Recipe Builder handlers ───────────────────────────────────────────────

  function toggleRecipe(productId: number) {
    const willOpen = !expandedProducts[productId];
    setExpandedProducts((prev) => ({ ...prev, [productId]: willOpen }));
    if (willOpen && !recipeForms[productId]) {
      setRecipeForms((prev) => ({ ...prev, [productId]: { ...emptyRecipeForm } }));
    }
    if (!willOpen) {
      setRecipeFeedback((prev) => {
        const n = { ...prev };
        delete n[productId];
        return n;
      });
    }
  }

  async function handleAddRecipeItem(productId: number) {
    const rf = recipeForms[productId];
    if (!rf) return;

    setRecipeSubmitting((prev) => ({ ...prev, [productId]: true }));
    setRecipeFeedback((prev) => {
      const n = { ...prev };
      delete n[productId];
      return n;
    });

    try {
      const res = await fetch(`/api/products/${productId}/recipe`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ingredientId: Number(rf.ingredientId),
          quantityUsed: Number(rf.quantityUsed),
        }),
      });
      const json = await res.json();

      if (!res.ok) {
        setRecipeFeedback((prev) => ({
          ...prev,
          [productId]: { type: "error", message: json.error ?? "Không thể thêm." },
        }));
        return;
      }

      setRecipeFeedback((prev) => ({
        ...prev,
        [productId]: { type: "success", message: "Đã thêm nguyên liệu vào công thức." },
      }));
      setRecipeForms((prev) => ({ ...prev, [productId]: { ...emptyRecipeForm } }));
      await loadData();
    } catch {
      setRecipeFeedback((prev) => ({
        ...prev,
        [productId]: { type: "error", message: "Yêu cầu thất bại." },
      }));
    } finally {
      setRecipeSubmitting((prev) => ({ ...prev, [productId]: false }));
    }
  }

  async function handleDeleteRecipeItem(productId: number, itemId: number) {
    const confirmed = window.confirm("Xóa nguyên liệu này khỏi công thức?");
    if (!confirmed) return;

    setRecipeSubmitting((prev) => ({ ...prev, [productId]: true }));

    try {
      const res = await fetch(`/api/products/${productId}/recipe/${itemId}`, {
        method: "DELETE",
      });
      const json = await res.json();

      if (!res.ok) {
        setRecipeFeedback((prev) => ({
          ...prev,
          [productId]: { type: "error", message: json.error ?? "Không thể xóa." },
        }));
        return;
      }

      setRecipeFeedback((prev) => ({
        ...prev,
        [productId]: { type: "success", message: "Đã xóa nguyên liệu khỏi công thức." },
      }));
      await loadData();
    } catch {
      setRecipeFeedback((prev) => ({
        ...prev,
        [productId]: { type: "error", message: "Yêu cầu thất bại." },
      }));
    } finally {
      setRecipeSubmitting((prev) => ({ ...prev, [productId]: false }));
    }
  }

  // ─── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <h1 className="text-2xl font-bold mb-6">Sản phẩm</h1>

      {/* ── Form sản phẩm ── */}
      <div className="bg-white border border-gray-200 rounded-lg p-6 mb-6">
        <h2 className="text-base font-semibold mb-4">
          {editingId ? "Chỉnh sửa sản phẩm" : "Thêm sản phẩm"}
        </h2>

        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-4">
            <div className="sm:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tên sản phẩm
              </label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="VD: Cà Phê Đen, Trà Sữa Trân Châu"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Giá bán (VND)
              </label>
              <input
                type="number"
                value={form.salePrice}
                onChange={(e) => setForm({ ...form, salePrice: e.target.value })}
                placeholder="VD: 25000"
                min="0"
                step="1000"
                className="w-full border border-gray-300 rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent"
              />
            </div>
          </div>

          <p className="text-xs text-gray-400 mb-4">
            Sau khi tạo sản phẩm, dùng Công thức pha chế bên dưới để thêm nguyên liệu và tính giá thành.
          </p>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-medium px-5 py-2 rounded-md transition-colors"
            >
              {submitting ? "Đang lưu…" : editingId ? "Cập nhật" : "Thêm sản phẩm"}
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

      {/* ── Bảng sản phẩm ── */}
      {loading ? (
        <p className="text-sm text-gray-500">Đang tải…</p>
      ) : products.length === 0 ? (
        <p className="text-sm text-gray-500">Chưa có sản phẩm. Thêm mới ở trên.</p>
      ) : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-3 font-medium text-gray-600">Tên</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Giá bán</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Giá thành</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Lợi nhuận</th>
                <th className="text-right px-4 py-3 font-medium text-gray-600">Biên lợi</th>
                <th className="px-4 py-3 font-medium text-gray-600">Thao tác</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {products.map((product) => {
                const isEditing = editingId === product.id;
                const isRecipeOpen = !!expandedProducts[product.id];
                const cost = effectiveCost(product);
                const profit = Math.round(product.salePrice - cost);
                const margin = marginPct(product.salePrice, cost);

                const rForm = recipeForms[product.id] ?? emptyRecipeForm;
                const isRSub = !!recipeSubmitting[product.id];
                const rf = recipeFeedback[product.id];

                const recipeTotal = product.recipeItems.reduce(
                  (sum, item) => sum + recipeLineCost(item),
                  0
                );
                const recipeProfit = Math.round(product.salePrice - recipeTotal);
                const recipeMargin = marginPct(product.salePrice, recipeTotal);

                return (
                  <React.Fragment key={product.id}>
                    {/* ── Dòng sản phẩm ── */}
                    <tr className={isEditing ? "bg-amber-50" : "hover:bg-gray-50"}>
                      <td className="px-4 py-3 font-medium">{product.name}</td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {formatVND(product.salePrice)}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-700">
                        {product.recipeCost !== null ? (
                          formatVND(cost)
                        ) : (
                          <span className="text-gray-400 text-xs italic">chưa có công thức</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right font-medium text-green-700">
                        {product.recipeCost !== null ? formatVND(profit) : "—"}
                      </td>
                      <td className="px-4 py-3 text-right text-gray-600">
                        {product.recipeCost !== null ? `${margin.toFixed(1)}%` : "—"}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-3 items-center">
                          <button
                            onClick={() => handleEdit(product)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Sửa
                          </button>
                          <button
                            onClick={() => handleDelete(product)}
                            className="text-xs text-red-600 hover:text-red-800 font-medium"
                          >
                            Xóa
                          </button>
                          <button
                            onClick={() => toggleRecipe(product.id)}
                            className={`text-xs font-medium flex items-center gap-0.5 ${
                              isRecipeOpen
                                ? "text-amber-700 hover:text-amber-900"
                                : "text-amber-600 hover:text-amber-800"
                            }`}
                          >
                            Công thức{" "}
                            {product.recipeItems.length > 0 && (
                              <span className="bg-amber-100 text-amber-700 rounded-full px-1 py-0.5 text-xs leading-none">
                                {product.recipeItems.length}
                              </span>
                            )}
                            {isRecipeOpen ? " ▲" : " ▼"}
                          </button>
                        </div>
                      </td>
                    </tr>

                    {/* ── Panel công thức ── */}
                    {isRecipeOpen && (
                      <tr>
                        <td
                          colSpan={6}
                          className="px-6 py-5 bg-amber-50 border-t border-amber-100"
                        >
                          <div className="max-w-3xl">
                            <h3 className="text-sm font-semibold text-amber-800 mb-3">
                              Công thức pha chế — {product.name}
                            </h3>

                            {rf && (
                              <div
                                className={`mb-3 px-3 py-2 rounded-md text-xs border ${
                                  rf.type === "success"
                                    ? "bg-green-50 text-green-800 border-green-200"
                                    : "bg-red-50 text-red-800 border-red-200"
                                }`}
                              >
                                {rf.message}
                              </div>
                            )}

                            {product.recipeItems.length === 0 ? (
                              <p className="text-xs text-gray-500 mb-4 italic">
                                Chưa có nguyên liệu trong công thức. Thêm nguyên liệu bên dưới để tính giá thành.
                              </p>
                            ) : (
                              <div className="mb-5 overflow-x-auto">
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-amber-200 text-amber-700">
                                      <th className="text-left pb-2 pr-3 font-medium">Nguyên liệu</th>
                                      <th className="text-left pb-2 pr-3 font-medium">Đơn vị</th>
                                      <th className="text-right pb-2 pr-3 font-medium">SL dùng</th>
                                      <th className="text-right pb-2 pr-3 font-medium">CP / Đơn vị</th>
                                      <th className="text-right pb-2 pr-3 font-medium">Thành tiền</th>
                                      <th className="pb-2 text-right font-medium"></th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-amber-100">
                                    {product.recipeItems.map((item) => {
                                      const cpbu = ingredientCostPerBaseUnit(item.ingredient);
                                      const lc = recipeLineCost(item);
                                      return (
                                        <tr key={item.id}>
                                          <td className="py-2 pr-3 font-medium text-gray-700">
                                            {item.ingredient.name}
                                          </td>
                                          <td className="py-2 pr-3">
                                            <span className="bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded-full text-xs leading-none">
                                              {item.ingredient.unit}
                                            </span>
                                          </td>
                                          <td className="py-2 pr-3 text-right text-gray-700">
                                            {item.quantityUsed.toLocaleString("vi-VN")}{" "}
                                            <span className="text-gray-400">
                                              {item.ingredient.unit}
                                            </span>
                                          </td>
                                          <td className="py-2 pr-3 text-right text-gray-600">
                                            {formatVND(cpbu)}
                                            <span className="text-gray-400">
                                              /{item.ingredient.unit}
                                            </span>
                                          </td>
                                          <td className="py-2 pr-3 text-right font-semibold text-gray-700">
                                            {formatVND(lc)}
                                          </td>
                                          <td className="py-2 text-right">
                                            <button
                                              onClick={() =>
                                                handleDeleteRecipeItem(product.id, item.id)
                                              }
                                              disabled={isRSub}
                                              className="text-red-500 hover:text-red-700 disabled:opacity-40 font-medium"
                                            >
                                              Xóa
                                            </button>
                                          </td>
                                        </tr>
                                      );
                                    })}
                                  </tbody>
                                </table>

                                {/* Tổng công thức */}
                                <div className="mt-3 pt-3 border-t border-amber-200 flex flex-wrap gap-5 text-xs">
                                  <span className="text-gray-600">
                                    Tổng giá thành:{" "}
                                    <span className="font-semibold text-gray-800">
                                      {formatVND(recipeTotal)}
                                    </span>
                                  </span>
                                  <span className="text-gray-600">
                                    Lợi nhuận:{" "}
                                    <span className="font-semibold text-green-700">
                                      {formatVND(recipeProfit)}
                                    </span>
                                  </span>
                                  <span className="text-gray-600">
                                    Biên lợi:{" "}
                                    <span className="font-semibold text-gray-800">
                                      {recipeMargin.toFixed(1)}%
                                    </span>
                                  </span>
                                </div>
                              </div>
                            )}

                            {/* Form thêm nguyên liệu */}
                            {ingredients.length === 0 ? (
                              <p className="text-xs text-amber-700">
                                Chưa có nguyên liệu.{" "}
                                <a href="/ingredients" className="underline font-medium">
                                  Tạo nguyên liệu
                                </a>{" "}
                                trước.
                              </p>
                            ) : (
                              <div className="flex flex-wrap gap-3 items-end">
                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Nguyên liệu
                                  </label>
                                  <select
                                    value={rForm.ingredientId}
                                    onChange={(e) =>
                                      setRecipeForms((prev) => ({
                                        ...prev,
                                        [product.id]: {
                                          ...rForm,
                                          ingredientId: e.target.value,
                                        },
                                      }))
                                    }
                                    disabled={isRSub}
                                    className="border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 min-w-[180px]"
                                  >
                                    <option value="">— Chọn —</option>
                                    {ingredients.map((ing) => (
                                      <option key={ing.id} value={ing.id}>
                                        {ing.name} ({ing.unit})
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div>
                                  <label className="block text-xs font-medium text-gray-600 mb-1">
                                    Số lượng sử dụng
                                  </label>
                                  <input
                                    type="number"
                                    value={rForm.quantityUsed}
                                    onChange={(e) =>
                                      setRecipeForms((prev) => ({
                                        ...prev,
                                        [product.id]: {
                                          ...rForm,
                                          quantityUsed: e.target.value,
                                        },
                                      }))
                                    }
                                    placeholder="VD: 40"
                                    min="0"
                                    step="any"
                                    disabled={isRSub}
                                    className="border border-gray-300 rounded-md px-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-amber-500 focus:border-transparent disabled:opacity-50 w-28"
                                  />
                                </div>

                                <button
                                  type="button"
                                  onClick={() => handleAddRecipeItem(product.id)}
                                  disabled={
                                    isRSub ||
                                    !rForm.ingredientId ||
                                    !rForm.quantityUsed ||
                                    Number(rForm.quantityUsed) <= 0
                                  }
                                  className="bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-xs font-medium px-4 py-1.5 rounded-md transition-colors"
                                >
                                  {isRSub ? "Đang thêm…" : "Thêm vào công thức"}
                                </button>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
