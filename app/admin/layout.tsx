import { redirect } from "next/navigation";
import Header from "@/components/Header";
import TabsAdmin from "@/components/admin/TabsAdmin";
import { cerrarSesion } from "@/actions/auth";
import { horneadaAbierta } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { rangoHorneada } from "@/lib/fechas";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // El middleware ya redirige, pero el layout no puede confiar en eso: si
  // alguna vez el matcher cambia, esto sigue cerrando la puerta.
  if (!user) redirect("/login");

  const horneada = await horneadaAbierta();

  return (
    <div style={{ minHeight: "100vh" }}>
      <Header
        horneadaLabel={horneada ? `Horneada ${horneada.numero}` : undefined}
        horneadaRango={
          horneada
            ? rangoHorneada(horneada.fecha_inicio, horneada.fecha_fin)
            : undefined
        }
        vista="admin"
        haySesion
      />
      <div className="pagina" style={{ display: "grid", gap: "var(--space-6)" }}>
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: "var(--space-4)",
            flexWrap: "wrap",
          }}
        >
          <TabsAdmin />
          <form action={cerrarSesion}>
            <button
              type="submit"
              className="btn btn-secondary"
              style={{ fontSize: 13, padding: "var(--space-2) var(--space-4)" }}
            >
              Salir
            </button>
          </form>
        </div>
        {children}
      </div>
    </div>
  );
}
