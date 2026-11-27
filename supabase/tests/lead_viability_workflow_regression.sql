-- Authorized test database only. Entire synthetic fixture rolls back.
begin;
do $$
declare
  actor uuid := gen_random_uuid();
  outsider uuid := gen_random_uuid();
  firm uuid := gen_random_uuid();
  contact uuid := gen_random_uuid();
  apt_request uuid := gen_random_uuid();
  reviewed public.crm_opportunities;
  apt public.crm_opportunities;
  reclassified public.crm_opportunities;
  rejected public.crm_opportunities;
  task public.crm_tasks;
  fallback uuid;
  due date := (now() at time zone 'Europe/Madrid')::date + 2;
  urgent jsonb := '{"urgencia":{"opcion":"Sí, existe una fecha o plazo concreto"},"viabilidadInicial":{"resultado":"no_apto","motivo":"Falta de disponibilidad"}}';
  meeting jsonb := '{"specialType":"meeting","meetingType":"Primera cita"}';
begin
  insert into auth.users(id,email) values (actor,actor::text || '@test.invalid'),(outsider,outsider::text || '@test.invalid');
  insert into public.crm_firms(id,name) values (firm,'Pruebas de viabilidad');
  insert into public.crm_firm_members(firm_id,user_id,role,status) values (firm,actor,'owner','active');
  perform set_config('request.jwt.claim.sub',actor::text,true);
  perform set_config('request.jwt.claims', jsonb_build_object('sub',actor,'role','authenticated','aal','aal2')::text,true);
  insert into public.crm_contacts(id,firm_id,nature,relationship,display_name) values(contact,firm,'person','lead','Persona de prueba');

  begin
    perform public.crm_create_viable_lead(gen_random_uuid(),firm,contact,'Sin fecha','','','',actor,null,urgent,true);
    raise exception 'Expected missing-date rejection' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%fecha de seguimiento%' then raise; end if;
  end;
  begin
    perform public.crm_create_viable_lead(gen_random_uuid(),firm,contact,'Falta aviso','','','',actor,due,urgent,false);
    raise exception 'Expected deadline warning rejection' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%Confirma el aviso%' then raise; end if;
  end;

  rejected := public.crm_create_viable_lead(gen_random_uuid(),firm,contact,'No apto','','','',actor,due,urgent,true);
  assert rejected.stage='lost' and rejected.details #>> '{viabilidadInicial,comunicacionEstado}'='pendiente', 'Pending notice after closure';
  assert exists (select 1 from public.crm_tasks where opportunity_id=rejected.id and title='COMUNICAR NO ACEPTACIÓN' and status='pending'
    and critical and is_next_action and assigned_to=actor and due_on=due and reminder_at=due_at), 'Dated and assigned deadline warning';
  begin
    perform public.crm_act_on_lead_viability(rejected.id,rejected.version,'confirm_notice',p_channel=>'fax');
    raise exception 'Expected invalid channel rejection' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%Indica el canal%' then raise; end if;
  end;
  rejected := public.crm_act_on_lead_viability(rejected.id,rejected.version,'confirm_notice',p_channel=>'whatsapp');
  assert rejected.details #>> '{viabilidadInicial,comunicado_via}'='whatsapp' and rejected.details #>> '{viabilidadInicial,comunicado_fecha}' is not null, 'Stored manual send proof';
  assert not exists (select 1 from public.crm_tasks where opportunity_id=rejected.id and status='pending'), 'Confirmed notice closes reminder';

  reviewed := public.crm_create_viable_lead(gen_random_uuid(),firm,contact,'Pendiente','','','',actor,due,'{"viabilidadInicial":{"resultado":"pendiente"}}',false);
  assert reviewed.stage='qualification', 'Pending stage';
  select * into task from public.crm_tasks where opportunity_id=reviewed.id and is_next_action;
  assert task.title='REVISAR VIABILIDAD' and task.assigned_to=actor and task.due_on=due, 'Dated review';
  begin
    perform public.crm_set_task_status(task.id,task.version,'cancelled',null,'Cierre de prueba');
    raise exception 'Expected cancellation protection' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%Reclasifica el Lead%' then raise; end if;
  end;
  begin
    perform public.crm_create_task(firm,null,reviewed.id,'event','Primera cita','','medium',now()+interval '1 day',null,actor,null,null,null,meeting,null,false);
    raise exception 'Expected booking protection' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%conflicto de intereses%' then raise; end if;
  end;
  reviewed := public.crm_act_on_lead_viability(reviewed.id,reviewed.version,'review','pendiente',due+1);
  assert exists (select 1 from public.crm_tasks where id=task.id and status='completed'), 'Old review closed only with replacement';
  assert exists (select 1 from public.crm_tasks where opportunity_id=reviewed.id and status='pending' and is_next_action and due_on=due+1), 'New dated review';
  reviewed := public.crm_act_on_lead_viability(reviewed.id,reviewed.version,'review','no_apto',due+1,'Fuera del área de práctica');
  assert reviewed.stage='lost' and reviewed.details #>> '{viabilidadInicial,comunicacionEstado}'='pendiente', 'Review reclassifies to no apto';
  reviewed := public.crm_act_on_lead_viability(reviewed.id,reviewed.version,'confirm_notice',p_channel=>'email');
  assert reviewed.details #>> '{viabilidadInicial,comunicado_via}'='email', 'Email registration';

  reclassified := public.crm_create_viable_lead(gen_random_uuid(),firm,contact,'Pendiente a apto','','','',actor,due,'{"viabilidadInicial":{"resultado":"pendiente"}}',false);
  reclassified := public.crm_act_on_lead_viability(reclassified.id,reclassified.version,'review','apto',due);
  assert reclassified.stage='first_meeting' and reclassified.details #>> '{viabilidadInicial,resultado}'='apto', 'Review reclassifies to apto';
  assert exists(select 1 from public.crm_tasks where opportunity_id=reclassified.id and status='pending' and title='CONCERTAR PRIMERA CITA'), 'Review to apto creates dated booking fallback';
  reclassified := public.crm_act_on_lead_viability(reclassified.id,reclassified.version,'review','no_apto',due,'Conflicto de intereses');
  assert reclassified.stage='lost', 'Detected conflict can be reclassified before booking';

  apt := public.crm_create_viable_lead(apt_request,firm,contact,'Apto','','','',actor,due,'{"viabilidadInicial":{"resultado":"apto"}}',false);
  assert apt.stage='first_meeting', 'Apto stage';
  fallback := (apt.details #>> '{viabilidadInicial,tareaId}')::uuid;
  apt := public.crm_create_viable_lead(apt_request,firm,contact,'Retry original','','','',actor,due,'{"viabilidadInicial":{"resultado":"apto"}}',false);
  assert (select count(*) from public.crm_tasks where opportunity_id=apt.id)=1, 'Idempotent lead and reminder';
  begin
    perform public.crm_create_task(firm,null,apt.id,'event','Primera cita','','medium',now()+interval '1 day',null,actor,null,null,null,meeting,null,false);
    raise exception 'Expected conflict gate' using errcode='XX000';
  exception when raise_exception then
    if sqlerrm not like '%conflicto de intereses%' then raise; end if;
  end;
  apt := public.crm_act_on_lead_viability(apt.id,apt.version,'confirm_conflict_check');
  assert apt.details #>> '{viabilidadInicial,conflictoRevisadoPor}'=actor::text, 'Conflict review audit';
  task := public.crm_create_task(firm,null,apt.id,'event','Primera cita','','medium',now()+interval '1 day',null,actor,null,null,null,meeting,null,false);
  assert task.is_next_action and task.assigned_to=actor and task.due_at is not null, 'Booking replaces the reminder as next action';
  assert exists(select 1 from public.crm_tasks where id=fallback and status='completed'), 'Booking closes the fallback';
  perform public.crm_set_task_status(task.id,task.version,'cancelled',null,'Cita cancelada');
  assert exists(select 1 from public.crm_tasks where id=fallback and status='pending' and is_next_action), 'Cancelling sole appointment restores reminder';

  perform set_config('request.jwt.claim.sub',outsider::text,true);
  begin
    perform public.crm_act_on_lead_viability(apt.id,apt.version,'confirm_conflict_check');
    raise exception 'Expected tenant isolation' using errcode='XX000';
  exception when insufficient_privilege then null;
  end;
end;
$$;
rollback;
