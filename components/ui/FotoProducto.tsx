/**
 * Reemplazo del <image-slot> del prototipo. Si el producto todavía no tiene
 * foto cargada, muestra el placeholder dorado con el nombre — igual que el
 * mockup — en vez de un hueco roto.
 */
export default function FotoProducto({
  url,
  nombre,
  alto,
  ancho,
  radio = "var(--radius-md)",
}: {
  url: string | null;
  nombre: string;
  alto: number;
  ancho?: number;
  radio?: string;
}) {
  return (
    <div
      style={{
        position: "relative",
        width: ancho ?? "100%",
        height: alto,
        borderRadius: radio,
        overflow: "hidden",
        background: "var(--color-accent-2-100)",
        flex: "none",
      }}
    >
      {url ? (
        // Las fotos vienen de Supabase Storage, ya recortadas y con cache larga;
        // configurar next/image para media docena de imágenes no paga.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={url}
          alt={nombre}
          style={{ width: "100%", height: "100%", objectFit: "cover" }}
        />
      ) : (
        <div
          style={{
            width: "100%",
            height: "100%",
            display: "grid",
            placeItems: "center",
            padding: "var(--space-2)",
            textAlign: "center",
            fontSize: alto > 80 ? 13 : 10,
            lineHeight: 1.2,
            color: "var(--color-accent-2-700)",
          }}
        >
          {nombre}
        </div>
      )}
    </div>
  );
}
