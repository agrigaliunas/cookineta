import type { Catalogo, ComboVitrina } from "@/lib/consultas";

/** Cookies sueltas: producto_id → cantidad. */
export type Sueltas = Record<string, number>;

/** Una caja ya armada. `uid` sólo existe en el navegador, para poder editarla. */
export type CajaArmada = {
  uid: string;
  comboId: string;
  /** producto_id → cantidad, cubriendo exactamente las ranuras del combo. */
  elecciones: Record<string, number>;
};

export type Carrito = {
  sueltas: Sueltas;
  cajas: CajaArmada[];
};

export const CARRITO_VACIO: Carrito = { sueltas: {}, cajas: [] };

/**
 * Cuántas unidades de un producto ya están comprometidas en el carrito,
 * sumando las sueltas y las que están adentro de cada caja.
 *
 * Es el mismo criterio que aplica la RPC del lado del servidor: si no se
 * contaran juntas, la vitrina dejaría armar un pedido que después rebota.
 */
export function comprometidas(carrito: Carrito, productoId: string): number {
  const enCajas = carrito.cajas.reduce(
    (n, c) => n + (c.elecciones[productoId] ?? 0),
    0,
  );
  return (carrito.sueltas[productoId] ?? 0) + enCajas;
}

/** Cuánto queda realmente disponible de un producto para seguir sumando. */
export function margen(
  carrito: Carrito,
  datos: Catalogo,
  productoId: string,
): number {
  const p = datos.productos.find((x) => x.id === productoId);
  if (!p) return 0;
  return Math.max(0, p.disponible - comprometidas(carrito, productoId));
}

/** Cuántas unidades faltan para completar una ranura de la caja. */
export function faltanEnRanura(
  combo: ComboVitrina,
  elecciones: Record<string, number>,
  categoriaId: string,
  productos: Catalogo["productos"],
): number {
  const ranura = combo.ranuras.find((r) => r.categoriaId === categoriaId);
  if (!ranura) return 0;

  const puestas = Object.entries(elecciones).reduce((n, [id, q]) => {
    const p = productos.find((x) => x.id === id);
    return p?.categoriaId === categoriaId ? n + q : n;
  }, 0);

  return ranura.cantidad - puestas;
}

/** Una caja está lista cuando todas sus ranuras quedaron exactas. */
export function cajaCompleta(
  combo: ComboVitrina,
  elecciones: Record<string, number>,
  productos: Catalogo["productos"],
): boolean {
  return combo.ranuras.every(
    (r) => faltanEnRanura(combo, elecciones, r.categoriaId, productos) === 0,
  );
}

export function subtotalCarrito(carrito: Carrito, datos: Catalogo): number {
  const sueltas = Object.entries(carrito.sueltas).reduce((n, [id, q]) => {
    const p = datos.productos.find((x) => x.id === id);
    return n + (p ? p.precio * q : 0);
  }, 0);

  const cajas = carrito.cajas.reduce((n, c) => {
    const combo = datos.combos.find((x) => x.id === c.comboId);
    return n + (combo ? combo.precio : 0);
  }, 0);

  return sueltas + cajas;
}

/** Cuántas cookies hay en total en el pedido, sueltas y en cajas. */
export function unidadesCarrito(carrito: Carrito): number {
  const sueltas = Object.values(carrito.sueltas).reduce((a, b) => a + b, 0);
  const enCajas = carrito.cajas.reduce(
    (n, c) => n + Object.values(c.elecciones).reduce((a, b) => a + b, 0),
    0,
  );
  return sueltas + enCajas;
}

export function carritoVacio(carrito: Carrito): boolean {
  return unidadesCarrito(carrito) === 0;
}

export type LineaResumen = {
  clave: string;
  titulo: string;
  detalle?: string;
  total: number;
};

/** Las líneas que se muestran en el carrito, el checkout y el resumen. */
export function lineasResumen(
  carrito: Carrito,
  datos: Catalogo,
): LineaResumen[] {
  const sueltas = Object.entries(carrito.sueltas).map(([id, q]) => {
    const p = datos.productos.find((x) => x.id === id);
    return {
      clave: id,
      titulo: `${q}× ${p?.nombre ?? "Cookie"}`,
      total: p ? p.precio * q : 0,
    };
  });

  const cajas = carrito.cajas.map((c) => {
    const combo = datos.combos.find((x) => x.id === c.comboId);
    const detalle = Object.entries(c.elecciones)
      .filter(([, q]) => q > 0)
      .map(([id, q]) => {
        const p = datos.productos.find((x) => x.id === id);
        return `${p?.nombre ?? "Cookie"} ×${q}`;
      })
      .join(", ");

    return {
      clave: c.uid,
      titulo: combo?.nombre ?? "Caja",
      detalle,
      total: combo?.precio ?? 0,
    };
  });

  return [...cajas, ...sueltas];
}

/** Traduce el carrito a lo que espera la RPC. */
export function payloadDeCarrito(carrito: Carrito) {
  return {
    items: Object.entries(carrito.sueltas)
      .filter(([, q]) => q > 0)
      .map(([producto_id, cantidad]) => ({ producto_id, cantidad })),
    combos: carrito.cajas.map((c) => ({
      combo_id: c.comboId,
      cantidad: 1,
      elecciones: Object.entries(c.elecciones)
        .filter(([, q]) => q > 0)
        .map(([producto_id, cantidad]) => ({ producto_id, cantidad })),
    })),
  };
}
