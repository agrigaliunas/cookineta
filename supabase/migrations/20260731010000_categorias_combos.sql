-- ═══════════════════════════════════════════════════════════════════════════
-- Categorías de cookies y combos para compartir
--
-- Un combo define RANURAS por categoría ("6 Esenciales + 3 Caprichosas") a
-- precio fijo. El cliente elige qué cookie concreta pone en cada ranura, y esas
-- unidades descuentan del stock igual que una cookie suelta.
-- ═══════════════════════════════════════════════════════════════════════════

create table public.categorias (
  id     uuid primary key default gen_random_uuid(),
  nombre text    not null,
  orden  integer not null default 0,
  activa boolean not null default true
);

-- Nullable: un producto puede quedar sin categoría (no entra en combos, pero se
-- vende suelto igual).
alter table public.productos
  add column categoria_id uuid references public.categorias (id) on delete set null;

create index productos_categoria on public.productos (categoria_id);

insert into public.categorias (id, nombre, orden) values
  ('55555555-0000-4000-8000-000000000001', 'Cookies esenciales',   1),
  ('55555555-0000-4000-8000-000000000002', 'Cookies caprichosas',  2);

-- ── Combos ─────────────────────────────────────────────────────────────────
create table public.combos (
  id          uuid primary key default gen_random_uuid(),
  nombre      text    not null,
  descripcion text    not null default '',
  precio      integer not null check (precio >= 0),
  foto_url    text,
  activo      boolean not null default true,
  creado_en   timestamptz not null default now()
);

-- Cada fila es una ranura: "3 unidades de Caprichosas".
create table public.combo_items (
  id           uuid primary key default gen_random_uuid(),
  combo_id     uuid not null references public.combos (id) on delete cascade,
  categoria_id uuid not null references public.categorias (id) on delete restrict,
  cantidad     integer not null check (cantidad > 0),
  unique (combo_id, categoria_id)
);

create index combo_items_combo on public.combo_items (combo_id);

-- Los combos entran a la vitrina de una horneada con su precio congelado, igual
-- que los productos.
create table public.horneada_combos (
  horneada_id uuid    not null references public.horneadas (id) on delete cascade,
  combo_id    uuid    not null references public.combos (id) on delete cascade,
  precio      integer not null check (precio >= 0),
  primary key (horneada_id, combo_id)
);

-- ── Combos dentro de un pedido ─────────────────────────────────────────────
create table public.pedido_combos (
  id        uuid primary key default gen_random_uuid(),
  pedido_id uuid not null references public.pedidos (id) on delete cascade,
  combo_id  uuid not null references public.combos (id),
  nombre    text not null,                       -- snapshot
  precio    integer not null check (precio >= 0),-- snapshot
  cantidad  integer not null check (cantidad > 0)
);

create index pedido_combos_pedido on public.pedido_combos (pedido_id);

-- Las cookies elegidas dentro de un combo se guardan como pedido_items con
-- precio_unitario 0 (las paga el combo) y apuntando a la caja. Así el descuento
-- de stock sigue saliendo de un solo lugar y v_disponibilidad no cambia.
alter table public.pedido_items
  add column pedido_combo_id uuid references public.pedido_combos (id) on delete cascade;

create index pedido_items_combo on public.pedido_items (pedido_combo_id);

-- ═══════════════════════════════════════════════════════════════════════════
-- v_ventas: ahora suma las cajas además de las cookies sueltas.
--
-- Las cookies de adentro de un combo aparecen con ingreso 0 (para que las
-- unidades se cuenten sin duplicar la plata) y la caja aporta su precio como
-- una línea aparte.
-- ═══════════════════════════════════════════════════════════════════════════
drop view public.v_ventas;

create view public.v_ventas
with (security_invoker = true) as
select
  p.horneada_id,
  p.id          as pedido_id,
  p.zona_id,
  p.horneada_dia_id,
  hd.fecha,
  p.estado,
  'producto'::text as tipo,
  pi.producto_id   as item_id,
  pi.nombre        as item_nombre,
  pi.precio_unitario,
  pi.cantidad,
  (pi.precio_unitario * pi.cantidad) as ingreso
from public.pedidos p
join public.pedido_items pi  on pi.pedido_id = p.id
join public.horneada_dias hd on hd.id = p.horneada_dia_id
where p.estado <> 'cancelado'

union all

select
  p.horneada_id,
  p.id,
  p.zona_id,
  p.horneada_dia_id,
  hd.fecha,
  p.estado,
  'combo'::text,
  pc.combo_id,
  pc.nombre,
  pc.precio,
  pc.cantidad,
  (pc.precio * pc.cantidad)
from public.pedidos p
join public.pedido_combos pc on pc.pedido_id = p.id
join public.horneada_dias hd on hd.id = p.horneada_dia_id
where p.estado <> 'cancelado';

grant select on public.v_ventas to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- crear_pedido, ahora con combos.
--
-- payload: {
--   horneada_dia_id, franja_idx, cliente_nombre, cliente_telefono,
--   direccion, nota,
--   items:  [{ producto_id, cantidad }],
--   combos: [{ combo_id, cantidad, elecciones: [{ producto_id, cantidad }] }]
-- }
--
-- Clave: el stock se valida sobre la DEMANDA UNIFICADA (sueltas + elegidas
-- dentro de combos). Si alguien pide 2 Chocotón sueltas y una caja con 4
-- Chocotón, se controla contra 6, no contra 2 y 4 por separado.
-- ═══════════════════════════════════════════════════════════════════════════
create or replace function public.crear_pedido(payload jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_dia            public.horneada_dias%rowtype;
  v_horneada       public.horneadas%rowtype;
  v_zona           public.zonas%rowtype;
  v_combo_id       uuid;
  v_combo_nombre   text;
  v_item           jsonb;
  v_combo          jsonb;
  v_slot           record;
  v_producto_id    uuid;
  v_cantidad       integer;
  v_precio         integer;
  v_nombre         text;
  v_disponible     integer;
  v_subtotal       integer := 0;
  v_envio          integer;
  v_pedido_id      uuid;
  v_pedido_combo   uuid;
  v_codigo         integer;
  v_franja_idx     integer;
  v_nombre_cliente text;
  v_telefono       text;
  v_direccion      text;
  v_combo_precio   integer;
  v_combo_cant     integer;
  v_elegidas       integer;
  v_items          jsonb := coalesce(payload -> 'items',  '[]'::jsonb);
  v_combos         jsonb := coalesce(payload -> 'combos', '[]'::jsonb);
  v_demanda        jsonb := '[]'::jsonb;
  v_lineas         jsonb := '[]'::jsonb;
  v_detalle_combos jsonb := '[]'::jsonb;
begin
  v_nombre_cliente := btrim(coalesce(payload ->> 'cliente_nombre', ''));
  v_telefono       := btrim(coalesce(payload ->> 'cliente_telefono', ''));
  v_direccion      := btrim(coalesce(payload ->> 'direccion', ''));

  if v_nombre_cliente = '' or v_telefono = '' or v_direccion = '' then
    raise exception 'Faltan datos de contacto: nombre, WhatsApp y dirección son obligatorios.'
      using errcode = 'check_violation';
  end if;

  if jsonb_array_length(v_items) = 0 and jsonb_array_length(v_combos) = 0 then
    raise exception 'El pedido no tiene productos.' using errcode = 'check_violation';
  end if;

  select * into v_dia
  from public.horneada_dias
  where id = (payload ->> 'horneada_dia_id')::uuid;

  if not found then
    raise exception 'El día de entrega elegido ya no existe.' using errcode = 'no_data_found';
  end if;

  if v_dia.zona_id is null then
    raise exception 'Ese día quedó sin reparto asignado. Elegí otro.'
      using errcode = 'check_violation';
  end if;

  select * into v_horneada from public.horneadas where id = v_dia.horneada_id;

  if v_horneada.estado <> 'abierta' then
    raise exception 'La horneada ya está cerrada. Escribinos por WhatsApp.'
      using errcode = 'check_violation';
  end if;

  select * into v_zona from public.zonas where id = v_dia.zona_id;

  v_franja_idx := (payload ->> 'franja_idx')::integer;
  if v_franja_idx is null or not (v_franja_idx = any (v_dia.franjas)) then
    raise exception 'La franja horaria elegida no está disponible ese día.'
      using errcode = 'check_violation';
  end if;

  -- Demanda unificada: sueltas + lo elegido dentro de cada combo.
  v_demanda := v_items;
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_demanda := v_demanda || coalesce(v_combo -> 'elecciones', '[]'::jsonb);
  end loop;

  -- Bloqueo pesimista sobre todo lo que se va a tocar.
  perform 1
  from public.horneada_stock hs
  where hs.horneada_id = v_horneada.id
    and hs.producto_id in (
      select (value ->> 'producto_id')::uuid from jsonb_array_elements(v_demanda)
    )
  for update;

  -- ── validación de combos ────────────────────────────────────────────────
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_combo_cant := coalesce((v_combo ->> 'cantidad')::integer, 1);

    if v_combo_cant <= 0 then
      raise exception 'Cantidad de combo inválida.' using errcode = 'check_violation';
    end if;

    select c.id, c.nombre, hc.precio
      into v_combo_id, v_combo_nombre, v_combo_precio
    from public.combos c
    join public.horneada_combos hc
      on hc.combo_id = c.id and hc.horneada_id = v_horneada.id
    where c.id = (v_combo ->> 'combo_id')::uuid and c.activo;

    if not found then
      raise exception 'Ese combo ya no está disponible en esta horneada.'
        using errcode = 'no_data_found';
    end if;

    -- Cada ranura tiene que quedar exacta: ni de menos ni de más.
    for v_slot in
      select ci.categoria_id, ci.cantidad, cat.nombre as categoria
      from public.combo_items ci
      join public.categorias cat on cat.id = ci.categoria_id
      where ci.combo_id = v_combo_id
    loop
      select coalesce(sum((e ->> 'cantidad')::integer), 0) into v_elegidas
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      join public.productos pr on pr.id = (e ->> 'producto_id')::uuid
      where pr.categoria_id = v_slot.categoria_id;

      if v_elegidas <> v_slot.cantidad * v_combo_cant then
        raise exception '% necesita % de %, y elegiste %.',
          v_combo_nombre, v_slot.cantidad * v_combo_cant, v_slot.categoria, v_elegidas
          using errcode = 'check_violation';
      end if;
    end loop;

    -- Y nada de colar cookies de una categoría que el combo no incluye.
    if exists (
      select 1
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      join public.productos pr on pr.id = (e ->> 'producto_id')::uuid
      where pr.categoria_id is null
         or pr.categoria_id not in (
           select ci.categoria_id from public.combo_items ci where ci.combo_id = v_combo_id
         )
    ) then
      raise exception 'Elegiste una cookie que no entra en %.', v_combo_nombre
        using errcode = 'check_violation';
    end if;

    v_subtotal := v_subtotal + v_combo_precio * v_combo_cant;
  end loop;

  -- ── stock, sobre la demanda unificada y agrupada por producto ───────────
  for v_item in
    select jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad)
    from (
      select (value ->> 'producto_id')::uuid      as producto_id,
             sum((value ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(v_demanda)
      group by 1
    ) t
  loop
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad    := (v_item ->> 'cantidad')::integer;

    if v_producto_id is null then
      raise exception 'Producto inválido.' using errcode = 'check_violation';
    end if;

    if v_cantidad is null or v_cantidad <= 0 then
      raise exception 'Cantidad inválida.' using errcode = 'check_violation';
    end if;

    select d.disponible, pr.nombre into v_disponible, v_nombre
    from public.v_disponibilidad d
    join public.productos pr on pr.id = d.producto_id
    where d.horneada_id = v_horneada.id
      and d.producto_id = v_producto_id;

    if not found then
      raise exception 'Uno de los productos ya no está en esta horneada.'
        using errcode = 'no_data_found';
    end if;

    if v_disponible < v_cantidad then
      raise exception 'Ya no quedan % unidades de %. Quedan %.',
        v_cantidad, v_nombre, v_disponible
        using errcode = 'check_violation';
    end if;
  end loop;

  -- ── precios de las cookies sueltas ──────────────────────────────────────
  for v_item in
    select jsonb_build_object('producto_id', t.producto_id, 'cantidad', t.cantidad)
    from (
      select (value ->> 'producto_id')::uuid      as producto_id,
             sum((value ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(v_items)
      group by 1
    ) t
  loop
    v_producto_id := (v_item ->> 'producto_id')::uuid;
    v_cantidad    := (v_item ->> 'cantidad')::integer;

    -- El precio sale de horneada_stock, jamás del payload.
    select hs.precio, pr.nombre into v_precio, v_nombre
    from public.horneada_stock hs
    join public.productos pr on pr.id = hs.producto_id
    where hs.horneada_id = v_horneada.id and hs.producto_id = v_producto_id;

    v_subtotal := v_subtotal + v_precio * v_cantidad;
    v_lineas := v_lineas || jsonb_build_object(
      'producto_id', v_producto_id,
      'nombre',      v_nombre,
      'precio',      v_precio,
      'cantidad',    v_cantidad
    );
  end loop;

  v_envio := case
    when v_subtotal >= v_horneada.envio_gratis_desde then 0
    else v_zona.envio
  end;

  insert into public.pedidos (
    horneada_id, horneada_dia_id, zona_id, franja_idx,
    cliente_nombre, cliente_telefono, direccion, nota,
    subtotal, envio, total
  ) values (
    v_horneada.id, v_dia.id, v_zona.id, v_franja_idx,
    v_nombre_cliente, v_telefono, v_direccion,
    btrim(coalesce(payload ->> 'nota', '')),
    v_subtotal, v_envio, v_subtotal + v_envio
  )
  returning id, codigo into v_pedido_id, v_codigo;

  insert into public.pedido_items (pedido_id, producto_id, nombre, precio_unitario, cantidad)
  select v_pedido_id,
         (l ->> 'producto_id')::uuid,
         l ->> 'nombre',
         (l ->> 'precio')::integer,
         (l ->> 'cantidad')::integer
  from jsonb_array_elements(v_lineas) l;

  -- ── las cajas, con su contenido ─────────────────────────────────────────
  for v_combo in select * from jsonb_array_elements(v_combos) loop
    v_combo_cant := coalesce((v_combo ->> 'cantidad')::integer, 1);

    select c.id, c.nombre, hc.precio
      into v_combo_id, v_combo_nombre, v_combo_precio
    from public.combos c
    join public.horneada_combos hc
      on hc.combo_id = c.id and hc.horneada_id = v_horneada.id
    where c.id = (v_combo ->> 'combo_id')::uuid;

    insert into public.pedido_combos (pedido_id, combo_id, nombre, precio, cantidad)
    values (v_pedido_id, v_combo_id, v_combo_nombre, v_combo_precio, v_combo_cant)
    returning id into v_pedido_combo;

    -- precio_unitario 0: la caja ya las pagó.
    insert into public.pedido_items
      (pedido_id, pedido_combo_id, producto_id, nombre, precio_unitario, cantidad)
    select v_pedido_id, v_pedido_combo, pr.id, pr.nombre, 0, t.cantidad
    from (
      select (e ->> 'producto_id')::uuid      as producto_id,
             sum((e ->> 'cantidad')::integer) as cantidad
      from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
      group by 1
    ) t
    join public.productos pr on pr.id = t.producto_id;

    v_detalle_combos := v_detalle_combos || jsonb_build_object(
      'nombre',   v_combo_nombre,
      'cantidad', v_combo_cant,
      'total',    v_combo_precio * v_combo_cant,
      'detalle',  (
        select coalesce(string_agg(pr.nombre || ' ×' || t.cantidad, ', ' order by pr.nombre), '')
        from (
          select (e ->> 'producto_id')::uuid      as producto_id,
                 sum((e ->> 'cantidad')::integer) as cantidad
          from jsonb_array_elements(coalesce(v_combo -> 'elecciones', '[]'::jsonb)) e
          group by 1
        ) t
        join public.productos pr on pr.id = t.producto_id
      )
    );
  end loop;

  return jsonb_build_object(
    'pedido_id', v_pedido_id,
    'codigo',    v_codigo,
    'subtotal',  v_subtotal,
    'envio',     v_envio,
    'total',     v_subtotal + v_envio,
    'zona',      v_zona.nombre,
    'hub',       v_zona.hub,
    'fecha',     v_dia.fecha,
    'combos',    v_detalle_combos,
    'lineas',    (
      select coalesce(jsonb_agg(jsonb_build_object(
        'nombre',   l ->> 'nombre',
        'cantidad', (l ->> 'cantidad')::integer,
        'total',    (l ->> 'precio')::integer * (l ->> 'cantidad')::integer
      )), '[]'::jsonb)
      from jsonb_array_elements(v_lineas) l
    )
  );
end;
$$;

revoke all on function public.crear_pedido(jsonb) from public;
grant execute on function public.crear_pedido(jsonb) to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- RLS de las tablas nuevas
-- ═══════════════════════════════════════════════════════════════════════════
alter table public.categorias      enable row level security;
alter table public.combos          enable row level security;
alter table public.combo_items     enable row level security;
alter table public.horneada_combos enable row level security;
alter table public.pedido_combos   enable row level security;

create policy "categorias visibles" on public.categorias
  for select to anon, authenticated using (activa);

create policy "combos visibles" on public.combos
  for select to anon, authenticated using (activo);

create policy "ranuras visibles" on public.combo_items
  for select to anon, authenticated using (true);

create policy "combos de horneada abierta visibles" on public.horneada_combos
  for select to anon, authenticated
  using (exists (
    select 1 from public.horneadas h
    where h.id = horneada_combos.horneada_id and h.estado = 'abierta'
  ));

create policy "admin total categorias" on public.categorias
  for all to authenticated using (true) with check (true);
create policy "admin total combos" on public.combos
  for all to authenticated using (true) with check (true);
create policy "admin total combo_items" on public.combo_items
  for all to authenticated using (true) with check (true);
create policy "admin total horneada_combos" on public.horneada_combos
  for all to authenticated using (true) with check (true);
create policy "admin total pedido_combos" on public.pedido_combos
  for all to authenticated using (true) with check (true);

-- Sin policy para `anon` sobre pedido_combos: como pedidos, queda cerrado.
