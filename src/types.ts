export type UnidadInfo = { clave: string; nombre: string; dimension: "masa" | "volumen" | "unidad"; factor: number };

export type Usuario = { id: number; usuario: string; nombre: string; es_admin: boolean; activo: boolean };

export type Proveedor = { id: number; nombre: string; contacto: string; notas: string; presentaciones?: number };

export type Presentacion = {
  id?: number | null;
  proveedor_id: number | null;
  proveedor?: string | null;
  descripcion: string;
  precio: number;
  cantidad: number;
  unidad: string;
  merma_pct: number;
  preferida: boolean;
  fecha: string | null;
  contenido_base?: number | null;
  aprovechable_base?: number | null;
  costo_unitario?: number | null;
  error?: string | null;
};

export type CostoIng = {
  menor: number | null; mayor: number | null; promedio: number | null; preferida: number | null;
  seleccionado: number | null; presentacion_usada: number | null; error: string | null;
};

export type Ingrediente = {
  id: number;
  nombre: string;
  categoria: string;
  unidad_base: "g" | "ml" | "unidad";
  peso_unidad_g: number | null;
  densidad_g_ml: number | null;
  base_costo: "preferida" | "menor" | "promedio" | "mayor";
  notas: string;
  presentaciones: Presentacion[];
  costo: CostoIng;
  usos?: number;
  recetas?: { id: number; nombre: string }[];
};

export type Item = {
  ingrediente_id: number | null;
  subreceta_id: number | null;
  cantidad: number;
  unidad: string;
  merma_pct: number;
};

export type Receta = {
  id?: number;
  nombre: string;
  tipo: "producto" | "subreceta";
  categoria: string;
  rinde_cantidad: number;
  rinde_unidad: string;
  merma_pct: number;
  margen_objetivo_pct: number | null;
  precio_venta: number | null;
  precio_competencia: number | null;
  notas: string;
  descripcion_menu: string;
  en_menu: boolean;
  items: Item[];
};

export type ResumenReceta = {
  id: number; nombre: string; tipo: "producto" | "subreceta"; categoria: string;
  rinde_cantidad: number; rinde_unidad: string; precio_venta: number | null; precio_competencia: number | null;
  n_items: number; costo_total: number | null; costo_por_rinde: number | null; precio_sugerido: number | null;
  margen_real_pct: number | null; ganancia: number | null; diferencia_competencia: number | null;
  errores: string[]; actualizado: string | null;
  foto: string | null; en_menu: boolean;
};

export type FilaCalculo = {
  indice: number; nombre: string | null; tipo: string | null; cantidad_base: number | null; unidad_base: string | null;
  costo_unitario: number | null; costo: number | null; costo_menor: number | null; costo_mayor: number | null;
  participacion: number; error: string | null;
};

export type Calculo = {
  items: FilaCalculo[];
  errores: string[];
  subtotal_ingredientes: number;
  merma_general: number;
  totales: { seleccionado: number; menor: number; promedio: number; mayor: number };
  rinde_base: number | null;
  unidad_minima: string | null;
  costo_por_rinde: number | null;
  costo_por_unidad_minima: number | null;
  precios: {
    margen_objetivo_pct: number; iva_pct: number; precio_sugerido_sin_iva: number | null; precio_sugerido: number | null;
    precio_venta: number | null; precio_venta_sin_iva: number | null; ganancia: number | null;
    margen_real_pct: number | null; costo_sobre_venta_pct: number | null; precio_competencia: number | null;
    diferencia_competencia: number | null;
  };
};

export type Config = {
  margen_objetivo_pct: number; iva_pct: number; aplicar_iva: boolean; redondeo: number; nombre_negocio: string;
};

export type Negocio = {
  nombre: string; eslogan: string; lugar: string; descripcion: string; telefono: string; whatsapp: string; email: string;
  direccion: string; mapa: string; horario: string; instagram: string; facebook: string; tiktok: string;
  sitio_web: string; color: string; mostrar_precios: boolean; logo: string | null; distintivo?: "logo" | "gorro" | "ninguno";
};

export type MenuPublico = {
  negocio: Omit<Negocio, "mostrar_precios">;
  categorias: { nombre: string; productos: { id: number; nombre: string; descripcion: string; precio: number | null; foto: string | null; es_arte?: boolean }[] }[];
};
