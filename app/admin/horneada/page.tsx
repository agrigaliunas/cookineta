import PlanHorneada, {
  type DiaPlan,
} from "@/components/admin/PlanHorneada";
import { armarDia, horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { rangoHorneada } from "@/lib/fechas";
import type { HorneadaDia, Zona } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Horneada · La Cookineta" };

export default async function HorneadaPage() {
  const supabase = await supabaseServer();
  const horneada = await horneadaAbierta();
  const { data: zonas } = await supabase.from("zonas").select("*").order("orden");

  if (!horneada) {
    return (
      <PlanHorneada
        horneada={null}
        zonas={(zonas ?? []) as Zona[]}
        dias={[]}
        rango=""
      />
    );
  }

  const [{ data: dias }, { data: pedidos }] = await Promise.all([
    supabase
      .from("horneada_dias")
      .select("*")
      .eq("horneada_id", horneada.id)
      .order("fecha"),
    supabase
      .from("pedidos")
      .select("horneada_dia_id, estado, pedido_items(cantidad)")
      .eq("horneada_id", horneada.id)
      .not("estado", "in", "(cancelado,entregado)"),
  ]);

  // Cuántos pedidos y unidades hay comprometidos por día.
  const carga = new Map<string, { pedidos: number; unidades: number }>();
  for (const p of (pedidos ?? []) as unknown as {
    horneada_dia_id: string;
    pedido_items: { cantidad: number }[];
  }[]) {
    const actual = carga.get(p.horneada_dia_id) ?? { pedidos: 0, unidades: 0 };
    actual.pedidos += 1;
    actual.unidades += p.pedido_items.reduce((n, i) => n + i.cantidad, 0);
    carga.set(p.horneada_dia_id, actual);
  }

  const filas: DiaPlan[] = ((dias ?? []) as HorneadaDia[]).map((d) => {
    const base = armarDia(d);
    const c = carga.get(d.id) ?? { pedidos: 0, unidades: 0 };
    return { ...base, pedidos: c.pedidos, unidades: c.unidades };
  });

  return (
    <PlanHorneada
      horneada={horneada}
      zonas={(zonas ?? []) as Zona[]}
      dias={filas}
      rango={rangoHorneada(horneada.fecha_inicio, horneada.fecha_fin)}
    />
  );
}
