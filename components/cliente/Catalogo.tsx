"use client";

import { useEffect, useMemo, useState } from "react";
import type { Catalogo as DatosCatalogo, ComboVitrina } from "@/lib/consultas";
import { FRANJAS, pill, type FormaEntrega } from "@/lib/constantes";
import { money } from "@/lib/money";
import {
  CARRITO_VACIO,
  carritoVacio,
  comprometidas,
  lineasResumen,
  payloadDeCarrito,
  subtotalCarrito,
  unidadesCarrito,
  type CajaArmada,
  type Carrito,
} from "@/lib/carrito";
import { crearPedido } from "@/actions/pedidos";
import Vitrina from "./Vitrina";
import ArmarCaja from "./ArmarCaja";
import Checkout from "./Checkout";
import PedidoOk from "./PedidoOk";

type Paso = "catalogo" | "checkout" | "ok";

const CLAVE_CARRITO = "cookineta:carrito";
const CLAVE_CONFIRMADO = "cookineta:ultimo-pedido";

export type PedidoConfirmado = {
  codigo: number;
  waUrl: string;
  resumen: string;
  total: number;
};

/**
 * El equivalente al `state` del prototipo: zona, día, carrito y paso viven acá.
 * Los datos (productos, combos, disponibilidad, días) bajan como props ya
 * resueltos desde el Server Component.
 */
export default function Catalogo({ datos }: { datos: DatosCatalogo }) {
  const [zonaId, setZonaId] = useState<string | null>(null);
  const [diaId, setDiaId] = useState<string | null>(null);
  const [franjaIdx, setFranjaIdx] = useState<number | null>(null);
  const [entrega, setEntrega] = useState<FormaEntrega>("envio");
  const [carrito, setCarrito] = useState<Carrito>(CARRITO_VACIO);
  const [paso, setPaso] = useState<Paso>("catalogo");
  const [confirmado, setConfirmado] = useState<PedidoConfirmado | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [hidratado, setHidratado] = useState(false);
  const [armando, setArmando] = useState<{
    combo: ComboVitrina;
    caja?: CajaArmada;
  } | null>(null);

  // El carrito sobrevive a un refresh. La restauración va sí o sí en un efecto:
  // el servidor no puede leer localStorage, así que si lo pusiéramos en el
  // render inicial el HTML del servidor y el del navegador no coincidirían.
  useEffect(() => {
    try {
      // WhatsApp se abre en otra pestaña, pero si la clienta recarga esta o
      // vuelve atrás, la recuperamos de acá en vez de dejarla sin el número de
      // pedido ni el link para mandar el mensaje.
      const ultimo = sessionStorage.getItem(CLAVE_CONFIRMADO);
      if (ultimo) {
        // eslint-disable-next-line react-hooks/set-state-in-effect
        setConfirmado(JSON.parse(ultimo));
        setPaso("ok");
      } else {
        const guardado = localStorage.getItem(CLAVE_CARRITO);
        if (guardado) {
          const parseado = JSON.parse(guardado);
          // Guarda contra carritos viejos del formato anterior (sin cajas).
          if (parseado?.sueltas && Array.isArray(parseado?.cajas)) {
            setCarrito(parseado);
          }
        }
      }
    } catch {
      // Storage bloqueado (modo incógnito estricto): seguimos sin persistir.
    }
    setHidratado(true);
  }, []);

  useEffect(() => {
    if (!hidratado) return;
    try {
      localStorage.setItem(CLAVE_CARRITO, JSON.stringify(carrito));
    } catch {
      /* storage bloqueado */
    }
  }, [carrito, hidratado]);

  const zona = datos.zonas.find((z) => z.id === zonaId) ?? null;
  const diasDeZona = useMemo(
    () => datos.dias.filter((d) => d.zonaId === zonaId),
    [datos.dias, zonaId],
  );
  const dia = datos.dias.find((d) => d.id === diaId) ?? null;

  const subtotal = subtotalCarrito(carrito, datos);
  const unidades = unidadesCarrito(carrito);
  const lineas = lineasResumen(carrito, datos);

  // Retirar por el hub no cuesta nada. Espeja la cuenta de crear_pedido, que es
  // la que manda: acá sólo se muestra.
  const envio =
    !zona || entrega === "take_away"
      ? 0
      : subtotal >= datos.horneada.envio_gratis_desde
        ? 0
        : zona.envio;

  const total = subtotal + envio;

  function sumar(id: string) {
    const p = datos.productos.find((x) => x.id === id);
    if (!p) return;
    if (comprometidas(carrito, id) >= p.disponible) return;
    setCarrito((c) => ({
      ...c,
      sueltas: { ...c.sueltas, [id]: (c.sueltas[id] ?? 0) + 1 },
    }));
  }

  function restar(id: string) {
    setCarrito((c) => {
      if (!c.sueltas[id]) return c;
      const sueltas = { ...c.sueltas, [id]: c.sueltas[id] - 1 };
      if (sueltas[id] === 0) delete sueltas[id];
      return { ...c, sueltas };
    });
  }

  function guardarCaja(elecciones: Record<string, number>) {
    if (!armando) return;
    const { combo, caja } = armando;

    setCarrito((c) => {
      if (caja) {
        return {
          ...c,
          cajas: c.cajas.map((x) =>
            x.uid === caja.uid ? { ...x, elecciones } : x,
          ),
        };
      }
      return {
        ...c,
        cajas: [
          ...c.cajas,
          { uid: crypto.randomUUID(), comboId: combo.id, elecciones },
        ],
      };
    });
    setArmando(null);
  }

  function quitarCaja(uid: string) {
    setCarrito((c) => ({ ...c, cajas: c.cajas.filter((x) => x.uid !== uid) }));
  }

  function elegirZona(id: string) {
    setZonaId(id);
    setDiaId(null);
    setFranjaIdx(null);
  }

  function elegirDia(id: string) {
    setDiaId(id);
    const d = datos.dias.find((x) => x.id === id);
    setFranjaIdx(d?.franjas[0] ?? null);
  }

  const puedeContinuar = !!zona && !!dia && unidades > 0;

  const resumenEntrega = zona
    ? dia
      ? entrega === "take_away"
        ? `Retirás en ${zona.hub} · ${dia.etiqueta}`
        : `Envío en ${zona.nombre} · desde ${zona.hub} · ${dia.etiqueta}`
      : `${zona.nombre} · elegí un día de entrega`
    : "Elegí tu zona para ver días y envío";

  async function confirmar(form: {
    nombre: string;
    telefono: string;
    direccion: string;
    nota: string;
  }) {
    if (!dia || franjaIdx === null) return;
    setEnviando(true);
    setError(null);

    const respuesta = await crearPedido({
      horneada_dia_id: dia.id,
      franja_idx: franjaIdx,
      cliente_nombre: form.nombre,
      cliente_telefono: form.telefono,
      direccion: form.direccion,
      nota: form.nota,
      entrega,
      ...payloadDeCarrito(carrito),
    });

    setEnviando(false);

    if (!respuesta.ok) {
      setError(respuesta.error);
      return;
    }

    const pedido: PedidoConfirmado = {
      codigo: respuesta.codigo,
      waUrl: respuesta.waUrl,
      resumen: respuesta.resumen,
      total: respuesta.total,
    };

    setConfirmado(pedido);
    setCarrito(CARRITO_VACIO);
    setPaso("ok");

    try {
      sessionStorage.setItem(CLAVE_CONFIRMADO, JSON.stringify(pedido));
      localStorage.removeItem(CLAVE_CARRITO);
    } catch {
      /* storage bloqueado */
    }

    // Intento de apertura automática en una pestaña nueva, para no perder la
    // pantalla de confirmación. Si el navegador lo bloquea (el `await` de arriba
    // puede haber consumido el gesto del usuario, y iOS es especialmente
    // estricto), `open` devuelve null y no pasa nada: la pantalla de
    // confirmación siempre muestra el botón con el mismo link.
    window.open(respuesta.waUrl, "_blank", "noopener,noreferrer");
  }

  if (paso === "ok" && confirmado) {
    return (
      <PedidoOk
        pedido={confirmado}
        onNuevoPedido={() => {
          try {
            sessionStorage.removeItem(CLAVE_CONFIRMADO);
          } catch {
            /* storage bloqueado */
          }
          setConfirmado(null);
          setDiaId(null);
          setFranjaIdx(null);
          setPaso("catalogo");
        }}
      />
    );
  }

  if (paso === "checkout") {
    return (
      <Checkout
        resumenEntrega={resumenEntrega}
        entrega={entrega}
        onEntrega={setEntrega}
        hub={zona?.hub ?? ""}
        envioZona={zona?.envio ?? 0}
        envioGratisDesde={datos.horneada.envio_gratis_desde}
        franjasDelDia={dia ? dia.franjas : []}
        franjaIdx={franjaIdx}
        onFranja={setFranjaIdx}
        lineas={lineas}
        subtotal={subtotal}
        envio={envio}
        total={total}
        enviando={enviando}
        error={error}
        onVolver={() => {
          setError(null);
          setPaso("catalogo");
        }}
        onConfirmar={confirmar}
      />
    );
  }

  return (
    <>
      <div className="grid-catalogo">
        <div style={{ display: "grid", gap: "var(--space-8)" }}>
          <div style={{ display: "grid", gap: "var(--space-4)" }}>
            <div style={{ display: "grid", gap: "var(--space-1)" }}>
              <h2 style={{ fontSize: 30, margin: 0 }}>
                Armá tu pedido de la horneada
              </h2>
              <p
                style={{
                  margin: 0,
                  color: "var(--color-neutral-600)",
                  maxWidth: "52ch",
                  textWrap: "pretty",
                }}
              >
                Elegí tu zona y el día de entrega. Cada horneada abre el domingo
                anterior y las unidades se reservan por orden de pedido.
              </p>
            </div>

            <div className="grid-zonas">
              {datos.zonas.map((z) => {
                const activo = zonaId === z.id;
                const dias = datos.dias.filter((d) => d.zonaId === z.id);
                return (
                  <button
                    key={z.id}
                    type="button"
                    onClick={() => elegirZona(z.id)}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      fontFamily: "var(--font-body)",
                      fontSize: 14,
                      color: "var(--color-text)",
                      padding: "var(--space-6)",
                      borderRadius: "var(--radius-lg)",
                      background: activo
                        ? "var(--color-accent-100)"
                        : "var(--color-bg)",
                      border: `2px solid ${activo ? "var(--color-accent-600)" : "var(--color-divider)"}`,
                      display: "grid",
                      gap: "var(--space-2)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: "var(--space-3)",
                      }}
                    >
                      <span
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: 20,
                        }}
                      >
                        {z.nombre}
                      </span>
                      <span
                        style={{
                          width: 22,
                          height: 22,
                          borderRadius: 999,
                          border: `2px solid ${activo ? "var(--color-accent-600)" : "var(--color-neutral-400)"}`,
                          background: activo
                            ? "var(--color-accent-600)"
                            : "transparent",
                        }}
                      />
                    </div>
                    <div style={{ color: "var(--color-neutral-600)" }}>
                      Base en {z.hub} ·{" "}
                      {dias.length
                        ? dias.map((d) => d.nombreDia.slice(0, 3)).join(", ")
                        : "sin días esta horneada"}
                    </div>
                    <div
                      style={{ fontSize: 13, color: "var(--color-accent-600)" }}
                    >
                      Envío {money(z.envio)}
                    </div>
                  </button>
                );
              })}
            </div>

            {zona && (
              <div
                style={{
                  display: "grid",
                  gap: "var(--space-3)",
                  padding: "var(--space-6)",
                  borderRadius: "var(--radius-lg)",
                  background: "var(--color-surface)",
                }}
              >
                <div style={{ fontFamily: "var(--font-heading)", fontSize: 15 }}>
                  Días de entrega en {zona.hub}
                </div>
                <div
                  style={{
                    display: "flex",
                    flexWrap: "wrap",
                    gap: "var(--space-2)",
                  }}
                >
                  {diasDeZona.length === 0 && (
                    <span
                      style={{ fontSize: 14, color: "var(--color-neutral-600)" }}
                    >
                      Esta horneada no tiene días asignados a {zona.nombre}.
                    </span>
                  )}
                  {diasDeZona.map((d) => {
                    const sinFranjas = d.franjas.length === 0;
                    const p = pill(diaId === d.id);
                    return (
                      <button
                        key={d.id}
                        type="button"
                        onClick={() => elegirDia(d.id)}
                        disabled={sinFranjas}
                        style={{
                          cursor: sinFranjas ? "not-allowed" : "pointer",
                          fontFamily: "var(--font-body)",
                          fontSize: 14,
                          padding: "var(--space-2) var(--space-4)",
                          borderRadius: 999,
                          opacity: sinFranjas ? 0.45 : 1,
                          display: "flex",
                          gap: "var(--space-2)",
                          alignItems: "baseline",
                          ...p,
                        }}
                      >
                        <span style={{ fontWeight: 600 }}>{d.etiqueta}</span>
                        <span style={{ fontSize: 12, opacity: 0.75 }}>
                          {sinFranjas
                            ? "sin franjas"
                            : d.franjas
                                .map((i) => FRANJAS[i].split(" ")[0])
                                .join(" / ")}
                        </span>
                      </button>
                    );
                  })}
                </div>

                {/*
                  Aparece recién con el día elegido: hasta ahí no hay nada que
                  decidir, y "retirar el jueves" se entiende mejor que "retirar".
                */}
                {dia && (
                  <>
                    <div
                      style={{ height: 1, background: "var(--color-divider)" }}
                    />
                    <div style={{ display: "grid", gap: "var(--space-2)" }}>
                      <div
                        style={{
                          fontFamily: "var(--font-heading)",
                          fontSize: 15,
                        }}
                      >
                        ¿Cómo lo querés recibir el {dia.etiqueta.toLowerCase()}?
                      </div>
                      <div
                        style={{
                          display: "flex",
                          flexWrap: "wrap",
                          gap: "var(--space-2)",
                        }}
                      >
                        <OpcionEntrega
                          activo={entrega === "envio"}
                          onClick={() => setEntrega("envio")}
                          titulo="Envío a domicilio"
                          detalle={
                            subtotal >= datos.horneada.envio_gratis_desde
                              ? "sin cargo por el monto"
                              : money(zona.envio)
                          }
                        />
                        <OpcionEntrega
                          activo={entrega === "take_away"}
                          onClick={() => setEntrega("take_away")}
                          titulo="Retiro en el local"
                          detalle={`${zona.hub} · sin cargo`}
                        />
                      </div>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <Vitrina
            datos={datos}
            carrito={carrito}
            onSumar={sumar}
            onRestar={restar}
            onArmarCaja={(combo) => setArmando({ combo })}
          />
        </div>

        <div className="carrito">
          <div style={{ fontFamily: "var(--font-heading)", fontSize: 19 }}>
            Tu pedido
          </div>
          <div
            style={{
              display: "grid",
              gap: "var(--space-2)",
              fontSize: 13,
              color: "var(--color-neutral-700)",
            }}
          >
            <div>{resumenEntrega}</div>
          </div>
          <div style={{ height: 1, background: "var(--color-divider)" }} />

          {carritoVacio(carrito) ? (
            <div
              style={{
                fontSize: 14,
                color: "var(--color-neutral-600)",
                padding: "var(--space-4) 0",
              }}
            >
              Todavía no elegiste nada. Sumá galletas desde la vitrina.
            </div>
          ) : (
            <div style={{ display: "grid", gap: "var(--space-3)" }}>
              {carrito.cajas.map((caja) => {
                const combo = datos.combos.find((x) => x.id === caja.comboId);
                if (!combo) return null;
                const detalle = Object.entries(caja.elecciones)
                  .map(([id, q]) => {
                    const p = datos.productos.find((x) => x.id === id);
                    return `${p?.nombre ?? "Cookie"} ×${q}`;
                  })
                  .join(", ");
                return (
                  <div
                    key={caja.uid}
                    style={{
                      display: "grid",
                      gap: 4,
                      padding: "var(--space-2) var(--space-3)",
                      borderRadius: "var(--radius-md)",
                      background: "var(--color-accent-2-100)",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        gap: "var(--space-2)",
                        fontSize: 14,
                        fontWeight: 600,
                      }}
                    >
                      <span>{combo.nombre}</span>
                      <span style={{ fontVariantNumeric: "tabular-nums" }}>
                        {money(combo.precio)}
                      </span>
                    </div>
                    <div
                      style={{ fontSize: 12, color: "var(--color-accent-2-800)" }}
                    >
                      {detalle}
                    </div>
                    <div style={{ display: "flex", gap: "var(--space-3)" }}>
                      <button
                        type="button"
                        onClick={() => setArmando({ combo, caja })}
                        style={enlaceChico}
                      >
                        Cambiar
                      </button>
                      <button
                        type="button"
                        onClick={() => quitarCaja(caja.uid)}
                        style={enlaceChico}
                      >
                        Quitar
                      </button>
                    </div>
                  </div>
                );
              })}

              {Object.entries(carrito.sueltas).map(([id, q]) => {
                const p = datos.productos.find((x) => x.id === id);
                return (
                  <div
                    key={id}
                    style={{
                      display: "flex",
                      alignItems: "baseline",
                      justifyContent: "space-between",
                      gap: "var(--space-3)",
                      fontSize: 14,
                    }}
                  >
                    <span>
                      {q}× {p?.nombre}
                    </span>
                    <span style={{ fontVariantNumeric: "tabular-nums" }}>
                      {money((p?.precio ?? 0) * q)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}

          <div style={{ height: 1, background: "var(--color-divider)" }} />
          <div style={{ display: "grid", gap: "var(--space-2)", fontSize: 14 }}>
            <Fila etiqueta="Subtotal" valor={money(subtotal)} />
            <Fila
              etiqueta={entrega === "take_away" ? "Retiro" : "Envío"}
              valor={!zona ? "—" : envio === 0 ? "sin cargo" : money(envio)}
            />
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                fontFamily: "var(--font-heading)",
                fontSize: 19,
                paddingTop: "var(--space-2)",
              }}
            >
              <span>Total</span>
              <span>{money(total)}</span>
            </div>
          </div>

          <button
            type="button"
            className="btn btn-primary"
            onClick={() => setPaso("checkout")}
            disabled={!puedeContinuar}
            style={{
              borderRadius: 999,
              justifyContent: "center",
              padding: "var(--space-3) var(--space-4)",
              fontSize: 15,
            }}
          >
            Continuar
          </button>
          <div
            style={{
              fontSize: 12,
              color: "var(--color-neutral-600)",
              textWrap: "pretty",
            }}
          >
            {!puedeContinuar
              ? "Necesitás zona, día y al menos una galleta para continuar."
              : entrega === "take_away"
                ? `Reservás las unidades al confirmar. Lo retirás en ${zona.hub}.`
                : `Reservás las unidades al confirmar. Envío sin cargo desde ${money(datos.horneada.envio_gratis_desde)}.`}
          </div>
        </div>
      </div>

      {armando && (
        <ArmarCaja
          combo={armando.combo}
          datos={datos}
          carrito={carrito}
          eleccionesIniciales={armando.caja?.elecciones}
          onGuardar={guardarCaja}
          onCerrar={() => setArmando(null)}
        />
      )}
    </>
  );
}

function OpcionEntrega({
  activo,
  onClick,
  titulo,
  detalle,
}: {
  activo: boolean;
  onClick: () => void;
  titulo: string;
  detalle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      style={{
        cursor: "pointer",
        textAlign: "left",
        fontFamily: "var(--font-body)",
        fontSize: 14,
        padding: "var(--space-3) var(--space-4)",
        borderRadius: "var(--radius-md)",
        display: "grid",
        gap: 2,
        ...pill(activo),
      }}
    >
      <span style={{ fontWeight: 600 }}>{titulo}</span>
      <span style={{ fontSize: 12, opacity: 0.8 }}>{detalle}</span>
    </button>
  );
}

const enlaceChico: React.CSSProperties = {
  background: "none",
  border: 0,
  padding: 0,
  cursor: "pointer",
  fontSize: 12,
  textDecoration: "underline",
  color: "var(--color-accent-700)",
};

function Fila({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between" }}>
      <span style={{ color: "var(--color-neutral-600)" }}>{etiqueta}</span>
      <span>{valor}</span>
    </div>
  );
}
