import Header from "@/components/Header";
import Catalogo from "@/components/cliente/Catalogo";
import { cargarCatalogo } from "@/lib/consultas";
import { supabaseServer } from "@/lib/supabase/server";
import { WHATSAPP_NEGOCIO, linkWhatsApp } from "@/lib/whatsapp";

// El stock cambia con cada pedido: la vitrina no se puede cachear.
export const dynamic = "force-dynamic";

export default async function Home() {
  const supabase = await supabaseServer();
  const [datos, { data: auth }] = await Promise.all([
    cargarCatalogo(),
    supabase.auth.getUser(),
  ]);

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "var(--color-bg)",
        color: "var(--color-text)",
      }}
    >
      <Header
        horneadaLabel={datos?.label}
        horneadaRango={datos?.rango}
        vista="cliente"
        haySesion={!!auth.user}
      />
      <div className="pagina">
        {datos ? <Catalogo datos={datos} /> : <SinHorneada />}
      </div>
    </div>
  );
}

function SinHorneada() {
  return (
    <div
      style={{
        maxWidth: 560,
        display: "grid",
        gap: "var(--space-4)",
        padding: "var(--space-8)",
        borderRadius: "var(--radius-lg)",
        background: "var(--color-surface)",
      }}
    >
      <h2 style={{ margin: 0, fontSize: 30 }}>La horneada todavía no abrió</h2>
      <p style={{ margin: 0, color: "var(--color-neutral-700)" }}>
        Cada horneada abre el domingo anterior a la semana de entrega. Volvé en
        unos días o escribinos y te avisamos.
      </p>
      <a
        href={linkWhatsApp(
          WHATSAPP_NEGOCIO,
          "¡Hola! Quería saber cuándo abre la próxima horneada.",
        )}
        target="_blank"
        rel="noopener noreferrer"
        className="btn btn-primary"
        style={{
          justifySelf: "start",
          padding: "var(--space-3) var(--space-6)",
          textDecoration: "none",
          color: "#fff",
        }}
      >
        Escribinos por WhatsApp
      </a>
    </div>
  );
}
