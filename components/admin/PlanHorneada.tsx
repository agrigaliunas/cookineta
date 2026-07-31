"use client";

import { useState, useTransition } from "react";
import { FRANJAS, pill } from "@/lib/constantes";
import { money, soloNumeros } from "@/lib/money";
import type { DiaEntrega } from "@/lib/consultas";
import type { Horneada, Zona } from "@/lib/types";
import {
  abrirSiguienteHorneada,
  alternarFranja,
  fijarEnvioGratis,
  fijarEnvioZona,
  fijarZonaDia,
} from "@/actions/horneada";

export type DiaPlan = DiaEntrega & { pedidos: number; unidades: number };

export default function PlanHorneada({
  horneada,
  zonas,
  dias,
  rango,
}: {
  horneada: Horneada | null;
  zonas: Zona[];
  dias: DiaPlan[];
  rango: string;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pendiente, startTransition] = useTransition();

  const abrirSiguiente = () =>
    startTransition(async () => {
      const r = await abrirSiguienteHorneada();
      if (!r.ok) setError(r.error);
    });

  if (!horneada) {
    return (
      <div style={{ display: "grid", gap: "var(--space-4)", maxWidth: 560 }}>
        <h3 style={{ margin: 0 }}>No hay ninguna horneada abierta</h3>
        <p style={{ margin: 0, color: "var(--color-neutral-600)" }}>
          Hasta que abras una, la web le muestra a las clientas un cartel
          diciendo que todavía no salió.
        </p>
        {error && <Aviso texto={error} onCerrar={() => setError(null)} />}
        <button
          type="button"
          className="btn btn-primary"
          onClick={abrirSiguiente}
          disabled={pendiente}
          style={{ justifySelf: "start", padding: "var(--space-3) var(--space-6)" }}
        >
          {pendiente ? "Abriendo…" : "Abrir la próxima horneada"}
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)" }}>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-end",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        <p
          style={{
            margin: 0,
            color: "var(--color-neutral-600)",
            maxWidth: "62ch",
            textWrap: "pretty",
          }}
        >
          Asigná una zona y sus franjas a cada día de la horneada. Las clientas
          sólo ven los días con zona asignada y al menos una franja.
        </p>
        <button
          type="button"
          className="btn btn-secondary"
          disabled={pendiente}
          onClick={() => {
            if (
              confirm(
                `¿Cerrar la Horneada ${horneada.numero} y abrir la siguiente? Los pedidos actuales se mantienen, pero la web pasa a mostrar la nueva.`,
              )
            ) {
              abrirSiguiente();
            }
          }}
          style={{ padding: "var(--space-2) var(--space-4)", fontSize: 13 }}
        >
          Cerrar y abrir la próxima
        </button>
      </div>

      {error && <Aviso texto={error} onCerrar={() => setError(null)} />}

      <div
        style={{
          display: "grid",
          gap: "var(--space-4)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-1)" }}>
          <h3 style={{ margin: 0, fontSize: 19 }}>Envíos</h3>
          <p style={{ margin: 0, fontSize: 13, color: "var(--color-neutral-600)" }}>
            Horneada {horneada.numero} · {rango}. Sin cargo desde{" "}
            {money(horneada.envio_gratis_desde)}.
          </p>
        </div>
        <div className="grid-form-2">
          {zonas.map((z) => (
            <CampoNumero
              key={z.id}
              etiqueta={`${z.nombre} · ${z.hub}`}
              valorInicial={z.envio}
              onGuardar={(v) => fijarEnvioZona(z.id, v)}
              onError={setError}
            />
          ))}
          <CampoNumero
            etiqueta="Envío sin cargo desde"
            valorInicial={horneada.envio_gratis_desde}
            onGuardar={(v) => fijarEnvioGratis(horneada.id, v)}
            onError={setError}
          />
        </div>
      </div>

      <div style={{ display: "grid", gap: "var(--space-3)" }}>
        {dias.map((d) => (
          <FilaDia key={d.id} dia={d} zonas={zonas} onError={setError} />
        ))}
      </div>
    </div>
  );
}

function FilaDia({
  dia,
  zonas,
  onError,
}: {
  dia: DiaPlan;
  zonas: Zona[];
  onError: (e: string) => void;
}) {
  const [pendiente, startTransition] = useTransition();
  const asignado = dia.zonaId;

  const estado = !asignado
    ? "Día libre"
    : dia.pedidos === 0
      ? "Sin pedidos aún"
      : `${dia.pedidos} pedidos · ${dia.unidades} unidades`;

  const opciones = [
    ...zonas.map((z) => ({ id: z.id as string | null, label: z.hub })),
    { id: null, label: "Libre" },
  ];

  return (
    <div
      className="fila-dia"
      style={{
        background: asignado ? "var(--color-bg)" : "var(--color-neutral-100)",
        opacity: pendiente ? 0.6 : 1,
      }}
    >
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          {dia.nombreDia}
        </span>
        <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
          {dia.fechaLarga}
        </span>
      </div>

      <div style={{ display: "flex", gap: "var(--space-2)", flexWrap: "wrap" }}>
        {opciones.map((o) => {
          const activo = asignado === o.id;
          const p = pill(activo, o.id === "sur" ? "dorado" : "azul");
          return (
            <button
              key={o.id ?? "libre"}
              type="button"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await fijarZonaDia(dia.id, o.id);
                  if (!r.ok) onError(r.error);
                })
              }
              style={{
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 13,
                padding: "var(--space-2) var(--space-4)",
                borderRadius: 999,
                ...p,
              }}
            >
              {o.label}
            </button>
          );
        })}
      </div>

      <div
        className="fila-dia-estado"
        style={{
          fontSize: 13,
          color: asignado ? "var(--color-neutral-700)" : "var(--color-neutral-500)",
          minWidth: 130,
          textAlign: "right",
        }}
      >
        {estado}
      </div>

      <span style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
        Franjas
      </span>
      <div className="fila-dia-franjas">
        {FRANJAS.map((f, i) => {
          const activo = dia.franjas.includes(i);
          const p = pill(activo, "dorado");
          return (
            <button
              key={f}
              type="button"
              disabled={pendiente}
              onClick={() =>
                startTransition(async () => {
                  const r = await alternarFranja(dia.id, i);
                  if (!r.ok) onError(r.error);
                })
              }
              style={{
                cursor: "pointer",
                fontFamily: "var(--font-body)",
                fontSize: 12,
                padding: "var(--space-1) var(--space-3)",
                borderRadius: 999,
                ...p,
              }}
            >
              {f}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function CampoNumero({
  etiqueta,
  valorInicial,
  onGuardar,
  onError,
}: {
  etiqueta: string;
  valorInicial: number;
  onGuardar: (v: number) => Promise<{ ok: true } | { ok: false; error: string }>;
  onError: (e: string) => void;
}) {
  const [valor, setValor] = useState(String(valorInicial));
  const [pendiente, startTransition] = useTransition();

  return (
    <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
      <label>{etiqueta}</label>
      <input
        className="input"
        value={valor}
        inputMode="numeric"
        disabled={pendiente}
        onChange={(e) => setValor(e.target.value)}
        onBlur={() => {
          const v = soloNumeros(valor);
          setValor(String(v));
          if (v !== valorInicial) {
            startTransition(async () => {
              const r = await onGuardar(v);
              if (!r.ok) onError(r.error);
            });
          }
        }}
      />
    </div>
  );
}

function Aviso({ texto, onCerrar }: { texto: string; onCerrar: () => void }) {
  return (
    <div
      role="alert"
      style={{
        display: "flex",
        justifyContent: "space-between",
        gap: "var(--space-4)",
        fontSize: 13,
        color: "var(--color-accent-2-800)",
        background: "var(--color-accent-2-100)",
        border: "1px solid var(--color-accent-2-300)",
        borderRadius: "var(--radius-md)",
        padding: "var(--space-3) var(--space-4)",
      }}
    >
      <span>{texto}</span>
      <button
        type="button"
        onClick={onCerrar}
        style={{ background: "none", border: 0, cursor: "pointer", color: "inherit" }}
        aria-label="Cerrar aviso"
      >
        ×
      </button>
    </div>
  );
}
