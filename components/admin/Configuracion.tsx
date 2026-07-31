"use client";

import { useState, useTransition } from "react";
import {
  RESERVA_MINUTOS_MAX,
  RESERVA_PRESETS,
  duracionLarga,
  pill,
} from "@/lib/constantes";
import { soloNumeros } from "@/lib/money";
import { fijarReservaMinutos } from "@/actions/configuracion";

export default function Configuracion({
  reservaMinutos,
  pendientes,
}: {
  reservaMinutos: number;
  /** Cuántos pedidos sin confirmar hay ahora en la horneada abierta. */
  pendientes: number;
}) {
  const [minutos, setMinutos] = useState(String(reservaMinutos));
  const [error, setError] = useState<string | null>(null);
  const [guardado, setGuardado] = useState(false);
  const [pendiente, startTransition] = useTransition();

  const valor = soloNumeros(minutos);
  const sinCambios = valor === reservaMinutos;

  function guardar(nuevos: number) {
    setError(null);
    setGuardado(false);
    startTransition(async () => {
      const r = await fijarReservaMinutos(nuevos);
      if (!r.ok) {
        setError(r.error);
        return;
      }
      setMinutos(String(nuevos));
      setGuardado(true);
    });
  }

  return (
    <div style={{ display: "grid", gap: "var(--space-6)", maxWidth: 720 }}>
      <div style={{ display: "grid", gap: "var(--space-2)" }}>
        <h2 style={{ margin: 0, fontSize: 24 }}>Vencimiento de las reservas</h2>
        <p
          style={{
            margin: 0,
            color: "var(--color-neutral-600)",
            textWrap: "pretty",
          }}
        >
          Cuando alguien termina un pedido en la web, esas unidades le quedan
          guardadas aunque todavía no te haya escrito por WhatsApp. Acá elegís
          cuánto duran: pasado ese rato vuelven solas a la vitrina y las puede
          comprar otra persona. Desde que vos lo pasás a{" "}
          <strong>Confirmado</strong>, la reserva ya no vence nunca.
        </p>
      </div>

      <div
        style={{
          display: "grid",
          gap: "var(--space-5)",
          padding: "var(--space-6)",
          borderRadius: "var(--radius-lg)",
          background: "var(--color-surface)",
        }}
      >
        <div style={{ display: "grid", gap: "var(--space-3)" }}>
          <label style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
            Duración de la reserva
          </label>
          <div
            style={{ display: "flex", flexWrap: "wrap", gap: "var(--space-2)" }}
          >
            {RESERVA_PRESETS.map((p) => (
              <button
                key={p.minutos}
                type="button"
                disabled={pendiente}
                onClick={() => guardar(p.minutos)}
                style={{
                  fontFamily: "var(--font-body)",
                  fontSize: 13,
                  padding: "var(--space-2) var(--space-4)",
                  borderRadius: 999,
                  cursor: pendiente ? "wait" : "pointer",
                  ...pill(valor === p.minutos),
                }}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>

        <div
          style={{
            display: "flex",
            alignItems: "flex-end",
            gap: "var(--space-3)",
            flexWrap: "wrap",
          }}
        >
          <div className="field" style={{ display: "grid", gap: "var(--space-2)" }}>
            <label htmlFor="reserva-minutos">O poné los minutos exactos</label>
            <input
              id="reserva-minutos"
              className="input"
              value={minutos}
              inputMode="numeric"
              onChange={(e) => {
                setMinutos(e.target.value);
                setGuardado(false);
              }}
              style={{ width: 120 }}
            />
          </div>
          <button
            type="button"
            className="btn btn-primary"
            disabled={pendiente || sinCambios}
            onClick={() => guardar(valor)}
            style={{
              borderRadius: 999,
              padding: "var(--space-3) var(--space-6)",
            }}
          >
            {pendiente ? "Guardando…" : "Guardar"}
          </button>
        </div>

        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-neutral-600)",
            textWrap: "pretty",
          }}
        >
          {valor === 0
            ? "Con 0 minutos los pedidos sin confirmar no reservan nada: el stock recién baja cuando los confirmás. Ojo que así podés recibir dos pedidos por la misma última cookie."
            : `Ahora mismo: un pedido sin confirmar retiene el stock ${duracionLarga(reservaMinutos)} desde que se hace. El máximo son ${RESERVA_MINUTOS_MAX} minutos (una semana).`}
        </p>

        {error && (
          <div
            role="alert"
            style={{
              fontSize: 13,
              color: "var(--color-accent-2-800)",
              background: "var(--color-accent-2-100)",
              border: "1px solid var(--color-accent-2-300)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            {error}
          </div>
        )}

        {guardado && !error && (
          <div
            role="status"
            style={{
              fontSize: 13,
              color: "var(--color-accent-700)",
              background: "var(--color-accent-100)",
              borderRadius: "var(--radius-md)",
              padding: "var(--space-3) var(--space-4)",
            }}
          >
            Guardado. El cambio ya se aplica a los pedidos que están sin
            confirmar ahora mismo.
          </div>
        )}
      </div>

      {pendientes > 0 && (
        <p
          style={{
            margin: 0,
            fontSize: 13,
            color: "var(--color-neutral-600)",
            textWrap: "pretty",
          }}
        >
          Tenés {pendientes} {pendientes === 1 ? "pedido" : "pedidos"} sin
          confirmar. Si bajás la duración, los que ya pasaron el rato nuevo
          liberan el stock al instante — el pedido no se cancela, pero al
          confirmarlo te va a avisar si las unidades ya no están.
        </p>
      )}
    </div>
  );
}
