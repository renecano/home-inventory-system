"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

type User = {
  id: number;
  name: string;
};

export default function LoginPage() {
  const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000";
  const router = useRouter();

  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState<number | "">("");
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function loadUsers() {
    setError("");
    const res = await fetch(`${baseUrl}/users`, { cache: "no-store" });
    if (!res.ok) throw new Error("No pude cargar usuarios");
    const data = (await res.json()) as User[];
    setUsers(data);
  }

  useEffect(() => {
    (async () => {
      try {
        await loadUsers();
      } catch (e: any) {
        setError(e?.message || "Error desconocido");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  async function login() {
    setError("");

    const u = users.find((x) => x.id === userId);
    if (!u) return setError("Selecciona un usuario");
    if (!pin.trim()) return setError("Escribe tu PIN");

    try {
      setSaving(true);

      const res = await fetch(`${baseUrl}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: u.name, pin }),
      });

      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || "Usuario o PIN incorrecto");
      }

      const data = (await res.json()) as { id: number; name: string };

      localStorage.setItem("user", JSON.stringify(data));
      router.push("/products");
    } catch (e: any) {
      setError(e?.message || "No pude iniciar sesión");
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <div className="p-4">Cargando usuarios...</div>;

  return (
    <div className="p-4 max-w-xl mx-auto">
      <h1 className="text-2xl font-bold mb-2">Entrar</h1>
      <p className="text-sm text-gray-500 mb-4">
        Elige tu usuario y escribe tu PIN.
      </p>

      {error && (
        <div className="mb-3 rounded border border-red-200 bg-red-50 p-3 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="space-y-3">
        <div>
          <label className="text-sm font-medium">Usuario</label>
          <select
            className="mt-1 w-full rounded border px-3 py-2"
            value={userId}
            onChange={(e) => {
              const v = e.target.value;
              setUserId(v === "" ? "" : Number(v));
            }}
          >
            <option value="">Selecciona…</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm font-medium">PIN</label>
          <input
            className="mt-1 w-full rounded border px-3 py-2"
            placeholder="4–6 dígitos"
            inputMode="numeric"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
          />
        </div>

        <button
          className="w-full rounded-lg border px-4 py-3 text-lg font-medium hover:bg-black/5 disabled:opacity-50"
          onClick={login}
          disabled={saving}
        >
          {saving ? "Entrando..." : "Entrar"}
        </button>

        <button
          className="w-full rounded-lg border px-4 py-3 text-sm hover:bg-black/5"
          onClick={() => router.push("/")}
          type="button"
        >
          Volver
        </button>
      </div>
    </div>
  );
}
