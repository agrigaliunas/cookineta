import { money } from "./money";
import type { FormaEntrega } from "./constantes";

/**
 * Número del negocio, en formato internacional sin `+` ni separadores.
 * +54 9 11 3758-5499 — el `9` después del 54 es obligatorio para que WhatsApp
 * resuelva un celular argentino.
 */
export const WHATSAPP_NEGOCIO =
  process.env.NEXT_PUBLIC_WHATSAPP_NEGOCIO ?? "5491137585499";

/**
 * Normaliza un teléfono argentino escrito como venga ("11 5555-5555",
 * "+54 9 11 5555 5555", "01155555555") al formato que espera wa.me.
 */
export function normalizarTelefonoAR(input: string): string {
  let n = input.replace(/\D/g, "");

  if (n.startsWith("54")) n = n.slice(2);
  if (n.startsWith("0")) n = n.slice(1); // 011... → 11...
  if (n.startsWith("9")) n = n.slice(1); // ya traía el 9 de celular

  // Los números escritos "15 5555 5555" llevan el 15 después de la característica.
  n = n.replace(/^(11|2\d{2,3}|3\d{2,3})15/, "$1");

  return "549" + n;
}

export function linkWhatsApp(telefono: string, mensaje: string): string {
  return `https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;
}

export type LineaPedido = { nombre: string; cantidad: number; total: number };

/** Una caja armada, con el detalle de qué cookies eligió quien compra. */
export type ComboPedido = {
  nombre: string;
  cantidad: number;
  total: number;
  /** 'Chocotón ×4, Red velvet ×2' */
  detalle: string;
};

export type ResumenPedido = {
  codigo: number;
  cliente: string;
  telefono: string;
  /** Vacía cuando retira. */
  direccion: string;
  entrega: FormaEntrega;
  zona: string;
  hub: string;
  dia: string;
  franja: string;
  nota?: string | null;
  lineas: LineaPedido[];
  combos?: ComboPedido[];
  subtotal: number;
  envio: number;
  total: number;
};

/** El mensaje que el cliente le manda al negocio al confirmar. */
export function mensajeNuevoPedido(p: ResumenPedido): string {
  // Las cajas van primero y con su contenido desglosado: es lo que tu hermana
  // necesita leer para armarlas.
  const cajas = (p.combos ?? []).map(
    (c) =>
      `• ${c.cantidad}× ${c.nombre} — ${money(c.total)}\n    ↳ ${c.detalle}`,
  );

  const sueltas = p.lineas.map(
    (l) => `• ${l.cantidad}× ${l.nombre} — ${money(l.total)}`,
  );

  const retira = p.entrega === "take_away";

  return [
    `¡Hola La Cookineta! Hice el pedido *#${p.codigo}* desde la web.`,
    "🍪🍪🍪",
    [...cajas, ...sueltas].join("\n"),
    "🍪🍪🍪",
    `💵 Subtotal: ${money(p.subtotal)}`,
    retira
      ? "🛍️ Retiro en el local (sin cargo)"
      : `🛵 Envío: ${p.envio === 0 ? "sin cargo" : money(p.envio)}`,
    `💰 *Total: ${money(p.total)}*`,
    "",
    `Nombre: ${p.cliente}`,
    retira
      ? `Retiro en ${p.hub} — ${p.dia}, ${p.franja}`
      : `Entrega: ${p.zona} (${p.hub}) — ${p.dia}, ${p.franja}`,
    // Quien retira no dio dirección: la línea directamente no va.
    retira ? null : `Dirección: ${p.direccion}`,
    p.nota ? `Nota: ${p.nota}` : null,
    "",
    "Quedo esperando la confirmación. ¡Gracias!",
  ]
    .filter((l) => l !== null)
    .join("\n");
}

/** El mensaje con el que el negocio le confirma el pedido al cliente. */
export function mensajeConfirmacion(p: {
  codigo: number;
  cliente: string;
  dia: string;
  franja: string;
  total: number;
  entrega: FormaEntrega;
  hub: string;
}): string {
  const retira = p.entrega === "take_away";

  return [
    `¡Hola ${p.cliente}! Soy de La Cookineta 🍪`,
    "",
    `Te confirmo el pedido *#${p.codigo}*.`,
    retira
      ? `Lo pasás a buscar por ${p.hub} el ${p.dia}, en la franja de ${p.franja}.`
      : `Te lo llevamos el ${p.dia} en la franja de ${p.franja}.`,
    `Total: ${money(p.total)} (efectivo o transferencia al ${retira ? "retirar" : "recibir"}).`,
    "",
    "Te escribo el día anterior con el horario más exacto. ¡Gracias!",
  ].join("\n");
}

/**
 * Única puerta de salida hacia WhatsApp.
 *
 * Hoy devuelve el link `wa.me` para que lo abra el navegador. Si algún día se
 * suma WhatsApp Cloud API o Twilio, el envío automático se enchufa acá adentro
 * sin tocar las server actions ni los componentes.
 */
export function notificarPedido(p: ResumenPedido): { waUrl: string } {
  return { waUrl: linkWhatsApp(WHATSAPP_NEGOCIO, mensajeNuevoPedido(p)) };
}
