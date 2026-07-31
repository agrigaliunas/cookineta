import ListaPedidos, { type PedidoAdmin } from "@/components/admin/ListaPedidos";
import { horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { diaCorto, momentoCorto } from "@/lib/fechas";
import {
  FRANJAS,
  duracionLarga,
  type EstadoPedido,
  type FormaEntrega,
} from "@/lib/constantes";
import type { Reserva, Zona } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Pedidos · La Cookineta" };

type FilaPedido = {
  id: string;
  codigo: number;
  zona_id: string;
  franja_idx: number;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  nota: string;
  entrega: FormaEntrega;
  total: number;
  estado: EstadoPedido;
  creado_en: string;
  horneada_dias: { fecha: string } | null;
  pedido_items: {
    nombre: string;
    cantidad: number;
    pedido_combo_id: string | null;
  }[];
  pedido_combos: { id: string; nombre: string; cantidad: number }[];
};

export default async function PedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ zona?: string }>;
}) {
  const { zona: filtro } = await searchParams;
  const supabase = await supabaseServer();
  const horneada = await horneadaAbierta();

  if (!horneada) {
    return (
      <p style={{ color: "var(--color-neutral-600)" }}>
        No hay ninguna horneada abierta. Creá una desde “Horneada y zonas”.
      </p>
    );
  }

  const [{ data: pedidos }, { data: zonas }, { data: reservas }] =
    await Promise.all([
      supabase
        .from("pedidos")
        .select(
          "id, codigo, zona_id, franja_idx, cliente_nombre, cliente_telefono, direccion, nota, entrega, total, estado, creado_en, horneada_dias(fecha), pedido_items(nombre, cantidad, pedido_combo_id), pedido_combos(id, nombre, cantidad)",
        )
        .eq("horneada_id", horneada.id)
        .order("creado_en", { ascending: false }),
      supabase.from("zonas").select("*").order("orden"),
      // Sólo trae los que están sin confirmar: son los únicos con vencimiento.
      supabase.from("v_reservas").select("*").eq("horneada_id", horneada.id),
    ]);

  const porZona = new Map((zonas ?? []).map((z: Zona) => [z.id, z]));
  const porPedido = new Map(
    (reservas ?? []).map((r: Reserva) => [r.pedido_id, r]),
  );

  /**
   * El "¿venció?" lo contesta Postgres (v_reservas), no el reloj de acá: es el
   * mismo que decide si esas unidades volvieron o no a la vitrina.
   */
  function reservaDe(pedidoId: string): PedidoAdmin["reserva"] {
    const r = porPedido.get(pedidoId);
    if (!r) return null;

    if (r.reserva_minutos === 0) {
      return {
        vencida: true,
        texto: "No reserva stock (vencimiento configurado en 0)",
      };
    }

    const cuando = momentoCorto(r.vence_en);

    return r.vencida
      ? {
          vencida: true,
          texto: `Reserva vencida el ${cuando} — el stock volvió a la vitrina`,
        }
      : {
          vencida: false,
          texto: `Reserva el stock hasta el ${cuando} (${duracionLarga(r.reserva_minutos)})`,
        };
  }

  const filas: PedidoAdmin[] = ((pedidos ?? []) as unknown as FilaPedido[]).map(
    (p) => {
      const z = porZona.get(p.zona_id);
      return {
        id: p.id,
        codigo: p.codigo,
        cliente: p.cliente_nombre,
        telefono: p.cliente_telefono,
        // Quien retira no dejó dirección: en su lugar va el punto de retiro.
        direccion:
          p.entrega === "take_away"
            ? `Retira en ${z?.hub ?? p.zona_id}`
            : p.direccion,
        nota: p.nota,
        entrega: p.entrega,
        hub: z?.hub ?? p.zona_id,
        zonaId: p.zona_id,
        zonaLabel: z ? `${z.nombre} · ${z.hub}` : p.zona_id,
        dia: p.horneada_dias ? diaCorto(p.horneada_dias.fecha) : "—",
        franja: FRANJAS[p.franja_idx] ?? "—",
        // Sólo las cookies sueltas: las de adentro de una caja se listan
        // debajo de su caja, para que se vea qué hay que meter en cada una.
        items: p.pedido_items
          .filter((i) => i.pedido_combo_id === null)
          .map((i) => `${i.cantidad}× ${i.nombre}`)
          .join(" · "),
        cajas: p.pedido_combos.map((c) => ({
          nombre: c.nombre,
          cantidad: c.cantidad,
          contenido: p.pedido_items
            .filter((i) => i.pedido_combo_id === c.id)
            .map((i) => `${i.nombre} ×${i.cantidad}`)
            .join(", "),
        })),
        total: p.total,
        estado: p.estado,
        reserva: reservaDe(p.id),
      };
    },
  );

  return (
    <ListaPedidos
      pedidos={filas}
      zonas={(zonas ?? []).map((z: Zona) => ({
        id: z.id,
        label: `${z.nombre} · ${z.hub}`,
      }))}
      filtro={filtro ?? "todos"}
    />
  );
}
