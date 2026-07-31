import Panel, { type FilaAgrupada } from "@/components/admin/Panel";
import { horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { diaCorto } from "@/lib/fechas";
import { money } from "@/lib/money";
import type { VentaLinea, Zona } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata = { title: "Panel · La Cookineta" };

type Agrupacion = "producto" | "zona" | "dia";

export default async function PanelPage({
  searchParams,
}: {
  searchParams: Promise<{ agrupar?: string }>;
}) {
  const { agrupar } = await searchParams;
  const agrupacion: Agrupacion =
    agrupar === "zona" || agrupar === "dia" ? agrupar : "producto";

  const supabase = await supabaseServer();
  const horneada = await horneadaAbierta();

  if (!horneada) {
    return (
      <p style={{ color: "var(--color-neutral-600)" }}>
        No hay ninguna horneada abierta. Creá una desde “Horneada y zonas”.
      </p>
    );
  }

  const [{ data: ventas }, { data: pedidos }, { data: zonas }, { data: stock }] =
    await Promise.all([
      supabase.from("v_ventas").select("*").eq("horneada_id", horneada.id),
      supabase
        .from("pedidos")
        .select("id, estado, envio, total")
        .eq("horneada_id", horneada.id)
        .neq("estado", "cancelado"),
      supabase.from("zonas").select("*").order("orden"),
      supabase
        .from("horneada_stock")
        .select("planificado")
        .eq("horneada_id", horneada.id),
    ]);

  const lineas = (ventas ?? []) as VentaLinea[];
  const listaPedidos = pedidos ?? [];
  const porZona = new Map((zonas ?? []).map((z: Zona) => [z.id, z]));

  const facturado = lineas.reduce((n, l) => n + l.ingreso, 0);
  const envios = listaPedidos.reduce((n, p) => n + p.envio, 0);
  // Sólo las líneas de tipo 'producto' son cookies. Las de tipo 'combo' son la
  // caja en sí, y sumarlas contaría la caja como si fuera una galleta más.
  const unidades = lineas
    .filter((l) => l.tipo === "producto")
    .reduce((n, l) => n + l.cantidad, 0);
  const cajas = lineas
    .filter((l) => l.tipo === "combo")
    .reduce((n, l) => n + l.cantidad, 0);
  const planificado = (stock ?? []).reduce((n, s) => n + s.planificado, 0);

  const entregados = listaPedidos.filter((p) => p.estado === "entregado").length;
  const sinConfirmar = listaPedidos.filter(
    (p) => p.estado === "pendiente_whatsapp",
  ).length;
  const enCurso = listaPedidos.length - entregados;

  // El agrupado que el mockup hacía en el navegador, ahora sobre v_ventas.
  const baldes = new Map<
    string,
    { label: string; sub: string; unidades: number; ingresos: number; tono: string }
  >();

  for (const l of lineas) {
    // Agrupando por producto se listan cookies y cajas por separado; por zona o
    // por día, las cookies de adentro de una caja aportan 0 y la plata la pone
    // la línea de la caja, así el total no se duplica.
    const zona = porZona.get(l.zona_id);
    const clave =
      agrupacion === "producto"
        ? `${l.tipo}:${l.item_id}`
        : agrupacion === "zona"
          ? l.zona_id
          : l.horneada_dia_id;

    const label =
      agrupacion === "producto"
        ? l.item_nombre
        : agrupacion === "zona"
          ? (zona?.nombre ?? l.zona_id)
          : diaCorto(l.fecha);

    const sub =
      agrupacion === "producto"
        ? l.tipo === "combo"
          ? `caja · ${money(l.precio_unitario)}`
          : `${money(l.precio_unitario)} c/u`
        : (zona?.hub ?? "");

    const actual = baldes.get(clave) ?? {
      label,
      sub,
      unidades: 0,
      ingresos: 0,
      tono:
        agrupacion === "producto"
          ? l.tipo === "combo"
            ? "dorado"
            : "azul"
          : l.zona_id === "sur"
            ? "dorado"
            : "azul",
    };
    actual.unidades += l.cantidad;
    actual.ingresos += l.ingreso;
    baldes.set(clave, actual);
  }

  const lista = [...baldes.entries()]
    .map(([id, g]) => ({ id, ...g }))
    .sort((a, b) => b.ingresos - a.ingresos);
  const maxIngresos = lista.reduce((m, g) => Math.max(m, g.ingresos), 0) || 1;
  const totalIngresos = lista.reduce((m, g) => m + g.ingresos, 0) || 1;

  const filas: FilaAgrupada[] = lista.map((g) => ({
    id: g.id,
    label: g.label,
    sub: `${g.sub} · ${Math.round((g.ingresos / totalIngresos) * 100)}% de los ingresos`,
    unidades: g.unidades,
    ingresos: g.ingresos,
    tono: g.tono === "dorado" ? "dorado" : "azul",
    ancho: `${Math.max(4, Math.round((g.ingresos / maxIngresos) * 100))}%`,
  }));

  return (
    <Panel
      agrupacion={agrupacion}
      filas={filas}
      kpis={{
        pedidos: listaPedidos.length,
        entregados,
        enCurso,
        sinConfirmar,
        facturado: facturado + envios,
        envios,
        unidades,
        cajas,
        planificado,
      }}
    />
  );
}
