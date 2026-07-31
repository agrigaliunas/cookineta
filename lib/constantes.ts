/** Franjas horarias de entrega. El índice es lo que se guarda en horneada_dias.franjas. */
export const FRANJAS = [
  "Mañana 9 a 13",
  "Tarde 14 a 18",
  "Noche 18 a 21",
] as const;

/** Cómo recibe el pedido: se lo llevamos, o lo pasa a buscar por el hub. */
export type FormaEntrega = "envio" | "take_away";

export const ETIQUETA_ENTREGA: Record<FormaEntrega, string> = {
  envio: "Envío a domicilio",
  take_away: "Retiro en el local",
};

export type EstadoPedido =
  | "pendiente_whatsapp"
  | "confirmado"
  | "en_horno"
  | "en_reparto"
  | "entregado"
  | "cancelado";

/** La cadena por la que avanza un pedido. `cancelado` queda afuera: es una salida lateral. */
export const FLUJO_ESTADOS: EstadoPedido[] = [
  "pendiente_whatsapp",
  "confirmado",
  "en_horno",
  "en_reparto",
  "entregado",
];

export const ETIQUETA_ESTADO: Record<EstadoPedido, string> = {
  pendiente_whatsapp: "Sin confirmar",
  confirmado: "Confirmado",
  en_horno: "En horno",
  en_reparto: "En reparto",
  entregado: "Entregado",
  cancelado: "Cancelado",
};

/** [fondo, texto] — hereda el mapa `statusTone` del mockup. */
export const TONO_ESTADO: Record<EstadoPedido, [string, string]> = {
  pendiente_whatsapp: ["var(--color-accent-2-200)", "var(--color-accent-2-800)"],
  confirmado: ["var(--color-accent-100)", "var(--color-accent-700)"],
  en_horno: ["var(--color-accent-2-100)", "var(--color-accent-2-700)"],
  en_reparto: ["var(--color-accent-200)", "var(--color-accent-700)"],
  entregado: ["var(--color-neutral-200)", "var(--color-neutral-700)"],
  cancelado: ["var(--color-neutral-100)", "var(--color-neutral-500)"],
};

/**
 * Techo de `configuracion.reserva_minutos`, una semana. Espeja el check de la
 * migración 20260731020000: si cambia uno, cambian los dos.
 */
export const RESERVA_MINUTOS_MAX = 10080;

/** Los presets del selector de vencimiento de reservas. */
export const RESERVA_PRESETS: { minutos: number; label: string }[] = [
  { minutos: 0, label: "Sin reserva" },
  { minutos: 30, label: "30 minutos" },
  { minutos: 60, label: "1 hora" },
  { minutos: 180, label: "3 horas" },
  { minutos: 720, label: "12 horas" },
  { minutos: 1440, label: "1 día" },
  { minutos: 4320, label: "3 días" },
];

/** '1 h 30 min' — para mostrar un `reserva_minutos` en texto. */
export function duracionLarga(minutos: number): string {
  if (minutos <= 0) return "sin reserva";

  const dias = Math.floor(minutos / 1440);
  const horas = Math.floor((minutos % 1440) / 60);
  const mins = minutos % 60;

  return (
    [
      dias && `${dias} ${dias === 1 ? "día" : "días"}`,
      horas && `${horas} h`,
      mins && `${mins} min`,
    ]
      .filter(Boolean)
      .join(" ") || "sin reserva"
  );
}

export const ESTADO_HORNEADA = ["borrador", "abierta", "cerrada"] as const;
export type EstadoHorneada = (typeof ESTADO_HORNEADA)[number];

/** Estilo de las píldoras seleccionables — el helper `pill()` del mockup. */
export function pill(activo: boolean, tono: "azul" | "dorado" = "azul") {
  const base = tono === "dorado" ? "accent-2" : "accent";
  return activo
    ? {
        background: `var(--color-${base}-600)`,
        color: "#ffffff",
        border: `1px solid var(--color-${base}-600)`,
      }
    : {
        background: "var(--color-bg)",
        color: "var(--color-text)",
        border: "1px solid var(--color-divider)",
      };
}
