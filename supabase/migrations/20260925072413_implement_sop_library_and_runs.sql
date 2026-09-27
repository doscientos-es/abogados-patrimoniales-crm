-- Procedimientos del despacho: biblioteca versionada, ejecuciones y eventos auditables.
create table public.crm_procedure_runs (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  procedure_id uuid not null,
  procedure_version integer not null check (procedure_version > 0),
  version integer not null default 1 check (version > 0),
  procedure_snapshot jsonb not null check (jsonb_typeof(procedure_snapshot) = 'object'),
  case_id uuid,
  opportunity_id uuid,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed', 'cancelled')),
  checklist jsonb not null default '[]'::jsonb check (jsonb_typeof(checklist) = 'array'),
  notes text not null default '' check (char_length(notes) <= 10000),
  started_by uuid not null references public.crm_profiles(id) on delete restrict,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (firm_id, id),
  foreign key (firm_id, procedure_id) references public.crm_procedures(firm_id, id) on delete restrict,
  foreign key (firm_id, case_id) references public.crm_cases(firm_id, id) on delete restrict,
  foreign key (firm_id, opportunity_id) references public.crm_opportunities(firm_id, id) on delete restrict,
  check (case_id is null or opportunity_id is null),
  check ((status in ('completed', 'cancelled')) = (completed_at is not null))
);

create table public.crm_procedure_events (
  id uuid primary key default gen_random_uuid(),
  firm_id uuid not null references public.crm_firms(id) on delete restrict,
  procedure_id uuid not null,
  run_id uuid,
  actor_id uuid references public.crm_profiles(id) on delete set null,
  event_type text not null check (event_type in ('created', 'updated', 'status_changed', 'run_started', 'run_updated', 'run_completed', 'run_cancelled')),
  payload jsonb not null default '{}'::jsonb check (jsonb_typeof(payload) = 'object'),
  created_at timestamptz not null default now(),
  foreign key (firm_id, procedure_id) references public.crm_procedures(firm_id, id) on delete restrict,
  foreign key (firm_id, run_id) references public.crm_procedure_runs(firm_id, id) on delete restrict
);

create index crm_procedure_runs_firm_recent_idx on public.crm_procedure_runs (firm_id, created_at desc);
create index crm_procedure_runs_case_idx on public.crm_procedure_runs (case_id, created_at desc) where case_id is not null;
create index crm_procedure_runs_opportunity_idx on public.crm_procedure_runs (opportunity_id, created_at desc) where opportunity_id is not null;
create index crm_procedure_events_procedure_idx on public.crm_procedure_events (procedure_id, created_at desc);
create index crm_procedure_events_run_idx on public.crm_procedure_events (run_id, created_at desc) where run_id is not null;

create trigger crm_procedure_runs_touch before update on public.crm_procedure_runs
  for each row execute function public.crm_touch_entity();
alter table public.crm_procedure_runs enable row level security;
alter table public.crm_procedure_events enable row level security;

create policy crm_procedure_runs_read on public.crm_procedure_runs
  for select to authenticated using (public.crm_is_firm_member(firm_id));
create policy crm_procedure_events_read on public.crm_procedure_events
  for select to authenticated using (public.crm_is_firm_member(firm_id));
revoke all on public.crm_procedure_runs, public.crm_procedure_events from anon, authenticated;
grant select on public.crm_procedure_runs, public.crm_procedure_events to authenticated;

create or replace function public.crm_save_procedure(
  target_firm_id uuid,
  target_procedure_id uuid,
  target_expected_version integer,
  new_slug text,
  new_title text,
  new_phase text,
  new_description text,
  new_sections jsonb,
  new_status text
)
returns public.crm_procedures
language plpgsql
security definer
set search_path = public
as $$
declare
  saved public.crm_procedures;
  previous_status text;
begin
  if auth.uid() is null or not public.crm_has_firm_role(target_firm_id, array['owner', 'admin', 'lawyer']::public.crm_member_role[]) then
    raise exception 'Forbidden';
  end if;
  if new_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' or char_length(new_slug) > 120
    or char_length(trim(new_title)) not between 1 and 240
    or char_length(trim(new_phase)) not between 1 and 120
    or char_length(coalesce(new_description, '')) > 2000
    or jsonb_typeof(new_sections) <> 'array' or octet_length(new_sections::text) > 100000
    or new_status not in ('draft', 'active', 'archived') then
    raise exception 'Invalid procedure data';
  end if;
  if new_status = 'active'
    and not public.crm_has_firm_role(target_firm_id, array['owner', 'admin']::public.crm_member_role[]) then
    raise exception 'Only firm owners and admins can activate a procedure';
  end if;
  if target_procedure_id is null then
    insert into public.crm_procedures (firm_id, slug, title, phase, description, sections, status, created_by, updated_by)
    values (target_firm_id, new_slug, trim(new_title), trim(new_phase), coalesce(new_description, ''), new_sections, new_status, auth.uid(), auth.uid())
    returning * into saved;
    insert into public.crm_procedure_events (firm_id, procedure_id, actor_id, event_type, payload)
    values (target_firm_id, saved.id, auth.uid(), 'created', jsonb_build_object('version', saved.version, 'status', saved.status, 'snapshot', to_jsonb(saved)));
  else
    select status into previous_status from public.crm_procedures
      where id = target_procedure_id and firm_id = target_firm_id and version = target_expected_version for update;
    if not found then raise exception 'Procedure changed or not found' using errcode = '40001'; end if;
    update public.crm_procedures set slug = new_slug, title = trim(new_title), phase = trim(new_phase),
      description = coalesce(new_description, ''), sections = new_sections, status = new_status,
      version = version + 1, updated_by = auth.uid()
      where id = target_procedure_id and firm_id = target_firm_id returning * into saved;
    insert into public.crm_procedure_events (firm_id, procedure_id, actor_id, event_type, payload)
    values (target_firm_id, saved.id, auth.uid(), case when previous_status <> saved.status then 'status_changed' else 'updated' end,
      jsonb_build_object('version', saved.version, 'status', saved.status, 'snapshot', to_jsonb(saved)));
  end if;
  return saved;
end;
$$;

create or replace function public.crm_start_procedure_run(
  target_firm_id uuid,
  target_procedure_id uuid,
  target_case_id uuid,
  target_opportunity_id uuid
)
returns public.crm_procedure_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  procedure public.crm_procedures;
  created_run public.crm_procedure_runs;
  run_checklist jsonb;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  if target_case_id is not null and target_opportunity_id is not null then raise exception 'Choose one procedure context'; end if;
  select * into procedure from public.crm_procedures where id = target_procedure_id and firm_id = target_firm_id and status = 'active';
  if not found then raise exception 'Only active procedures can be started'; end if;
  if target_case_id is not null and not exists (select 1 from public.crm_cases where id = target_case_id and firm_id = target_firm_id) then raise exception 'Case not found'; end if;
  if target_opportunity_id is not null and not exists (select 1 from public.crm_opportunities where id = target_opportunity_id and firm_id = target_firm_id) then raise exception 'Lead not found'; end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', section ->> 'id', 'title', section ->> 'title', 'description', coalesce(section ->> 'description', ''), 'required', coalesce((section ->> 'required')::boolean, true), 'completed', false, 'note', '') order by step_order),
    '[]'::jsonb) into run_checklist
    from public.crm_procedures p
    cross join lateral jsonb_array_elements(p.sections) with ordinality as steps(section, step_order)
    where p.id = procedure.id and section ->> 'type' = 'step';
  insert into public.crm_procedure_runs (firm_id, procedure_id, procedure_version, procedure_snapshot, case_id, opportunity_id, checklist, started_by)
  values (target_firm_id, procedure.id, procedure.version, to_jsonb(procedure), target_case_id, target_opportunity_id, run_checklist, auth.uid()) returning * into created_run;
  insert into public.crm_procedure_events (firm_id, procedure_id, run_id, actor_id, event_type, payload)
  values (target_firm_id, procedure.id, created_run.id, auth.uid(), 'run_started', jsonb_build_object('procedure_version', procedure.version, 'case_id', target_case_id, 'opportunity_id', target_opportunity_id));
  return created_run;
end;
$$;

create or replace function public.crm_update_procedure_run(
  target_firm_id uuid,
  target_run_id uuid,
  target_expected_version integer,
  new_checklist jsonb,
  new_notes text,
  new_status text
)
returns public.crm_procedure_runs
language plpgsql
security definer
set search_path = public
as $$
declare
  current_run public.crm_procedure_runs;
  saved_run public.crm_procedure_runs;
  normalized_checklist jsonb;
begin
  if auth.uid() is null or not public.crm_is_firm_member(target_firm_id) then raise exception 'Forbidden'; end if;
  select * into current_run from public.crm_procedure_runs where id = target_run_id and firm_id = target_firm_id for update;
  if not found or current_run.version <> target_expected_version then raise exception 'Procedure run changed; reload before saving' using errcode = '40001'; end if;
  if current_run.status <> 'in_progress' then raise exception 'This procedure run is already closed'; end if;
  if jsonb_typeof(new_checklist) <> 'array' or octet_length(new_checklist::text) > 100000 or char_length(coalesce(new_notes, '')) > 10000
    or new_status not in ('in_progress', 'completed', 'cancelled') then raise exception 'Invalid procedure run data'; end if;
  if exists (
    select 1 from jsonb_array_elements(new_checklist) as checklist_items(item)
    where jsonb_typeof(item) <> 'object' or jsonb_typeof(item -> 'completed') <> 'boolean'
      or jsonb_typeof(item -> 'note') not in ('string', 'null') or char_length(coalesce(item ->> 'note', '')) > 2000
      or not exists (select 1 from jsonb_array_elements(coalesce(current_run.checklist, '[]'::jsonb)) as original_items(original_item) where original_item ->> 'id' = item ->> 'id')
  ) then raise exception 'Checklist steps may only update completion and notes'; end if;
  if exists (select 1 from jsonb_array_elements(new_checklist) as checklist_items(item) group by item ->> 'id' having count(*) > 1) then
    raise exception 'Procedure checklist steps must be unique';
  end if;
  if exists (
    select 1 from jsonb_array_elements(coalesce(current_run.checklist, '[]'::jsonb)) as original_items(original_item)
    where not exists (select 1 from jsonb_array_elements(new_checklist) as checklist_items(item) where item ->> 'id' = original_item ->> 'id')
  ) then raise exception 'All procedure steps must remain in the checklist'; end if;
  select coalesce(jsonb_agg(jsonb_build_object(
    'id', original_item ->> 'id',
    'title', original_item ->> 'title',
    'description', coalesce(original_item ->> 'description', ''),
    'required', coalesce((original_item ->> 'required')::boolean, true),
    'completed', (updated_item ->> 'completed')::boolean,
    'note', coalesce(updated_item ->> 'note', '')
  ) order by ordinal), '[]'::jsonb) into normalized_checklist
  from jsonb_array_elements(current_run.checklist) with ordinality as original_steps(original_item, ordinal)
  join jsonb_array_elements(new_checklist) as updated_steps(updated_item)
    on updated_item ->> 'id' = original_item ->> 'id';
  if new_status = 'completed' and exists (select 1 from jsonb_array_elements(normalized_checklist) as checklist_items(item) where coalesce((item ->> 'required')::boolean, true) and not coalesce((item ->> 'completed')::boolean, false)) then
    raise exception 'Complete all required steps before closing this run';
  end if;
  update public.crm_procedure_runs set checklist = normalized_checklist, notes = coalesce(new_notes, ''), status = new_status, version = version + 1,
    completed_at = case when new_status in ('completed', 'cancelled') then now() else null end
    where id = current_run.id returning * into saved_run;
  insert into public.crm_procedure_events (firm_id, procedure_id, run_id, actor_id, event_type, payload)
  values (target_firm_id, saved_run.procedure_id, saved_run.id, auth.uid(),
    case saved_run.status when 'completed' then 'run_completed' when 'cancelled' then 'run_cancelled' else 'run_updated' end,
    jsonb_build_object('status', saved_run.status, 'checklist', saved_run.checklist, 'notes', saved_run.notes));
  return saved_run;
end;
$$;

revoke all on function public.crm_save_procedure(uuid, uuid, integer, text, text, text, text, jsonb, text) from public, anon;
revoke all on function public.crm_start_procedure_run(uuid, uuid, uuid, uuid) from public, anon;
revoke all on function public.crm_update_procedure_run(uuid, uuid, integer, jsonb, text, text) from public, anon;
grant execute on function public.crm_save_procedure(uuid, uuid, integer, text, text, text, text, jsonb, text) to authenticated;
grant execute on function public.crm_start_procedure_run(uuid, uuid, uuid, uuid) to authenticated;
grant execute on function public.crm_update_procedure_run(uuid, uuid, integer, jsonb, text, text) to authenticated;

-- Plantillas operativas iniciales en borrador: cada despacho debe revisarlas antes de activarlas.
insert into public.crm_procedures (firm_id, slug, title, phase, description, sections, status)
select f.id, seed.slug, seed.title, seed.phase, seed.description, seed.sections, 'draft'
from public.crm_firms f
cross join (values
  ('primera-cita','Primera cita','Lead','Guion, checklist y registro de la primera reunión con el potencial cliente.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Preparar y registrar la primera conversación con el potencial cliente."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Persona responsable del Lead y asistentes a la reunión."},{"type":"step","id":"preparar-reunion","title":"Preparar la reunión","description":"Revisar el origen, la necesidad indicada y la información disponible.","required":true},{"type":"step","id":"celebrar-reunion","title":"Celebrar y registrar la reunión","description":"Registrar asistentes, necesidades, alcance y siguientes pasos acordados.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade aquí la ficha o guion aprobado por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Confirmar que se registraron los acuerdos y responsables."},{"type":"metrics","title":"Indicadores y registro","content":"Fecha, participantes y siguiente acción."}]'::jsonb),
  ('acta-de-encargo','Acta de encargo','Onboarding','Elaboración, revisión y firma del acta de encargo profesional.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Preparar y formalizar el encargo profesional aceptado."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Responsable del asunto y personas autorizadas para revisar el encargo."},{"type":"step","id":"confirmar-alcance","title":"Confirmar alcance y honorarios","description":"Contrastar el alcance, honorarios y condiciones con la aceptación registrada.","required":true},{"type":"step","id":"preparar-acta","title":"Preparar el acta","description":"Completar los datos del cliente, asunto y alcance acordado.","required":true},{"type":"step","id":"firmar-acta","title":"Obtener y archivar la firma","description":"Registrar la versión firmada y vincularla al expediente.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade la plantilla vigente del acta aprobada por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Verificar la versión, las partes y la correspondencia con la aceptación."},{"type":"metrics","title":"Indicadores y registro","content":"Fecha de preparación, envío y firma."}]'::jsonb),
  ('designacion-del-trabajo','Designación del trabajo','Case Work','Asignación de responsable, equipo y reparto de tareas del expediente.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Dejar claro el equipo responsable y el reparto inicial del trabajo."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Responsable principal y profesionales colaboradores en el asunto."},{"type":"step","id":"designar-responsable","title":"Designar responsable principal","description":"Confirmar quién coordina el expediente.","required":true},{"type":"step","id":"asignar-equipo","title":"Asignar equipo y tareas","description":"Registrar participantes y distribuir acciones iniciales.","required":true},{"type":"step","id":"comunicar-designacion","title":"Comunicar la designación","description":"Alinear al equipo sobre el estado y próximos hitos.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade criterios y plantillas internas del despacho."},{"type":"quality","title":"Controles de calidad","content":"Comprobar que las tareas tienen responsables y fechas cuando corresponda."},{"type":"metrics","title":"Indicadores y registro","content":"Responsable, equipo y fecha de designación."}]'::jsonb),
  ('reunion-de-traspaso','Reunión de traspaso','Case Work','Traspaso del asunto del captador al equipo ejecutor.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Transferir el contexto del asunto sin perder acuerdos ni compromisos."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Persona que entrega el asunto, responsable del expediente y equipo entrante."},{"type":"step","id":"preparar-traspaso","title":"Preparar información del asunto","description":"Revisar encargo, documentación, comunicaciones y fechas conocidas.","required":true},{"type":"step","id":"celebrar-traspaso","title":"Celebrar la reunión de traspaso","description":"Confirmar estrategia, riesgos, pendientes y próximos hitos.","required":true},{"type":"step","id":"registrar-acuerdos","title":"Registrar acuerdos y tareas","description":"Dejar responsables y fechas para los siguientes pasos.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade la agenda o acta aprobada por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Verificar recepción del contexto y tareas asignadas."},{"type":"metrics","title":"Indicadores y registro","content":"Participantes, fecha y acciones resultantes."}]'::jsonb),
  ('acta-de-cierre','Acta de cierre','Offboarding','Documento de entrega, conformidad y cierre formal del encargo.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Cerrar ordenadamente la prestación y registrar la entrega final."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Responsable del asunto y persona cliente o autorizada."},{"type":"step","id":"revisar-pendientes","title":"Revisar pendientes y estado","description":"Identificar actuaciones pendientes, plazos y entregables finales.","required":true},{"type":"step","id":"entregar-documentacion","title":"Entregar documentación final","description":"Registrar qué documentación se entrega y el canal acordado.","required":true},{"type":"step","id":"registrar-cierre","title":"Registrar el cierre","description":"Documentar la fecha y confirmación de la entrega.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade el acta aprobada por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Confirmar la entrega y registrar elementos pendientes."},{"type":"metrics","title":"Indicadores y registro","content":"Fecha, entregables y confirmación."}]'::jsonb),
  ('adenda-del-encargo','Adenda del encargo','Offboarding','Ampliaciones de alcance y honorarios sobre el encargo original.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Dejar documentadas las modificaciones del encargo acordadas por las partes."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Responsable del asunto y personas que deben revisar o firmar la adenda."},{"type":"step","id":"describir-cambio","title":"Describir el cambio acordado","description":"Registrar motivo, alcance y efecto sobre honorarios o calendario.","required":true},{"type":"step","id":"preparar-adenda","title":"Preparar y revisar la adenda","description":"Preparar el documento para revisión conforme al proceso interno.","required":true},{"type":"step","id":"archivar-adenda","title":"Formalizar y archivar","description":"Registrar la aceptación y guardar la versión formalizada en el expediente.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade la plantilla aprobada por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Comprobar que el cambio se relaciona con el encargo vigente."},{"type":"metrics","title":"Indicadores y registro","content":"Fecha, versión y alcance modificado."}]'::jsonb),
  ('archivo','Archivo','Offboarding','Criterios de archivo, conservación y custodia del expediente.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Preparar el cierre operativo del expediente y documentar su custodia."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Responsable del expediente y persona autorizada para validar el archivo."},{"type":"step","id":"verificar-cierre","title":"Verificar el cierre operativo","description":"Comprobar que actuaciones y tareas están cerradas o documentadas.","required":true},{"type":"step","id":"ordenar-expediente","title":"Ordenar documentación y comunicaciones","description":"Confirmar que los documentos finales están correctamente vinculados.","required":true},{"type":"step","id":"registrar-archivo","title":"Registrar archivo y custodia","description":"Anotar fecha y ubicación lógica de custodia.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade la lista de control vigente del despacho."},{"type":"quality","title":"Controles de calidad","content":"Comprobar integridad y permisos de acceso según política interna."},{"type":"metrics","title":"Indicadores y registro","content":"Fecha y responsable del archivo."}]'::jsonb),
  ('informacion-periodica-ejecuciones','Información periódica en ejecuciones','Aftercare','Cadencia y contenido de los informes al cliente durante la ejecución.', '[{"type":"objective","title":"Objetivo del procedimiento","content":"Mantener un registro claro de actualizaciones periódicas sobre la ejecución."},{"type":"responsibilities","title":"Responsables e intervinientes","content":"Profesional responsable de la ejecución y destinatarios acordados."},{"type":"step","id":"revisar-movimientos","title":"Revisar movimientos desde la última actualización","description":"Revisar hitos y comunicaciones recientes en el expediente.","required":true},{"type":"step","id":"preparar-actualizacion","title":"Preparar actualización comprensible","description":"Resumir el estado, cambios relevantes y siguientes pasos previstos.","required":true},{"type":"step","id":"registrar-envio","title":"Registrar actualización enviada","description":"Anotar destinatario, fecha y canal utilizado.","required":true},{"type":"templates","title":"Plantillas y documentos asociados","content":"Añade el modelo de actualización aprobado por el despacho."},{"type":"quality","title":"Controles de calidad","content":"Verificar que el contenido corresponde al estado vigente del expediente."},{"type":"metrics","title":"Indicadores y registro","content":"Cadencia, fecha de actualización y canal."}]'::jsonb)
) as seed(slug, title, phase, description, sections) on conflict (firm_id, slug) do nothing;
