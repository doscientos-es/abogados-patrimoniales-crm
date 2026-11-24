-- A sent quote must not be validated as a new send when unrelated lead details change.
-- Preserve the existing send guard for any change to the quote itself.
do $$
declare
  definition text;
  old_guard text := $old$if next_quote ->> 'estado' = 'Enviado al cliente' and (previous_quote ->> 'estado' <> 'Validado'$old$;
  new_guard text := $new$if next_quote ->> 'estado' = 'Enviado al cliente' and next_quote is distinct from previous_quote and (previous_quote ->> 'estado' <> 'Validado'$new$;
begin
  select pg_get_functiondef('public.crm_save_opportunity_details(uuid,integer,jsonb,public.crm_opportunity_stage,text,text)'::regprocedure)
    into definition;
  if position(old_guard in definition) = 0 then
    raise exception 'Unexpected crm_save_opportunity_details definition; refusing to weaken quote validation';
  end if;
  execute replace(definition, old_guard, new_guard);
end;
$$;

notify pgrst, 'reload schema';