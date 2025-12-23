"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type Product = {
  id: number;
  name: string;
  category: string;
  unit: string;
  location: string;
  min_stock: number;
  current_stock: number;
  active: boolean;
};

type Movement = {
  id: number;
  product_id: number;
  type: "consume" | "restock";
  qty: number;
  created_at: string;
};

export default function ProductsPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const router = useRouter();

  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({
    name: "",
    category: "",
    unit: "pieza",
    location: "",
    min_stock: 1,
    current_stock: 0,
  });
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);

  // búsqueda + filtro
  const [q, setQ] = useState("");
  const [onlyLow, setOnlyLow] = useState(false);

  // toast (debajo del header)
  const [toast, setToast] = useState<{ msg: string; kind: "ok" | "err" } | null>(
    null
  );
  const toastTimer = useRef<number | null>(null);

  function showToast(msg: string, kind: "ok" | "err" = "ok") {
    setToast({ msg, kind });
    if (toastTimer.current) window.clearTimeout(toastTimer.current);
    toastTimer.current = window.setTimeout(() => setToast(null), 2200);
  }

  // micro feedback (+1/-1)
  const [pulse, setPulse] = useState<{ id: number; kind: "plus" | "minus" } | null>(
    null
  );

  function triggerPulse(id: number, kind: "plus" | "minus") {
    setPulse({ id, kind });
    window.setTimeout(() => setPulse(null), 260);
  }

  // eliminar sin confirm()
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  function updateForm<K extends keyof typeof form>(
    key: K,
    value: (typeof form)[K]
  ) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function getUserId(): number | null {
    try {
      const raw = localStorage.getItem("user");
      if (!raw) return null;
      const u = JSON.parse(raw);
      return typeof u?.id === "number" ? u.id : null;
    } catch {
      return null;
    }
  }

  async function loadProducts() {
    setError("");
    const res = await fetch(`${baseUrl}/products`, { cache: "no-store" });
    if (!res.ok) throw new Error("No pude traer productos");
    const data = (await res.json()) as Product[];
    setProducts(data);
  }

  useEffect(() => {
    const uid = getUserId();
    if (!uid) {
      router.push("/login");
      return;
    }

    (async () => {
      try {
        await loadProducts();
      } catch (e: any) {
        const msg = e?.message || "Error desconocido";
        setError(msg);
        showToast(msg, "err");
      } finally {
        setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function consume(id: number) {
    try {
      setBusyId(id);
      const uid = getUserId();
      const res = await fetch(
        `${baseUrl}/products/${id}/consume?qty=1${uid ? `&user_id=${uid}` : ""}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("No se pudo consumir");
      await loadProducts();
      showToast("Producto actualizado", "ok");
    } catch (e: any) {
      const msg = e?.message || "No pude consumir el producto";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setBusyId(null);
    }
  }

  async function restock(id: number) {
    try {
      setBusyId(id);
      const uid = getUserId();
      const res = await fetch(
        `${baseUrl}/products/${id}/restock?qty=1${uid ? `&user_id=${uid}` : ""}`,
        { method: "POST" }
      );
      if (!res.ok) throw new Error("No se pudo reponer");
      await loadProducts();
      showToast("Producto actualizado", "ok");
    } catch (e: any) {
      const msg = e?.message || "No pude reponer el producto";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setBusyId(null);
    }
  }

  async function createProduct() {
    setError("");

    if (!form.name.trim()) {
      setError("Falta el nombre");
      showToast("Falta el nombre", "err");
      return;
    }
    if (!form.category.trim()) {
      setError("Falta la categoría");
      showToast("Falta la categoría", "err");
      return;
    }
    if (!form.location.trim()) {
      setError("Falta la ubicación");
      showToast("Falta la ubicación", "err");
      return;
    }

    try {
      setSaving(true);

      const res = await fetch(`${baseUrl}/products`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "No se pudo crear el producto");
      }

      setShowForm(false);
      setEditingId(null);
      setForm({
        name: "",
        category: "",
        unit: "pieza",
        location: "",
        min_stock: 1,
        current_stock: 0,
      });

      await loadProducts();
      showToast("Producto creado", "ok");
    } catch (e: any) {
      const msg = e?.message || "Error al crear producto";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setSaving(false);
    }
  }

  async function saveEdit() {
    if (editingId === null) return;

    try {
      setSaving(true);

      const res = await fetch(`${baseUrl}/products/${editingId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });

      if (!res.ok) throw new Error("No se pudo editar");

      setEditingId(null);
      setShowForm(false);
      await loadProducts();
      showToast("Cambios guardados", "ok");
    } catch (e: any) {
      const msg = e?.message || "Error al editar";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setSaving(false);
    }
  }

  async function removeProduct(id: number) {
    try {
      const res = await fetch(`${baseUrl}/products/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("No se pudo eliminar");
      await loadProducts();
      showToast("Producto eliminado", "ok");
    } catch (e: any) {
      const msg = e?.message || "Error al eliminar";
      setError(msg);
      showToast(msg, "err");
    } finally {
      setConfirmDeleteId(null);
    }
  }

  // lista filtrada (busqueda + low stock)
  const visible = useMemo(() => {
    const query = q.trim().toLowerCase();

    return products.filter((p) => {
      const isLow = p.current_stock <= p.min_stock;
      if (onlyLow && !isLow) return false;

      if (!query) return true;

      const haystack = `${p.name} ${p.category} ${p.location}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [products, q, onlyLow]);

  function toggleFormNew() {
    setEditingId(null);
    setShowForm((v) => !v);
    setForm({
      name: "",
      category: "",
      unit: "pieza",
      location: "",
      min_stock: 1,
      current_stock: 0,
    });
  }

  if (loading) return <div className="p-4">Cargando inventario...</div>;

  return (
    <div>
      {/* Header sticky */}
      <div className="sticky top-0 z-10 bg-zinc-50/95 backdrop-blur border-b">
        <div className="p-4 max-w-xl mx-auto flex items-end justify-between gap-2">
          <div>
            <h1 className="text-2xl font-bold leading-tight">Inventario</h1>
            <p className="text-sm text-gray-500">Control rápido de productos</p>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5"
              onClick={() => router.push("/")}
            >
              Home
            </button>

            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5"
              onClick={async () => {
                try {
                  await loadProducts();
                  showToast("Lista actualizada", "ok");
                } catch (e: any) {
                  const msg = e?.message || "No pude actualizar";
                  setError(msg);
                  showToast(msg, "err");
                }
              }}
            >
              Actualizar
            </button>

            <button
              type="button"
              className="text-sm rounded-lg border px-3 py-2 hover:bg-black/5"
              onClick={toggleFormNew}
            >
              {showForm ? "Cerrar" : "Agregar"}
            </button>
          </div>
        </div>

        {/* Toast debajo del header */}
        {toast && (
          <div className="px-4 pb-3 max-w-xl mx-auto">
            <div
              className={`rounded-xl border px-3 py-2 text-sm shadow-sm bg-white ${
                toast.kind === "ok"
                  ? "border-green-200 text-green-800"
                  : "border-red-200 text-red-700"
              }`}
            >
              {toast.msg}
            </div>
          </div>
        )}
      </div>

      {/* Contenido */}
      <div className="p-4 max-w-xl mx-auto">
        <div className="mb-4 space-y-2">
          {/* búsqueda */}
          <input
            className="w-full rounded-lg border px-3 py-2 text-sm"
            placeholder="Buscar por nombre, categoría o ubicación..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />

          {/* tabs */}
          <div className="flex rounded-lg border p-1 bg-white">
            <button
              type="button"
              onClick={() => setOnlyLow(false)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                !onlyLow ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              Todos
            </button>

            <button
              type="button"
              onClick={() => setOnlyLow(true)}
              className={`flex-1 rounded-md px-3 py-2 text-sm font-medium ${
                onlyLow ? "bg-black/5" : "hover:bg-black/5"
              }`}
            >
              Por acabarse
            </button>
          </div>
        </div>

        {/* Error bonito (lo dejamos, pero ya no dependes de alerts) */}
        {error && (
          <div className="mb-4 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
            {error}
          </div>
        )}

        {/* Formulario */}
        {showForm && (
          <div className="mb-4 rounded-xl border bg-white p-4 shadow-sm space-y-3">
            <div className="flex items-center justify-between">
              <div className="font-semibold">
                {editingId ? "Editar producto" : "Nuevo producto"}
              </div>
              {editingId && (
                <span className="text-xs rounded-full border px-2 py-1 text-gray-600">
                  Editando
                </span>
              )}
            </div>

            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (editingId) saveEdit();
                else createProduct();
              }}
              className="space-y-3"
            >
              <div className="grid grid-cols-2 gap-2">
                <input
                  className="border rounded px-3 py-2 bg-white"
                  placeholder="Nombre (ej. Café)"
                  value={form.name}
                  onChange={(e) => updateForm("name", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-white"
                  placeholder="Categoría (ej. Cocina)"
                  value={form.category}
                  onChange={(e) => updateForm("category", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-white"
                  placeholder="Ubicación (ej. Despensa)"
                  value={form.location}
                  onChange={(e) => updateForm("location", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-white"
                  placeholder="Unidad (ej. pieza, kg)"
                  value={form.unit}
                  onChange={(e) => updateForm("unit", e.target.value)}
                />
                <input
                  className="border rounded px-3 py-2 bg-white"
                  type="number"
                  placeholder="Stock mínimo (ej. 2)"
                  title="Cantidad mínima antes de que se agregue a la lista de súper"
                  value={form.min_stock}
                  onChange={(e) => updateForm("min_stock", Number(e.target.value))}
                />
                <input
                  className="border rounded px-3 py-2 bg-white"
                  type="number"
                  placeholder="Stock actual (ej. 5)"
                  title="Cantidad que tienes actualmente"
                  value={form.current_stock}
                  onChange={(e) => updateForm("current_stock", Number(e.target.value))}
                />
              </div>

              <button
                type="submit"
                disabled={saving}
                className="w-full rounded-lg border px-4 py-3 font-medium hover:bg-black/5 disabled:opacity-50"
              >
                {saving
                  ? "Guardando..."
                  : editingId
                  ? "Guardar cambios"
                  : "Guardar producto"}
              </button>
            </form>
          </div>
        )}

        {/* Lista */}
        {visible.length === 0 ? (
          <div className="rounded-lg border p-4 text-sm text-gray-600 bg-white shadow-sm">
            No hay resultados{onlyLow ? " por acabarse" : ""}.
          </div>
        ) : (
          <ul className="space-y-2">
            {visible.map((p) => {
              const isLow = p.current_stock <= p.min_stock;
              const isBusy = busyId === p.id;

              const pulseOn = pulse?.id === p.id;
              const ringClass = pulseOn
                ? pulse?.kind === "plus"
                  ? "ring-2 ring-green-200"
                  : "ring-2 ring-zinc-200"
                : "";

              return (
                <li
                  key={p.id}
                  className={`rounded-xl border bg-white p-4 shadow-sm transition-transform ${ringClass} ${
                    pulseOn ? "scale-[1.01]" : ""
                  }`}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-semibold text-lg">{p.name}</div>
                      <div className="text-sm text-gray-500">
                        {p.category} · {p.location}
                      </div>
                    </div>

                    <div className="text-right">
                      <div className="text-lg font-bold">
                        {p.current_stock}{" "}
                        <span className="text-sm font-medium text-gray-500">
                          {p.unit}
                        </span>
                      </div>

                      {isLow ? (
                        <div className="mt-1 inline-flex items-center rounded-full bg-red-50 px-2 py-1 text-xs font-medium text-red-700 border border-red-200">
                          Por acabarse
                        </div>
                      ) : (
                        <div className="mt-1 inline-flex items-center rounded-full bg-green-50 px-2 py-1 text-xs font-medium text-green-700 border border-green-200">
                          OK
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        triggerPulse(p.id, "minus");
                        consume(p.id);
                      }}
                      disabled={isBusy}
                      className="rounded-lg border px-3 py-3 text-lg font-semibold hover:bg-black/5 disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                      −1
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        triggerPulse(p.id, "plus");
                        restock(p.id);
                      }}
                      disabled={isBusy}
                      className="rounded-lg border px-3 py-3 text-lg font-semibold hover:bg-black/5 disabled:opacity-50 active:scale-[0.98] transition-transform"
                    >
                      +1
                    </button>
                  </div>

                  <div className="mt-2 grid grid-cols-2 gap-2 text-sm">
                    <button
                      type="button"
                      className="rounded-lg border px-3 py-2 hover:bg-black/5"
                      onClick={() => {
                        setEditingId(p.id);
                        setForm({
                          name: p.name,
                          category: p.category,
                          unit: p.unit,
                          location: p.location,
                          min_stock: p.min_stock,
                          current_stock: p.current_stock,
                        });
                        setShowForm(true);
                      }}
                    >
                      Editar
                    </button>

                    <button
                      type="button"
                      className="rounded-lg border px-3 py-2 text-red-600 hover:bg-red-50"
                      onClick={() => setConfirmDeleteId(p.id)}
                    >
                      Eliminar
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>

      {/* Modal eliminar (sin confirm/alerts) */}
      {confirmDeleteId !== null && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/30"
            onClick={() => setConfirmDeleteId(null)}
            aria-label="Cerrar"
          />
          <div className="relative w-full max-w-md rounded-t-2xl sm:rounded-2xl bg-white border shadow-lg p-4 m-0 sm:m-4">
            <div className="font-semibold text-lg">Eliminar producto</div>
            <p className="mt-1 text-sm text-gray-600">
              ¿Seguro que quieres eliminarlo? Esta acción lo desactiva.
            </p>

            <div className="mt-4 grid grid-cols-2 gap-2">
              <button
                type="button"
                className="rounded-lg border px-3 py-3 text-sm hover:bg-black/5"
                onClick={() => setConfirmDeleteId(null)}
              >
                Cancelar
              </button>

              <button
                type="button"
                className="rounded-lg border px-3 py-3 text-sm text-red-600 hover:bg-red-50"
                onClick={() => removeProduct(confirmDeleteId)}
              >
                Eliminar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
