-- ═══════════════════════════════════════════════════════════════════════════
-- Reservas que vencen solas
--
-- Antes: cualquier pedido no cancelado descontaba stock para siempre. Un pedido
-- que se creaba y nunca se mandaba por WhatsApp se comía las unidades hasta que
-- alguien lo cancelaba a mano.
--
-- Ahora: el pedido 'pendiente_whatsapp' retiene el stock sólo durante
-- `configuracion.reserva_minutos`. Pasado ese rato vuelve a la vitrina solo.
-- Desde 'confirmado' en adelante la reserva es firme y no vence nunca.
--
-- Nada se borra ni se cancela por vencimiento: el pedido sigue ahí y tu hermana
-- lo puede confirmar igual — pero al confirmarlo se revalida el stock, porque
-- mientras estuvo vencido otra clienta pudo llevarse esas unidades.
-- ═══════════════════════════════════════════════════════════════════════════

-- Fila única (el check sobre la PK impide que entre una segunda).
create table public.configuracion (
  id              boolean primary key default true check (id),
  -- 0 = los pedidos sin confirmar no reservan nada.
  -- 10080 = una semana, el techo razonable para una horneada.
  reserva_minutos integer not null default 60
                    check (reserva_minutos between 0 and 10080),
  actualizada_en  timestamptz not null default now()
);

insert into public.configuracion (id) values (true);

alter table public.configuracion enable row level security;

-- `anon` no la toca ni para leer: v_disponibilidad y crear_pedido la leen por
-- adentro, con los permisos del dueño.
create policy "admin total configuracion" on public.configuracion
  for all to authenticated using (true) with check (true);

-- ═══════════════════════════════════════════════════════════════════════════
-- v_disponibilidad: igual que antes, pero ignorando las reservas vencidas.
--
-- Sigue sin security_invoker a propósito (ver migración inicial): el cliente
-- anónimo tiene que ver cuántas unidades quedan sin poder leer pedido_items.
-- Eso es también lo que le deja leer `configuracion` de rebote.
-- ═══════════════════════════════════════════════════════════════════════════
drop view public.v_disponibilidad;

create view public.v_disponibilidad as
select
  hs.horneada_id,
  hs.producto_id,
  hs.planificado,
  hs.precio,
  coalesce(r.reservado, 0)                               as reservado,
  greatest(0, hs.planificado - coalesce(r.reservado, 0)) as disponible
from public.horneada_stock hs
-- Una sola lectura de la config para toda la vista.
cross join (
  select now() - make_interval(mins => reserva_minutos) as corte
  from public.configuracion
) cfg
left join lateral (
  select sum(pi.cantidad)::integer as reservado
  from public.pedido_items pi
  join public.pedidos p on p.id = pi.pedido_id
  where pi.producto_id = hs.producto_id
    and p.horneada_id  = hs.horneada_id
    and p.estado <> 'cancelado'
    and (p.estado <> 'pendiente_whatsapp' or p.creado_en > cfg.corte)
) r on true;

grant select on public.v_disponibilidad to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- v_reservas — cuándo vence cada reserva, para el panel.
--
-- Es la misma cuenta que hace v_disponibilidad, expuesta como dato. Va acá y no
-- en el servidor de Next para que el "¿ya venció?" lo conteste el mismo reloj
-- que decide si el stock volvió a la vitrina.
-- ═══════════════════════════════════════════════════════════════════════════
create view public.v_reservas
with (security_invoker = true) as
select
  p.id          as pedido_id,
  p.horneada_id,
  cfg.reserva_minutos,
  p.creado_en + make_interval(mins => cfg.reserva_minutos)         as vence_en,
  p.creado_en + make_interval(mins => cfg.reserva_minutos) <= now() as vencida
from public.pedidos p
cross join public.configuracion cfg
where p.estado = 'pendiente_whatsapp';

grant select on public.v_reservas to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- confirmar_pedido — el paso 'Sin confirmar' → 'Confirmado'.
--
-- No alcanza con un update: si la reserva venció, esas unidades volvieron a la
-- vitrina y otra clienta pudo comprarlas. Confirmar a ciegas dejaría la horneada
-- sobrevendida. Así que revalida el stock contra todo lo demás que sigue
-- reservado, con el mismo bloqueo pesimista que usa crear_pedido.
-- ═══════════════════════════════════════════════════════════════════════════
create function public.confirmar_pedido(p_pedido_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_pedido public.pedidos%rowtype;
  v_falta  record;
begin
  select * into v_pedido
  from public.pedidos
  where id = p_pedido_id
  for update;

  if not found then
    raise exception 'Ese pedido ya no existe.' using errcode = 'no_data_found';
  end if;

  if v_pedido.estado = 'confirmado' then
    return;  -- doble clic: ya está, no es un error.
  end if;

  if v_pedido.estado <> 'pendiente_whatsapp' then
    raise exception 'El pedido ya avanzó más allá de "Confirmado".'
      using errcode = 'check_violation';
  end if;

  perform 1
  from public.horneada_stock hs
  where hs.horneada_id = v_pedido.horneada_id
    and hs.producto_id in (
      select pi.producto_id from public.pedido_items pi where pi.pedido_id = p_pedido_id
    )
  for update;

  -- Primer producto (si hay alguno) que no entra. `otros` es lo reservado por
  -- TODOS los demás pedidos: si este todavía no venció ya estaba contado, y
  -- excluirlo es justamente lo que hace que la cuenta cierre.
  select pr.nombre     as producto,
         mio.cantidad  as pedidas,
         greatest(0, coalesce(hs.planificado, 0) - coalesce(otros.reservado, 0)) as libres
    into v_falta
  from (
    select pi.producto_id, sum(pi.cantidad)::integer as cantidad
    from public.pedido_items pi
    where pi.pedido_id = p_pedido_id
    group by 1
  ) mio
  join public.productos pr on pr.id = mio.producto_id
  cross join (
    select now() - make_interval(mins => reserva_minutos) as corte
    from public.configuracion
  ) cfg
  -- left join: si el producto se sacó de la horneada no hay fila de stock, y
  -- planificado 0 hace que el pedido no pueda confirmarse. Que es lo correcto.
  left join public.horneada_stock hs
    on hs.horneada_id = v_pedido.horneada_id
   and hs.producto_id = mio.producto_id
  left join lateral (
    select sum(pi.cantidad)::integer as reservado
    from public.pedido_items pi
    join public.pedidos p on p.id = pi.pedido_id
    where pi.producto_id = mio.producto_id
      and p.horneada_id  = v_pedido.horneada_id
      and p.id <> p_pedido_id
      and p.estado <> 'cancelado'
      and (p.estado <> 'pendiente_whatsapp' or p.creado_en > cfg.corte)
  ) otros on true
  where coalesce(hs.planificado, 0) - coalesce(otros.reservado, 0) < mio.cantidad
  limit 1;

  if found then
    raise exception 'La reserva de este pedido venció y se vendieron esas unidades: quedan % de %, y el pedido pide %. Cancelalo o subí lo planificado.',
      v_falta.libres, v_falta.producto, v_falta.pedidas
      using errcode = 'check_violation';
  end if;

  update public.pedidos
  set estado = 'confirmado',
      confirmado_en = now()
  where id = p_pedido_id;
end;
$$;

revoke all on function public.confirmar_pedido(uuid) from public;
grant execute on function public.confirmar_pedido(uuid) to authenticated;
