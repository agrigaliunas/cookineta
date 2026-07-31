"use client";

import { useState } from "react";
import { FRANJAS, pill } from "@/lib/constantes";
import { money } from "@/lib/money";
import type { LineaResumen } from "@/lib/carrito";

export default function Checkout({
  resumenEntrega,
  franjasDelDia,
  franjaIdx,
  onFranja,
  lineas,
  subtotal,
  envio,
  total,
  enviando,
  error,
  onVolver,
  onConfirmar,
}: {
  resumenEntrega: string;
  franjasDelDia: number[];
  franjaIdx: number | null;
  onFranja: (i: number) => void;
  lineas: LineaResumen[];
  subtotal: number;
  envio: number;
  total: number;
  enviando: boolean;
  error: string | null;
  onVolver: () => void;
  onConfirmar: (form: {
    nombre: string;
    telefono: string;
    direccion: string;
    nota: string;
  }) => void;
}) {
  const [nombre, setNombre] = useState("");
  const [telefono, setTelefono] = useState("");
  const [direccion, setDireccion] = useState("");
  const [nota, setNota] = useState("");

  const completo =
    nombre.trim() !== "" &&
    telefono.trim() !== "" &&
    direccion.trim() !== "" &&
    franjaIdx !== null;

  return (
    <form
      style={{ maxWidth: 720, display: "grid", gap: "var(--space-6)" }}
      onSubmit={(e) => {
        e.preventDefault();
        if (completo && !enviando) {
          onConfirmar({
            nombre: nombre.trim(),
            telefono: telefono.trim(),
            direccion: direccion.trim(),
            nota: nota.trim(),
          });
        }
      }}
    >
      <button
        type="button"
        className="btn"
        onClick={onVolver}
        style={{
          justifySelf: "start",
          padding: 0,
          color: "var(--color-accent-600)",
        }}
      >
        ← Volver a la vitrina
      </button>

      <div style={{ display: "grid", gap: "var(--space-1)" }}>
        <h2 style={{ margin: 0, fontSize: 30 }}>Datos de entrega</h2>
        <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
          {resumenEntrega}
        </p>
      </div>

      <div className="grid-form-2">
        <Campo
          etiqueta="Nombre y apellido"
          valor={nombre}
          onChange={setNombre}
          placeholder="Sofía Pérez"
          autoComplete="name"
          requerido
        />
        <Campo
          etiqueta="WhatsApp"
          valor={telefono}
          onChange={setTelefono}
          placeholder="11 5555 5555"
          tipo="tel"
          autoComplete="tel"
          requerido
        />
        <div className="col-span-2">
          <Campo
            etiqueta="Dirección de entrega"
            valor={direccion}
            onChange={setDireccion}
            placeholder="Av. Santa Fe 1234, piso 3 B"
            autoComplete="street-address"
            requerido
          />
        </div>

        <div
          className="field col-span-2"
          style={{ display: "grid", gap: "var(--space-2)" }}
        >
          <label>Franja horaria</label>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
          >
            {franjasDelDia.map((i) => {
              const p = pill(franjaIdx === i);
              return (
                <button
                  key={i}
                  type="button"
                  onClick={() => onFranja(i)}
                  style={{
                    cursor: "pointer",
                    fontFamily: "var(--font-body)",
                    fontSize: 14,
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: 999,
                    ...p,
                  }}
                >
                  {FRANJAS[i]}
                </button>
              );
            })}
          </div>
        </div>

        <div className="col-span-2">
          <Campo
            etiqueta="Nota para la cocina (opcional)"
            valor={nota}
            onChange={setNota}
            placeholder="Sin nueces, por favor"
          />
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--space-3)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          Resumen
        </div>
        <div style={{ display: "grid", gap: "var(--space-2)" }}>
          {lineas.map((l) => (
            <div key={l.clave} style={{ display: "grid", gap: 2 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "var(--space-3)",
                  fontSize: 14,
                }}
              >
                <span>{l.titulo}</span>
                <span style={{ fontVariantNumeric: "tabular-nums" }}>
                  {money(l.total)}
                </span>
              </div>
              {l.detalle && (
                <span
                  style={{ fontSize: 12, color: "var(--color-neutral-600)" }}
                >
                  {l.detalle}
                </span>
              )}
            </div>
          ))}
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              fontSize: 14,
              color: "var(--color-neutral-600)",
            }}
          >
            <span>Envío</span>
            <span>{envio === 0 ? "sin cargo" : money(envio)}</span>
          </div>
        </div>
        <div style={{ height: 1, background: "var(--color-divider)" }} />
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontFamily: "var(--font-heading)",
            fontSize: 19,
          }}
        >
          <span>Total con envío</span>
          <span>{money(total)}</span>
        </div>
        <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          Subtotal {money(subtotal)}. El pago es en efectivo o transferencia al
          recibir.
        </div>
      </div>

      {error && (
        <p
          role="alert"
          style={{
            margin: 0,
            fontSize: 14,
            color: "var(--color-accent-2-800)",
            background: "var(--color-accent-2-100)",
            border: "1px solid var(--color-accent-2-300)",
            borderRadius: "var(--radius-md)",
            padding: "var(--space-3) var(--space-4)",
          }}
        >
          {error}
        </p>
      )}

      <button
        type="submit"
        className="btn btn-primary"
        disabled={!completo || enviando}
        style={{
          borderRadius: 999,
          justifySelf: "start",
          padding: "var(--space-3) var(--space-8)",
          fontSize: 15,
        }}
      >
        {enviando ? "Reservando…" : "Confirmar y enviar por WhatsApp"}
      </button>
    </form>
  );
}

function Campo({
  etiqueta,
  valor,
  onChange,
  placeholder,
  tipo = "text",
  autoComplete,
  requerido = false,
}: {
  etiqueta: string;
  valor: string;
  onChange: (v: string) => void;
  placeholder?: string;
  tipo?: string;
  autoComplete?: string;
  requerido?: boolean;
}) {
  return (
    <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
      <label>{etiqueta}</label>
      <input
        className="input"
        type={tipo}
        value={valor}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        autoComplete={autoComplete}
        required={requerido}
      />
    </div>
  );
}
