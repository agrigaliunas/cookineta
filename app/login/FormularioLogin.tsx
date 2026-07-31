"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { iniciarSesion, type EstadoLogin } from "@/actions/auth";

export default function FormularioLogin({ volverA }: { volverA: string }) {
  const [estado, action] = useActionState<EstadoLogin, FormData>(
    iniciarSesion,
    {},
  );

  return (
    <form action={action} style={{ display: "grid", gap: "var(--space-4)" }}>
      <input type="hidden" name="volverA" value={volverA} />

      <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
        <label htmlFor="email">Email</label>
        <input
          id="email"
          name="email"
          type="email"
          className="input"
          autoComplete="email"
          required
        />
      </div>

      <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
        <label htmlFor="password">Contraseña</label>
        <input
          id="password"
          name="password"
          type="password"
          className="input"
          autoComplete="current-password"
          required
        />
      </div>

      {estado.error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-accent-2-800)",
            background: "var(--color-accent-2-100)",
            border: "1px solid var(--color-accent-2-300)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          {estado.error}
        </p>
      )}

      <Boton />
    </form>
  );
}

function Boton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      className="btn btn-primary"
      disabled={pending}
      style={{ padding: "var(--space-3) var(--space-6)", justifySelf: "start" }}
    >
      {pending ? "Entrando…" : "Entrar"}
    </button>
  );
}
