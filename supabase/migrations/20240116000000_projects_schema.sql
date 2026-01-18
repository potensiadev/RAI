-- Create projects table
create table if not exists projects (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  description text,
  user_id uuid references auth.users(id) not null,
  status text default 'active' check (status in ('active', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Create project_candidates table
create table if not exists project_candidates (
  project_id uuid references projects(id) on delete cascade,
  candidate_id uuid references candidates(id) on delete cascade,
  notes text,
  status text default 'saved' check (status in ('saved', 'contacted', 'interview', 'offer', 'placed', 'rejected')),
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  primary key (project_id, candidate_id)
);

-- Enable RLS
alter table projects enable row level security;
alter table project_candidates enable row level security;

-- RLS Policies for projects
create policy "Users can view their own projects"
  on projects for select
  using (auth.uid() = user_id);

create policy "Users can insert their own projects"
  on projects for insert
  with check (auth.uid() = user_id);

create policy "Users can update their own projects"
  on projects for update
  using (auth.uid() = user_id);

create policy "Users can delete their own projects"
  on projects for delete
  using (auth.uid() = user_id);

-- RLS Policies for project_candidates
-- Users can see candidates in projects they own
create policy "Users can view candidates in their projects"
  on project_candidates for select
  using (
    exists (
      select 1 from projects
      where projects.id = project_candidates.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can add candidates to their projects"
  on project_candidates for insert
  with check (
    exists (
      select 1 from projects
      where projects.id = project_candidates.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can update candidates in their projects"
  on project_candidates for update
  using (
    exists (
      select 1 from projects
      where projects.id = project_candidates.project_id
      and projects.user_id = auth.uid()
    )
  );

create policy "Users can remove candidates from their projects"
  on project_candidates for delete
  using (
    exists (
      select 1 from projects
      where projects.id = project_candidates.project_id
      and projects.user_id = auth.uid()
    )
  );

-- Indexes for performance
create index projects_user_id_idx on projects(user_id);
create index project_candidates_project_id_idx on project_candidates(project_id);
create index project_candidates_candidate_id_idx on project_candidates(candidate_id);

