/**
 * Tipos de la base, escritos a mano para que coincidan con
 * supabase/migrations/20260731000000_schema.sql.
 *
 * Si cambiás el esquema, regeneralos con:
 *   npx supabase gen types typescript --local > lib/types.ts
 */
import type { EstadoHorneada, EstadoPedido } from "./constantes";

export type Zona = {
  id: string;
  nombre: string;
  hub: string;
  envio: number;
  activa: boolean;
  orden: number;
};

export type Categoria = {
  id: string;
  nombre: string;
  orden: number;
  activa: boolean;
};

export type Producto = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  foto_url: string | null;
  activo: boolean;
  categoria_id: string | null;
  creado_en: string;
};

export type Combo = {
  id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  foto_url: string | null;
  activo: boolean;
  creado_en: string;
};

/** Una ranura del combo: "3 unidades de Caprichosas". */
export type ComboItem = {
  id: string;
  combo_id: string;
  categoria_id: string;
  cantidad: number;
};

export type HorneadaCombo = {
  horneada_id: string;
  combo_id: string;
  precio: number;
};

export type PedidoCombo = {
  id: string;
  pedido_id: string;
  combo_id: string;
  nombre: string;
  precio: number;
  cantidad: number;
};

export type Horneada = {
  id: string;
  numero: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoHorneada;
  envio_gratis_desde: number;
  creada_en: string;
};

export type HorneadaDia = {
  id: string;
  horneada_id: string;
  fecha: string;
  zona_id: string | null;
  franjas: number[];
};

export type HorneadaStock = {
  horneada_id: string;
  producto_id: string;
  planificado: number;
  precio: number;
};

export type Disponibilidad = {
  horneada_id: string;
  producto_id: string;
  planificado: number;
  precio: number;
  reservado: number;
  disponible: number;
};

export type Pedido = {
  id: string;
  codigo: number;
  horneada_id: string;
  horneada_dia_id: string;
  zona_id: string;
  franja_idx: number;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  nota: string;
  subtotal: number;
  envio: number;
  total: number;
  estado: EstadoPedido;
  confirmado_en: string | null;
  creado_en: string;
};

export type PedidoItem = {
  id: string;
  pedido_id: string;
  producto_id: string;
  nombre: string;
  precio_unitario: number;
  cantidad: number;
  /** No nulo = esta cookie va adentro de una caja, y la paga la caja. */
  pedido_combo_id: string | null;
};

export type VentaLinea = {
  horneada_id: string;
  pedido_id: string;
  zona_id: string;
  horneada_dia_id: string;
  fecha: string;
  estado: EstadoPedido;
  /** 'producto' = cookies (sueltas o de caja); 'combo' = la caja en sí. */
  tipo: "producto" | "combo";
  item_id: string;
  item_nombre: string;
  precio_unitario: number;
  cantidad: number;
  ingreso: number;
};

/** Lo que devuelve la RPC crear_pedido. */
export type ResultadoCrearPedido = {
  pedido_id: string;
  codigo: number;
  subtotal: number;
  envio: number;
  total: number;
  zona: string;
  hub: string;
  fecha: string;
  lineas: { nombre: string; cantidad: number; total: number }[];
  combos: {
    nombre: string;
    cantidad: number;
    total: number;
    /** 'Chocotón ×4, Red velvet ×2' */
    detalle: string;
  }[];
};

/** Atajo para declarar una foreign key en el formato que espera postgrest-js. */
type FK<C extends string, R extends string> = {
  foreignKeyName: string;
  columns: [C];
  isOneToOne: false;
  referencedRelation: R;
  referencedColumns: ["id"];
};

export type Database = {
  public: {
    Tables: {
      zonas: {
        Row: Zona;
        Insert: Partial<Zona> & Pick<Zona, "id" | "nombre" | "hub">;
        Update: Partial<Zona>;
        Relationships: [];
      };
      categorias: {
        Row: Categoria;
        Insert: Partial<Categoria> & Pick<Categoria, "nombre">;
        Update: Partial<Categoria>;
        Relationships: [];
      };
      productos: {
        Row: Producto;
        Insert: Partial<Producto> & Pick<Producto, "nombre" | "precio">;
        Update: Partial<Producto>;
        Relationships: [FK<"categoria_id", "categorias">];
      };
      combos: {
        Row: Combo;
        Insert: Partial<Combo> & Pick<Combo, "nombre" | "precio">;
        Update: Partial<Combo>;
        Relationships: [];
      };
      combo_items: {
        Row: ComboItem;
        Insert: Partial<ComboItem> &
          Pick<ComboItem, "combo_id" | "categoria_id" | "cantidad">;
        Update: Partial<ComboItem>;
        Relationships: [FK<"combo_id", "combos">, FK<"categoria_id", "categorias">];
      };
      horneada_combos: {
        Row: HorneadaCombo;
        Insert: HorneadaCombo;
        Update: Partial<HorneadaCombo>;
        Relationships: [FK<"horneada_id", "horneadas">, FK<"combo_id", "combos">];
      };
      pedido_combos: {
        Row: PedidoCombo;
        Insert: Partial<PedidoCombo>;
        Update: Partial<PedidoCombo>;
        Relationships: [FK<"pedido_id", "pedidos">, FK<"combo_id", "combos">];
      };
      horneadas: {
        Row: Horneada;
        Insert: Partial<Horneada> &
          Pick<Horneada, "numero" | "fecha_inicio" | "fecha_fin">;
        Update: Partial<Horneada>;
        Relationships: [];
      };
      horneada_dias: {
        Row: HorneadaDia;
        Insert: Partial<HorneadaDia> & Pick<HorneadaDia, "horneada_id" | "fecha">;
        Update: Partial<HorneadaDia>;
        Relationships: [
          FK<"horneada_id", "horneadas">,
          FK<"zona_id", "zonas">,
        ];
      };
      horneada_stock: {
        Row: HorneadaStock;
        Insert: HorneadaStock;
        Update: Partial<HorneadaStock>;
        Relationships: [
          FK<"horneada_id", "horneadas">,
          FK<"producto_id", "productos">,
        ];
      };
      pedidos: {
        // Insert queda como Partial pero en la práctica es inalcanzable: RLS no
        // le da INSERT a nadie, los pedidos entran sólo por crear_pedido().
        Row: Pedido;
        Insert: Partial<Pedido>;
        Update: Partial<Pedido>;
        Relationships: [
          FK<"horneada_id", "horneadas">,
          FK<"horneada_dia_id", "horneada_dias">,
          FK<"zona_id", "zonas">,
        ];
      };
      pedido_items: {
        Row: PedidoItem;
        Insert: Partial<PedidoItem>;
        Update: Partial<PedidoItem>;
        Relationships: [
          FK<"pedido_id", "pedidos">,
          FK<"producto_id", "productos">,
          FK<"pedido_combo_id", "pedido_combos">,
        ];
      };
    };
    Views: {
      v_disponibilidad: { Row: Disponibilidad; Relationships: [] };
      v_ventas: { Row: VentaLinea; Relationships: [] };
    };
    Functions: {
      crear_pedido: {
        Args: { payload: PayloadCrearPedido };
        Returns: ResultadoCrearPedido;
      };
    };
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
};

export type PayloadCrearPedido = {
  horneada_dia_id: string;
  franja_idx: number;
  cliente_nombre: string;
  cliente_telefono: string;
  direccion: string;
  nota: string;
  /** Cookies sueltas. */
  items: { producto_id: string; cantidad: number }[];
  /** Cajas armadas: cada una con las cookies que eligió quien compra. */
  combos: {
    combo_id: string;
    cantidad: number;
    elecciones: { producto_id: string; cantidad: number }[];
  }[];
};
