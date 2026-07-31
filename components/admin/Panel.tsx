import Link from "next/link";
import { money } from "@/lib/money";

export type FilaAgrupada = {
  /** Clave del agrupamiento: dos productos pueden llamarse igual. */
  id: string;
  label: string;
  sub: string;
  unidades: number;
  ingresos: number;
  tono: "azul" | "dorado";
  ancho: string;
};

type Kpis = {
  pedidos: number;
  entregados: number;
  enCurso: number;
  sinConfirmar: number;
  facturado: number;
  envios: number;
  unidades: number;
  cajas: number;
  planificado: number;
};

const AGRUPACIONES = [
  { id: "producto", label: "Producto", header: "Producto" },
  { id: "zona", label: "Zona", header: "Zona" },
  { id: "dia", label: "Día", header: "Día de entrega" },
] as const;

export default function Panel({
  agrupacion,
  filas,
  kpis,
}: {
  agrupacion: "producto" | "zona" | "dia";
  filas: FilaAgrupada[];
  kpis: Kpis;
}) {
  const header =
    AGRUPACIONES.find((a) => a.id === agrupacion)?.header ?? "Producto";

  return (
    <div style={{ display: "grid", gap: "var(--space-8)" }}>
      <div className="grid-kpis">
        <Tarjeta
          etiqueta="Ventas"
          valor={String(kpis.pedidos)}
          nota={`${kpis.entregados} entregadas · ${kpis.enCurso} en curso`}
          fondo="var(--color-accent-100)"
        />
        <Tarjeta
          etiqueta="Plata generada"
          valor={money(kpis.facturado)}
          nota={`incluye ${money(kpis.envios)} de envíos`}
          fondo="var(--color-accent-2-100)"
        />
        <Tarjeta
          etiqueta="Unidades vendidas"
          valor={String(kpis.unidades)}
          nota={
            kpis.cajas > 0
              ? `de ${kpis.planificado} planificadas · ${kpis.cajas} en cajas`
              : `de ${kpis.planificado} planificadas`
          }
          fondo="var(--color-bg)"
        />
        <Tarjeta
          etiqueta="Sin confirmar"
          valor={String(kpis.sinConfirmar)}
          nota={
            kpis.sinConfirmar > 0
              ? "esperando que les respondas"
              : "no hay nada pendiente"
          }
          fondo={
            kpis.sinConfirmar > 0 ? "var(--color-accent-2-200)" : "var(--color-bg)"
          }
        />
      </div>

      <div style={{ display: "grid", gap: "var(--space-4)" }}>
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
          }}
        >
          <h3 style={{ margin: 0, fontSize: 22 }}>Ventas agrupadas</h3>
          <div
            style={{
              display: "flex",
              gap: "var(--space-2)",
              alignItems: "center",
              flexWrap: "wrap",
            }}
          >
            <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
              Agrupar por
            </span>
            {AGRUPACIONES.map((a) => {
              const activo = agrupacion === a.id;
              return (
                <Link
                  key={a.id}
                  href={`/admin?agrupar=${a.id}`}
                  style={{
                    fontFamily: "var(--font-body)",
                    fontSize: 13,
                    padding: "var(--space-2) var(--space-4)",
                    borderRadius: 999,
                    textDecoration: "none",
                    background: activo
                      ? "var(--color-accent-600)"
                      : "var(--color-bg)",
                    color: activo ? "#ffffff" : "var(--color-text)",
                    border: `1px solid ${activo ? "var(--color-accent-600)" : "var(--color-divider)"}`,
                  }}
                >
                  {a.label}
                </Link>
              );
            })}
          </div>
        </div>

        {filas.length === 0 ? (
          <p style={{ color: "var(--color-neutral-600)" }}>
            Todavía no hay ventas en esta horneada.
          </p>
        ) : (
          <div className="scroll-x">
            <div style={{ minWidth: 700 }}>
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "220px 1fr 120px 130px",
                  gap: "var(--space-6)",
                  padding: "0 var(--space-6)",
                  fontSize: 12,
                  textTransform: "uppercase",
                  letterSpacing: "0.06em",
                  color: "var(--color-neutral-500)",
                }}
              >
                <span>{header}</span>
                <span>Participación</span>
                <span style={{ textAlign: "right" }}>Unidades</span>
                <span style={{ textAlign: "right" }}>Ingresos</span>
              </div>

              <div
                style={{
                  display: "grid",
                  gap: "var(--space-3)",
                  marginTop: "var(--space-3)",
                }}
              >
                {filas.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "grid",
                      gridTemplateColumns: "220px 1fr 120px 130px",
                      gap: "var(--space-6)",
                      alignItems: "center",
                      padding: "var(--space-4) var(--space-6)",
                      borderRadius: "var(--radius-lg)",
                      background: "var(--color-bg)",
                      border: "1px solid var(--color-divider)",
                    }}
                  >
                    <div style={{ display: "grid", gap: 2 }}>
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: 16,
                        }}
                      >
                        {f.label}
                      </span>
                      <span
                        style={{
                          fontSize: 12,
                          color: "var(--color-neutral-600)",
                        }}
                      >
                        {f.sub}
                      </span>
                    </div>
                    <div
                      style={{
                        height: 12,
                        borderRadius: 999,
                        background: "var(--color-neutral-200)",
                        overflow: "hidden",
                      }}
                    >
                      <div
                        style={{
                          height: "100%",
                          borderRadius: 999,
                          width: f.ancho,
                          background:
                            f.tono === "dorado"
                              ? "var(--color-accent-2-500)"
                              : "var(--color-accent-500)",
                        }}
                      />
                    </div>
                    <span
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontSize: 14,
                        color: "var(--color-neutral-700)",
                      }}
                    >
                      {f.unidades} u.
                    </span>
                    <span
                      style={{
                        textAlign: "right",
                        fontVariantNumeric: "tabular-nums",
                        fontFamily: "var(--font-heading)",
                        fontSize: 17,
                      }}
                    >
                      {money(f.ingresos)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Tarjeta({
  etiqueta,
  valor,
  nota,
  fondo,
}: {
  etiqueta: string;
  valor: string;
  nota: string;
  fondo: string;
}) {
  return (
    <div
      style={{
        display: "grid",
        gap: "var(--space-2)",
        padding: "var(--space-6)",
        borderRadius: "var(--radius-lg)",
        background: fondo,
        border: "1px solid var(--color-divider)",
      }}
    >
      <span
        style={{
          fontSize: 12,
          textTransform: "uppercase",
          letterSpacing: "0.06em",
          color: "var(--color-neutral-600)",
        }}
      >
        {etiqueta}
      </span>
      <span
        style={{ fontFamily: "var(--font-heading)", fontSize: 30, lineHeight: 1 }}
      >
        {valor}
      </span>
      <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
        {nota}
      </span>
    </div>
  );
}
