-- =====================================================================
-- 180_careers_hiring.sql
-- Careers & Hiring: departments, job postings, applications, public read RPCs,
-- admin RPCs, RLS, indexes, triggers, private resume bucket, and HR dashboard extension.
-- =====================================================================
create extension if not exists pg_trgm;

-- ---------- helpers ----------
create or replace function public.careers_touch_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- ---------- 1. departments (small lookup, HR-managed) ----------
create table if not exists public.job_departments (
  id          smallint generated always as identity primary key,
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name        text not null check (char_length(name) between 2 and 80),
  sort_order  smallint not null default 0,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now()
);

insert into public.job_departments (slug, name, sort_order) values
  ('operations',          'Operations',            10),
  ('service-maintenance', 'Service & Maintenance', 20),
  ('sales-marketing',     'Sales & Marketing',     30),
  ('finance-accounts',    'Finance & Accounts',   40),
  ('hr-admin',            'HR & Admin',            50),
  ('safety-hse',          'Safety & HSE',          60),
  ('it-technology',       'IT & Technology',       70)
on conflict (slug) do nothing;

-- ---------- 2. job postings ----------
create sequence if not exists public.job_code_seq start 1;

create table if not exists public.job_postings (
  id                   uuid primary key default gen_random_uuid(),
  job_code             text not null unique,                      -- JOB-0001, immutable
  slug                 text not null,                             -- URL slug, immutable after first publish
  title                text not null check (char_length(title) between 3 and 120),
  department_id        smallint not null references public.job_departments(id),

  employment_type      text not null check (employment_type in
                         ('full_time','part_time','contract','internship','apprenticeship','temporary')),
  workplace_type       text not null default 'onsite' check (workplace_type in ('onsite','hybrid','remote')),
  experience_level     text not null check (experience_level in ('fresher','junior','mid','senior','lead')),
  min_experience_years numeric(3,1) not null default 0 check (min_experience_years >= 0),
  max_experience_years numeric(3,1) check (max_experience_years is null or max_experience_years >= min_experience_years),
  openings             smallint not null default 1 check (openings between 1 and 500),

  -- location (canonical address standard: city -> district -> state)
  city                 text not null check (char_length(city) between 2 and 80),
  district             text,
  state_id             smallint references public.states(id),
  country_code         char(2) not null default 'IN',
  site_note            text check (site_note is null or char_length(site_note) <= 120),

  -- compensation (display is opt-in)
  salary_min           numeric(12,2) check (salary_min is null or salary_min >= 0),
  salary_max           numeric(12,2) check (salary_max is null or salary_max >= coalesce(salary_min, 0)),
  salary_currency      char(3) not null default 'INR',
  salary_period        text not null default 'month' check (salary_period in ('hour','day','month','year')),
  show_salary          boolean not null default false,

  -- content
  summary              text not null check (char_length(summary) between 20 and 300),
  description_md       text not null check (char_length(description_md) between 50 and 20000),
  responsibilities     text[] not null default '{}' check (cardinality(responsibilities) <= 30),
  requirements         text[] not null default '{}' check (cardinality(requirements) <= 30),
  nice_to_have         text[] not null default '{}' check (cardinality(nice_to_have) <= 20),
  benefits             text[] not null default '{}' check (cardinality(benefits) <= 20),
  skills               text[] not null default '{}' check (cardinality(skills) <= 30),

  -- lifecycle
  status               text not null default 'draft' check (status in ('draft','published','closed','archived')),
  is_featured          boolean not null default false,
  apply_by             date,                                      -- JSON-LD validThrough
  published_at         timestamptz,
  closed_at            timestamptz,
  close_reason         text check (close_reason is null or close_reason in ('filled','cancelled','expired','other')),

  -- SEO overrides
  seo_title            text check (seo_title is null or char_length(seo_title) <= 70),
  seo_description      text check (seo_description is null or char_length(seo_description) <= 160),

  -- bookkeeping
  created_by           uuid references public.users(id) on delete set null,
  updated_by           uuid references public.users(id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz,

  search_vector        tsvector generated always as (
    to_tsvector('simple',
      coalesce(title,'') || ' ' || coalesce(summary,'') || ' ' || coalesce(city,''))
  ) stored,

  constraint chk_job_slug_format     check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 100),
  constraint chk_job_show_salary     check (not show_salary or salary_min is not null),
  constraint chk_job_published_at    check (status <> 'published' or published_at is not null),
  constraint chk_job_closed_at       check (status not in ('closed','archived') or closed_at is not null),
  constraint chk_job_apply_by        check (apply_by is null or apply_by >= (created_at at time zone 'UTC')::date)
);

-- slug is globally unique even for soft-deleted rows (URLs are never recycled -> no SEO collisions)
create unique index if not exists uq_job_postings_slug on public.job_postings (lower(slug));

-- hot public path: published, not deleted, newest first
create index if not exists idx_job_postings_public
  on public.job_postings (is_featured desc, published_at desc, id desc)
  where status = 'published' and deleted_at is null;

-- admin list path
create index if not exists idx_job_postings_status_created
  on public.job_postings (status, created_at desc, id desc) where deleted_at is null;
create index if not exists idx_job_postings_department on public.job_postings (department_id) where deleted_at is null;
create index if not exists idx_job_postings_apply_by   on public.job_postings (apply_by) where status = 'published';

-- search
create index if not exists idx_job_postings_search_vector on public.job_postings using gin (search_vector);
create index if not exists idx_job_postings_title_trgm    on public.job_postings using gin (title gin_trgm_ops);
create index if not exists idx_job_postings_city_trgm     on public.job_postings using gin (city  gin_trgm_ops);
create index if not exists idx_job_postings_code_trgm     on public.job_postings using gin (job_code gin_trgm_ops);

-- triggers
create or replace function public.trg_job_postings_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.job_code := 'JOB-' || lpad(nextval('public.job_code_seq')::text, 4, '0');
    new.created_by := coalesce(new.created_by, auth.uid());
  else
    if new.job_code <> old.job_code then
      raise exception 'job_code is immutable' using errcode = '23514';
    end if;
    -- slug frozen once the job has ever been published (protects indexed URLs)
    if old.published_at is not null and lower(new.slug) <> lower(old.slug) then
      raise exception 'slug is immutable after first publish' using errcode = '23514';
    end if;
  end if;

  new.updated_by := coalesce(auth.uid(), new.updated_by);

  -- publish transition
  if new.status = 'published' and new.published_at is null then
    new.published_at := now();
  end if;
  if new.status = 'published' then
    new.closed_at := null; new.close_reason := null;
  end if;
  -- close/archive transition
  if new.status in ('closed','archived') and new.closed_at is null then
    new.closed_at := now();
  end if;
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_job_postings_before_write') then
    create trigger trg_job_postings_before_write
      before insert or update on public.job_postings
      for each row execute function public.trg_job_postings_before_write();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_job_postings_touch') then
    create trigger trg_job_postings_touch
      before update on public.job_postings
      for each row execute function public.careers_touch_updated_at();
  end if;
end $$;

-- ---------- 3. applications ----------
create sequence if not exists public.job_application_code_seq start 1;

create table if not exists public.job_applications (
  id                   uuid primary key default gen_random_uuid(),
  application_code     text not null unique,                      -- APP-000001
  job_id               uuid references public.job_postings(id) on delete restrict, -- NULL = general application
  full_name            text not null check (char_length(full_name) between 2 and 100),
  email                text not null check (char_length(email) <= 255 and email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  phone                text not null check (phone ~ '^[6-9][0-9]{9}$'),
  current_city         text not null check (char_length(current_city) between 2 and 80),
  total_experience_yrs numeric(3,1) not null check (total_experience_yrs between 0 and 50),
  current_ctc          numeric(12,2) check (current_ctc is null or current_ctc >= 0),
  expected_ctc         numeric(12,2) check (expected_ctc is null or expected_ctc >= 0),
  notice_period_days   smallint check (notice_period_days is null or notice_period_days between 0 and 180),
  cover_note           text check (cover_note is null or char_length(cover_note) <= 1500),

  resume_path          text not null,                             -- private bucket path, never a URL
  resume_file_name     text not null,
  resume_mime          text not null check (resume_mime in
                         ('application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document')),
  resume_size_bytes    integer not null check (resume_size_bytes between 1 and 5242880),

  source               text not null default 'careers_site' check (source in ('careers_site','referral','walk_in','other')),
  consent_given_at     timestamptz not null,
  consent_version      text not null,
  ip_hash              text,                                      -- SHA-256(ip + pepper); never raw IP

  status               text not null default 'new' check (status in
                         ('new','screening','shortlisted','interview','offered','hired','rejected','withdrawn')),
  rating               smallint check (rating is null or rating between 1 and 5),
  hr_notes             text check (hr_notes is null or char_length(hr_notes) <= 4000),
  assigned_to          uuid references public.users(id) on delete set null,
  status_changed_at    timestamptz not null default now(),

  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  deleted_at           timestamptz
);

-- one live application per person per job (general applications: job_id IS NULL -> one per email)
create unique index if not exists uq_job_applications_job_email
  on public.job_applications (coalesce(job_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(email))
  where deleted_at is null;

create index if not exists idx_job_applications_job_created on public.job_applications (job_id, created_at desc, id desc) where deleted_at is null;
create index if not exists idx_job_applications_status_created on public.job_applications (status, created_at desc, id desc) where deleted_at is null;
create index if not exists idx_job_applications_name_trgm  on public.job_applications using gin (full_name gin_trgm_ops);
create index if not exists idx_job_applications_email_trgm on public.job_applications using gin (email gin_trgm_ops);
create index if not exists idx_job_applications_phone_trgm on public.job_applications using gin (phone gin_trgm_ops);

create or replace function public.trg_job_applications_before_write()
returns trigger language plpgsql as $$
begin
  if tg_op = 'INSERT' then
    new.application_code := 'APP-' || lpad(nextval('public.job_application_code_seq')::text, 6, '0');
  elsif new.status is distinct from old.status then
    new.status_changed_at := now();
  end if;
  new.email := lower(trim(new.email));
  return new;
end $$;

do $$
begin
  if not exists (select 1 from pg_trigger where tgname = 'trg_job_applications_before_write') then
    create trigger trg_job_applications_before_write
      before insert or update on public.job_applications
      for each row execute function public.trg_job_applications_before_write();
  end if;
  if not exists (select 1 from pg_trigger where tgname = 'trg_job_applications_touch') then
    create trigger trg_job_applications_touch
      before update on public.job_applications
      for each row execute function public.careers_touch_updated_at();
  end if;
end $$;

-- ---------- 4. RLS ----------
alter table public.job_departments  enable row level security;
alter table public.job_postings     enable row level security;
alter table public.job_applications enable row level security;

revoke all on public.job_departments, public.job_postings, public.job_applications from anon;

do $$
begin
  if not exists (select 1 from pg_policies where policyname = 'job_departments_select' and tablename = 'job_departments') then
    create policy job_departments_select on public.job_departments for select to authenticated
      using ((select public.current_user_role()) = any (array['super_admin','admin','hr','manager']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_departments_write' and tablename = 'job_departments') then
    create policy job_departments_write on public.job_departments for all to authenticated
      using      ((select public.current_user_role()) = any (array['super_admin','admin','hr']))
      with check ((select public.current_user_role()) = any (array['super_admin','admin','hr']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_postings_select' and tablename = 'job_postings') then
    create policy job_postings_select on public.job_postings for select to authenticated
      using ((select public.current_user_role()) = any (array['super_admin','admin','hr','manager']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_postings_insert' and tablename = 'job_postings') then
    create policy job_postings_insert on public.job_postings for insert to authenticated
      with check ((select public.current_user_role()) = any (array['super_admin','admin','hr']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_postings_update' and tablename = 'job_postings') then
    create policy job_postings_update on public.job_postings for update to authenticated
      using      ((select public.current_user_role()) = any (array['super_admin','admin','hr']))
      with check ((select public.current_user_role()) = any (array['super_admin','admin','hr']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_applications_select' and tablename = 'job_applications') then
    create policy job_applications_select on public.job_applications for select to authenticated
      using ((select public.current_user_role()) = any (array['super_admin','admin','hr']));
  end if;

  if not exists (select 1 from pg_policies where policyname = 'job_applications_update' and tablename = 'job_applications') then
    create policy job_applications_update on public.job_applications for update to authenticated
      using      ((select public.current_user_role()) = any (array['super_admin','admin','hr']))
      with check ((select public.current_user_role()) = any (array['super_admin','admin','hr']));
  end if;
end $$;

-- ---------- 5. PUBLIC READ RPCs (the ONLY thing anon can call) ----------
create or replace function public.get_public_jobs(
  p_search      text    default null,
  p_department  text    default null,
  p_type        text    default null,
  p_workplace   text    default null,
  p_state_id    smallint default null,
  p_page        int     default 1,
  p_page_size   int     default 10
) returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with params as (
    select nullif(trim(p_search),'') as q
  ),
  base as (
    select j.*, d.slug as department_slug, d.name as department_name, s.name as state_name
    from public.job_postings j
    join public.job_departments d on d.id = j.department_id
    left join public.states s on s.id = j.state_id
    cross join params p
    where j.status = 'published' and j.deleted_at is null
      and j.published_at <= now()
      and (j.apply_by is null or j.apply_by >= current_date)
      and (p_department is null or d.slug = p_department)
      and (p_type       is null or j.employment_type = p_type)
      and (p_workplace  is null or j.workplace_type = p_workplace)
      and (p_state_id   is null or j.state_id = p_state_id)
      and (p.q is null or j.title ilike '%'||p.q||'%' or j.city ilike '%'||p.q||'%' or j.search_vector @@ plainto_tsquery('simple', p.q))
  )
  select jsonb_build_object(
    'total', (select count(*) from base),
    'rows', coalesce((
      select jsonb_agg(to_jsonb(r) order by r.is_featured desc, r.published_at desc, r.id desc)
      from (
        select b.id, b.job_code, b.slug, b.title, b.summary, b.department_slug, b.department_name,
               b.employment_type, b.workplace_type, b.experience_level,
               b.min_experience_years, b.max_experience_years, b.openings,
               b.city, b.state_name, b.is_featured, b.apply_by, b.published_at,
               case when b.show_salary then b.salary_min end as salary_min,
               case when b.show_salary then b.salary_max end as salary_max,
               case when b.show_salary then b.salary_period end as salary_period
        from base b
        order by b.is_featured desc, b.published_at desc, b.id desc
        limit least(greatest(p_page_size,1),50)
        offset (greatest(p_page,1) - 1) * least(greatest(p_page_size,1),50)
      ) r
    ), '[]'::jsonb)
  );
$$;

create or replace function public.get_public_job_by_slug(p_slug text)
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  select to_jsonb(r) from (
    select j.id, j.job_code, j.slug, j.title, j.summary, j.description_md,
           j.responsibilities, j.requirements, j.nice_to_have, j.benefits, j.skills,
           d.slug as department_slug, d.name as department_name,
           j.employment_type, j.workplace_type, j.experience_level,
           j.min_experience_years, j.max_experience_years, j.openings,
           j.city, j.district, s.name as state_name, j.country_code,
           j.apply_by, j.published_at, j.updated_at, j.is_featured,
           j.seo_title, j.seo_description,
           j.show_salary,
           case when j.show_salary then j.salary_min end as salary_min,
           case when j.show_salary then j.salary_max end as salary_max,
           case when j.show_salary then j.salary_currency end as salary_currency,
           case when j.show_salary then j.salary_period end as salary_period,
           case
             when j.status = 'published' and (j.apply_by is null or j.apply_by >= current_date) then 'open'
             else 'closed'
           end as availability,
           j.closed_at
    from public.job_postings j
    join public.job_departments d on d.id = j.department_id
    left join public.states s on s.id = j.state_id
    where lower(j.slug) = lower(p_slug)
      and j.deleted_at is null
      and j.published_at is not null
      and j.published_at <= now()
      and (j.status = 'published' or (j.status = 'closed' and j.closed_at > now() - interval '90 days'))
  ) r;
$$;

create or replace function public.get_public_job_slugs()
returns table (slug text, updated_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select j.slug, j.updated_at from public.job_postings j
  where j.status = 'published' and j.deleted_at is null and j.published_at <= now()
    and (j.apply_by is null or j.apply_by >= current_date);
$$;

create or replace function public.get_public_job_filters()
returns jsonb
language sql stable security definer set search_path = public, pg_temp as $$
  with live as (
    select j.*, d.slug as dslug, d.name as dname, s.id as sid, s.name as sname
    from public.job_postings j
    join public.job_departments d on d.id = j.department_id
    left join public.states s on s.id = j.state_id
    where j.status='published' and j.deleted_at is null and j.published_at <= now()
      and (j.apply_by is null or j.apply_by >= current_date)
  )
  select jsonb_build_object(
    'total', (select count(*) from live),
    'departments', coalesce((select jsonb_agg(jsonb_build_object('slug',dslug,'name',dname,'count',c) order by dname)
                   from (select dslug, dname, count(*) c from live group by 1,2) x), '[]'),
    'employment_types', coalesce((select jsonb_agg(jsonb_build_object('value',employment_type,'count',c))
                   from (select employment_type, count(*) c from live group by 1) x), '[]'),
    'workplace_types', coalesce((select jsonb_agg(jsonb_build_object('value',workplace_type,'count',c))
                   from (select workplace_type, count(*) c from live group by 1) x), '[]'),
    'states', coalesce((select jsonb_agg(jsonb_build_object('id',sid,'name',sname,'count',c) order by sname)
                   from (select sid, sname, count(*) c from live where sid is not null group by 1,2) x), '[]')
  );
$$;

grant execute on function public.get_public_jobs(text,text,text,text,smallint,int,int),
                          public.get_public_job_by_slug(text),
                          public.get_public_job_slugs(),
                          public.get_public_job_filters() to anon, authenticated;

-- ---------- 6. ADMIN RPCs ----------
create or replace function public.get_hiring_summary()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
begin
  if (select public.current_user_role()) not in ('super_admin','admin','hr','manager') then
    raise exception 'Unauthorized' using errcode = '42501';
  end if;
  return jsonb_build_object(
    'total_jobs',      (select count(*) from public.job_postings where deleted_at is null),
    'published',       (select count(*) from public.job_postings where status='published' and deleted_at is null),
    'drafts',          (select count(*) from public.job_postings where status='draft' and deleted_at is null),
    'closed',          (select count(*) from public.job_postings where status in ('closed','archived') and deleted_at is null),
    'applications',    (select count(*) from public.job_applications where deleted_at is null),
    'new_applications',(select count(*) from public.job_applications where status='new' and deleted_at is null),
    'applications_7d', (select count(*) from public.job_applications where created_at >= now() - interval '7 days' and deleted_at is null)
  );
end $$;

-- scheduled by cron once a day; closes expired jobs
create or replace function public.close_expired_job_postings()
returns integer
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_count integer;
begin
  update public.job_postings
     set status='closed', close_reason='expired', closed_at=now()
   where status='published' and apply_by is not null and apply_by < current_date and deleted_at is null;
  get diagnostics v_count = row_count;
  return v_count;
end $$;
revoke all on function public.close_expired_job_postings() from public, anon, authenticated;
grant execute on function public.close_expired_job_postings() to service_role;

-- ---------- 7. APPLY RPC (service_role only; called from the Next.js route handler) ----------
create or replace function public.submit_job_application_atomic(
  p_job_id uuid, p_full_name text, p_email text, p_phone text, p_current_city text,
  p_total_experience_yrs numeric, p_current_ctc numeric, p_expected_ctc numeric,
  p_notice_period_days smallint, p_cover_note text,
  p_resume_path text, p_resume_file_name text, p_resume_mime text, p_resume_size_bytes integer,
  p_consent_version text, p_ip_hash text
) returns jsonb
language plpgsql security definer set search_path = public, pg_temp as $$
declare v_id uuid; v_code text;
begin
  if p_job_id is not null and not exists (
    select 1 from public.job_postings
    where id = p_job_id and status='published' and deleted_at is null
      and (apply_by is null or apply_by >= current_date)
  ) then
    raise exception 'JOB_NOT_OPEN' using errcode = 'P0001';
  end if;

  insert into public.job_applications (
    job_id, full_name, email, phone, current_city, total_experience_yrs, current_ctc, expected_ctc,
    notice_period_days, cover_note, resume_path, resume_file_name, resume_mime, resume_size_bytes,
    consent_given_at, consent_version, ip_hash, application_code
  ) values (
    p_job_id, trim(p_full_name), p_email, p_phone, trim(p_current_city), p_total_experience_yrs, p_current_ctc, p_expected_ctc,
    p_notice_period_days, p_cover_note, p_resume_path, p_resume_file_name, p_resume_mime, p_resume_size_bytes,
    now(), p_consent_version, p_ip_hash, 'pending'
  ) returning id, application_code into v_id, v_code;

  insert into public.audit_logs (user_id, action, entity_type, entity_id, category, severity, details)
  values (null, 'application.submitted', 'job_application', v_id::text, 'hiring', 'info',
          jsonb_build_object('job_id', p_job_id, 'application_code', v_code));

  return jsonb_build_object('id', v_id, 'application_code', v_code);
exception when unique_violation then
  raise exception 'ALREADY_APPLIED' using errcode = '23505';
end $$;
revoke all on function public.submit_job_application_atomic(uuid,text,text,text,text,numeric,numeric,numeric,smallint,text,text,text,text,integer,text,text) from public, anon, authenticated;
grant execute on function public.submit_job_application_atomic(uuid,text,text,text,text,numeric,numeric,numeric,smallint,text,text,text,text,integer,text,text) to service_role;

-- ---------- 8. private resume bucket ----------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('career_resumes','career_resumes', false, 5242880,
        array['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document'])
on conflict (id) do nothing;

-- ---------- 9. extend get_hr_dashboard() with hiring metrics ----------
create or replace function public.get_hr_dashboard()
returns jsonb
language plpgsql stable security definer set search_path = public, pg_temp as $$
declare
  v_total_employees      int;
  v_active_operators     int;
  v_pending_changes      int;
  v_today_logs           int;
  v_open_roles           int;
  v_new_applications     int;
  v_alerts               jsonb := '[]'::jsonb;
  v_today                date := CURRENT_DATE;
begin
  select count(*) into v_total_employees
  from public.users where status = 'active';

  select count(*) into v_active_operators
  from public.users where role = 'operator' and status = 'active';

  select count(*) into v_pending_changes
  from public.profile_change_requests where status = 'pending';

  select count(*) into v_today_logs
  from public.machine_hour_logs where log_date = v_today;

  select count(*) into v_open_roles
  from public.job_postings
  where status = 'published' and deleted_at is null
    and published_at <= now()
    and (apply_by is null or apply_by >= v_today);

  select count(*) into v_new_applications
  from public.job_applications
  where status = 'new' and deleted_at is null;

  if v_pending_changes > 0 then
    v_alerts := v_alerts || jsonb_build_object(
      'id', 'pending-profile-requests',
      'severity', 'warning',
      'title', format('%s pending profile change request(s)', v_pending_changes),
      'description', 'Staff requested updates to personal information or documents.',
      'actionUrl', '/users'
    );
  end if;

  return jsonb_build_object(
    'totalEmployees',       v_total_employees,
    'activeOperators',      v_active_operators,
    'pendingProfileChanges', v_pending_changes,
    'todayLogsCount',       v_today_logs,
    'openRoles',            v_open_roles,
    'newApplications',      v_new_applications,
    'alerts',               v_alerts
  );
end;
$$;
