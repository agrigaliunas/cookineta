-- ═══════════════════════════════════════════════════════════════════════════
-- Datos de arranque — reproducen el mockup, ya con categorías y combos.
--
-- Ojo: `supabase db reset` corre esto SÓLO en local. En producción no se
-- ejecuta nunca, así que los pedidos de ejemplo de acá abajo no van a
-- aparecerle a tu hermana. Para poblar producción está el panel de admin.
--
-- Las zonas y las dos categorías vienen en las migraciones: son estructurales.
-- ═══════════════════════════════════════════════════════════════════════════

insert into public.productos (id, nombre, descripcion, precio, categoria_id) values
  ('11111111-0000-4000-8000-000000000001', 'Chocotón clásica',
   'Chips de chocolate semiamargo, centro tierno.', 2200,
   '55555555-0000-4000-8000-000000000001'),
  ('11111111-0000-4000-8000-000000000002', 'Triple chocolate',
   'Cacao, chips blancos y negros.', 2500,
   '55555555-0000-4000-8000-000000000001'),
  ('11111111-0000-4000-8000-000000000004', 'Avena, nuez y pasas',
   'Menos dulce, con canela.', 2100,
   '55555555-0000-4000-8000-000000000001'),
  ('11111111-0000-4000-8000-000000000003', 'Rellena de dulce de leche',
   'Masa de vainilla con corazón de repostero.', 2600,
   '55555555-0000-4000-8000-000000000002'),
  ('11111111-0000-4000-8000-000000000005', 'Red velvet',
   'Con chips blancos y un toque de queso crema.', 2400,
   '55555555-0000-4000-8000-000000000002');

-- La "Caja degustación x9" del mockup era un producto suelto. Ahora es un combo
-- de verdad: 6 esenciales + 3 caprichosas que elige quien compra.
insert into public.combos (id, nombre, descripcion, precio) values
  ('66666666-0000-4000-8000-000000000001', 'Caja para compartir x9',
   'Nueve cookies elegidas por vos, en caja para regalo.', 17500);

insert into public.combo_items (combo_id, categoria_id, cantidad) values
  ('66666666-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000001', 6),
  ('66666666-0000-4000-8000-000000000001', '55555555-0000-4000-8000-000000000002', 3);

-- Horneada 24: lunes 3 al domingo 9 de agosto de 2026.
insert into public.horneadas (id, numero, fecha_inicio, fecha_fin, estado, envio_gratis_desde)
values ('22222222-0000-4000-8000-000000000024', 24, '2026-08-03', '2026-08-09', 'abierta', 20000);

-- Los 7 días con su zona y sus franjas, igual que dayZones/dayFranjas del mockup.
insert into public.horneada_dias (id, horneada_id, fecha, zona_id, franjas) values
  ('33333333-0000-4000-8000-000000000001', '22222222-0000-4000-8000-000000000024', '2026-08-03', 'norte', '{0,1}'),
  ('33333333-0000-4000-8000-000000000002', '22222222-0000-4000-8000-000000000024', '2026-08-04', 'norte', '{0,1}'),
  ('33333333-0000-4000-8000-000000000003', '22222222-0000-4000-8000-000000000024', '2026-08-05', 'norte', '{1}'),
  ('33333333-0000-4000-8000-000000000004', '22222222-0000-4000-8000-000000000024', '2026-08-06', 'norte', '{0,1}'),
  ('33333333-0000-4000-8000-000000000005', '22222222-0000-4000-8000-000000000024', '2026-08-07', 'norte', '{1,2}'),
  ('33333333-0000-4000-8000-000000000006', '22222222-0000-4000-8000-000000000024', '2026-08-08', 'sur',   '{0,1,2}'),
  ('33333333-0000-4000-8000-000000000007', '22222222-0000-4000-8000-000000000024', '2026-08-09', 'sur',   '{1,2}');

-- Plan de horneado, con el precio congelado del producto.
insert into public.horneada_stock (horneada_id, producto_id, planificado, precio)
select '22222222-0000-4000-8000-000000000024', p.id, v.planificado, p.precio
from public.productos p
join (values
  ('11111111-0000-4000-8000-000000000001'::uuid, 72),
  ('11111111-0000-4000-8000-000000000002'::uuid, 48),
  ('11111111-0000-4000-8000-000000000003'::uuid, 36),
  ('11111111-0000-4000-8000-000000000004'::uuid, 30),
  ('11111111-0000-4000-8000-000000000005'::uuid, 42)
) as v(id, planificado) on v.id = p.id;

-- El combo entra a la vitrina de la horneada con su precio congelado.
insert into public.horneada_combos (horneada_id, combo_id, precio)
values ('22222222-0000-4000-8000-000000000024',
        '66666666-0000-4000-8000-000000000001', 17500);

-- ── Pedidos de ejemplo (sólo local) ────────────────────────────────────────
insert into public.pedidos
  (id, codigo, horneada_id, horneada_dia_id, zona_id, franja_idx,
   cliente_nombre, cliente_telefono, direccion, subtotal, envio, total, estado)
values
  ('44444444-0000-4000-8000-000000000238', 238,
   '22222222-0000-4000-8000-000000000024', '33333333-0000-4000-8000-000000000002',
   'norte', 1, 'Malena Ríos', '1155550238', 'Alvear 2130, Martínez',
   20400, 0, 20400, 'en_horno'),
  ('44444444-0000-4000-8000-000000000239', 239,
   '22222222-0000-4000-8000-000000000024', '33333333-0000-4000-8000-000000000004',
   'norte', 0, 'Diego Bustos', '1155550239', 'Paraná 480, Acassuso',
   22500, 0, 22500, 'confirmado'),
  ('44444444-0000-4000-8000-000000000240', 240,
   '22222222-0000-4000-8000-000000000024', '33333333-0000-4000-8000-000000000006',
   'sur', 2, 'Carla Mansilla', '1155550240', 'Las Flores 1155, Wilde',
   18800, 1300, 20100, 'en_reparto'),
  ('44444444-0000-4000-8000-000000000237', 237,
   '22222222-0000-4000-8000-000000000024', '33333333-0000-4000-8000-000000000007',
   'sur', 1, 'Familia Ortiz', '1155550237', 'Mitre 3320, Bernal',
   26400, 0, 26400, 'entregado');

-- Cookies sueltas.
insert into public.pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad)
select v.pedido_id, pr.id, pr.nombre, pr.precio, v.cantidad
from (values
  ('44444444-0000-4000-8000-000000000238'::uuid, '11111111-0000-4000-8000-000000000001'::uuid, 6),
  ('44444444-0000-4000-8000-000000000238'::uuid, '11111111-0000-4000-8000-000000000005'::uuid, 3),
  ('44444444-0000-4000-8000-000000000239'::uuid, '11111111-0000-4000-8000-000000000002'::uuid, 2),
  ('44444444-0000-4000-8000-000000000240'::uuid, '11111111-0000-4000-8000-000000000003'::uuid, 4),
  ('44444444-0000-4000-8000-000000000240'::uuid, '11111111-0000-4000-8000-000000000004'::uuid, 4),
  ('44444444-0000-4000-8000-000000000237'::uuid, '11111111-0000-4000-8000-000000000001'::uuid, 12)
) as v(pedido_id, producto_id, cantidad)
join public.productos pr on pr.id = v.producto_id;

-- El pedido #239 lleva además una caja para compartir armada.
insert into public.pedido_combos (id, pedido_id, combo_id, nombre, precio, cantidad)
values ('77777777-0000-4000-8000-000000000239',
        '44444444-0000-4000-8000-000000000239',
        '66666666-0000-4000-8000-000000000001',
        'Caja para compartir x9', 17500, 1);

-- Su contenido: 6 esenciales + 3 caprichosas, a precio 0 porque las paga la caja.
insert into public.pedido_items
  (pedido_id, pedido_combo_id, producto_id, nombre, precio_unitario, cantidad)
select '44444444-0000-4000-8000-000000000239',
       '77777777-0000-4000-8000-000000000239',
       pr.id, pr.nombre, 0, v.cantidad
from (values
  ('11111111-0000-4000-8000-000000000001'::uuid, 4),  -- Chocotón   ┐
  ('11111111-0000-4000-8000-000000000004'::uuid, 2),  -- Avena      ┘ 6 esenciales
  ('11111111-0000-4000-8000-000000000005'::uuid, 2),  -- Red velvet ┐
  ('11111111-0000-4000-8000-000000000003'::uuid, 1)   -- Dulce leche┘ 3 caprichosas
) as v(producto_id, cantidad)
join public.productos pr on pr.id = v.producto_id;

-- La secuencia tiene que seguir después de los códigos cargados a mano.
select setval('public.pedido_codigo_seq', 241, false);
