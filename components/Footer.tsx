const INSTAGRAM_URL = "https://instagram.com/lacookineta.ar";
const WHATSAPP_URL = "https://wa.me/5491137585499";

/**
 * Pie del sitio del cliente. Sólo las dos redes por las que la gente escribe:
 * no es un mapa del sitio, es dónde encontrarnos.
 */
export default function Footer() {
  return (
    <footer
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: "var(--space-6)",
        flexWrap: "wrap",
        padding: "var(--space-8)",
        borderTop: "1px solid var(--color-divider)",
        background: "var(--color-bg)",
      }}
    >
      <div style={{ display: "grid", gap: 2 }}>
        <span style={{ fontFamily: "var(--font-heading)", fontSize: 17 }}>
          La Cookineta
        </span>
        <span style={{ fontSize: 13, color: "var(--color-neutral-600)" }}>
          Galletas de horno · Zona Norte y Zona Sur
        </span>
      </div>

      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <Red href={INSTAGRAM_URL} nombre="Instagram">
          <IconoInstagram />
        </Red>
        <Red href={WHATSAPP_URL} nombre="WhatsApp">
          <IconoWhatsApp />
        </Red>
      </div>
    </footer>
  );
}

function Red({
  href,
  nombre,
  children,
}: {
  href: string;
  nombre: string;
  children: React.ReactNode;
}) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={nombre}
      title={nombre}
      style={{
        width: 44,
        height: 44,
        borderRadius: 999,
        display: "grid",
        placeItems: "center",
        color: "var(--color-accent-700)",
        background: "var(--color-surface)",
        border: "1px solid var(--color-divider)",
      }}
    >
      {children}
    </a>
  );
}

/** Cámara: marco, lente y flash. Se dibuja con formas, no con un logo pegado. */
function IconoInstagram() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={21}
      height={21}
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      <rect x="2.5" y="2.5" width="19" height="19" rx="5.5" />
      <circle cx="12" cy="12" r="4.2" />
      <circle cx="17.5" cy="6.5" r="1.1" fill="currentColor" stroke="none" />
    </svg>
  );
}

function IconoWhatsApp() {
  return (
    <svg
      viewBox="0 0 24 24"
      width={21}
      height={21}
      fill="currentColor"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51l-.57-.01c-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347M12.05 21.785h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413" />
    </svg>
  );
}
