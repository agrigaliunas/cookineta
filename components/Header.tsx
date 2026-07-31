import Image from "next/image";
import Link from "next/link";
import logo from "@/public/logo.png";

type Props = {
  /** 'Horneada 24' */
  horneadaLabel?: string;
  /** '3 al 9 de agosto' */
  horneadaRango?: string;
  /** En qué lado estamos parados. */
  vista: "cliente" | "admin";
  /** Si hay sesión, se muestra el acceso al panel. */
  haySesion: boolean;
};

/**
 * La barra superior del mockup. El toggle Cliente/Administración era un
 * setState; acá es navegación real, y "Administración" sólo aparece con sesión
 * iniciada.
 */
export default function Header({
  horneadaLabel,
  horneadaRango,
  vista,
  haySesion,
}: Props) {
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: "var(--space-6)",
        justifyContent: "space-between",
        padding: "var(--space-4) var(--space-8)",
        borderBottom: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
        position: "sticky",
        top: 0,
        zIndex: 6,
        flexWrap: "wrap",
      }}
    >
      <Link
        href="/"
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-3)",
          textDecoration: "none",
          color: "var(--color-text)",
        }}
      >
        {/*
          El PNG es 1024×1536 con la chapa circular centrada y mucho margen
          transparente arriba y abajo. `cover` sobre un cuadrado recorta ese
          margen sobrante y deja la chapa entera; `alt` va vacío a propósito
          porque el nombre ya está escrito al lado y si no se leería dos veces.
        */}
        <Image
          src={logo}
          alt=""
          width={48}
          height={48}
          preload
          style={{
            width: 48,
            height: 48,
            borderRadius: 999,
            objectFit: "cover",
            flex: "none",
          }}
        />
        <div style={{ display: "grid", gap: 2 }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontSize: 21,
              lineHeight: 1,
            }}
          >
            La Cookineta
          </div>
          <div style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
            Galletas de horno · Zona Norte y Zona Sur
          </div>
        </div>
      </Link>

      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "var(--space-4)",
          flexWrap: "wrap",
        }}
      >
        {horneadaLabel && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "var(--space-2)",
              padding: "var(--space-2) var(--space-4)",
              borderRadius: 999,
              background: "var(--color-accent-2-100)",
              border: "1px solid var(--color-accent-2-300)",
            }}
          >
            <span
              style={{
                fontFamily: "var(--font-heading)",
                fontSize: 13,
                color: "var(--color-accent-2-800)",
              }}
            >
              {horneadaLabel}
            </span>
            <span style={{ fontSize: 12, color: "var(--color-accent-2-700)" }}>
              {horneadaRango}
            </span>
          </div>
        )}

        {haySesion && (
          <div
            style={{
              display: "flex",
              gap: 4,
              padding: 4,
              borderRadius: 999,
              background: "var(--color-neutral-200)",
            }}
          >
            <Tab href="/" activo={vista === "cliente"}>
              Cliente
            </Tab>
            <Tab href="/admin" activo={vista === "admin"}>
              Administración
            </Tab>
          </div>
        )}
      </div>
    </div>
  );
}

function Tab({
  href,
  activo,
  children,
}: {
  href: string;
  activo: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="btn"
      style={{
        borderRadius: 999,
        padding: "var(--space-2) var(--space-4)",
        background: activo ? "var(--color-bg)" : "transparent",
        color: activo ? "var(--color-accent-700)" : "var(--color-neutral-600)",
        boxShadow: activo ? "var(--shadow-sm)" : "none",
        textDecoration: "none",
      }}
    >
      {children}
    </Link>
  );
}
