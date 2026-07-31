/** Franjas horarias de entrega. El índice es lo que se guarda en horneada_dias.franjas. */
export const FRANJAS = [
  "Mañana 9 a 13",
  "Tarde 14 a 18",
  "Noche 18 a 21",
] as const;

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
