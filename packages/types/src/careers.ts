export type JobStatus = 'draft' | 'published' | 'closed' | 'archived';

export type JobEmploymentType =
  | 'full_time'
  | 'part_time'
  | 'contract'
  | 'internship'
  | 'apprenticeship'
  | 'temporary';

export type CareerEmploymentType = JobEmploymentType;

export type WorkplaceType = 'onsite' | 'hybrid' | 'remote';

export type ExperienceLevel = 'fresher' | 'junior' | 'mid' | 'senior' | 'lead';

export type SalaryPeriod = 'hour' | 'day' | 'month' | 'year';

export type ApplicationStatus =
  | 'new'
  | 'screening'
  | 'shortlisted'
  | 'interview'
  | 'offered'
  | 'hired'
  | 'rejected'
  | 'withdrawn';

export interface JobDepartment {
  id: number;
  slug: string;
  name: string;
  sort_order: number;
  is_active: boolean;
  created_at: string;
}

export interface JobPosting {
  id: string;
  job_code: string;
  slug: string;
  title: string;
  department_id: number;
  employment_type: JobEmploymentType;
  workplace_type: WorkplaceType;
  experience_level: ExperienceLevel;
  min_experience_years: number;
  max_experience_years: number | null;
  openings: number;
  city: string;
  district: string | null;
  state_id: number | null;
  country_code: string;
  site_note: string | null;
  salary_min: number | null;
  salary_max: number | null;
  salary_currency: string;
  salary_period: SalaryPeriod;
  show_salary: boolean;
  summary: string;
  description_md: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  benefits: string[];
  skills: string[];
  status: JobStatus;
  is_featured: boolean;
  apply_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  close_reason: string | null;
  seo_title: string | null;
  seo_description: string | null;
  created_by: string | null;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined fields
  department?: JobDepartment | null;
  state_name?: string | null;
  application_count?: number;
}

export interface JobPostingListItem {
  id: string;
  job_code: string;
  slug: string;
  title: string;
  department_id: number;
  department_name?: string;
  department_slug?: string;
  employment_type: JobEmploymentType;
  workplace_type: WorkplaceType;
  experience_level: ExperienceLevel;
  min_experience_years: number;
  max_experience_years: number | null;
  openings: number;
  city: string;
  state_id: number | null;
  state_name?: string | null;
  status: JobStatus;
  is_featured: boolean;
  apply_by: string | null;
  published_at: string | null;
  closed_at: string | null;
  created_at: string;
  updated_at: string;
  application_count?: number;
}

export interface JobApplication {
  id: string;
  application_code: string;
  job_id: string | null;
  full_name: string;
  email: string;
  phone: string;
  current_city: string;
  total_experience_yrs: number;
  current_ctc: number | null;
  expected_ctc: number | null;
  notice_period_days: number | null;
  cover_note: string | null;
  resume_path: string;
  resume_file_name: string;
  resume_mime: string;
  resume_size_bytes: number;
  source: string;
  consent_given_at: string;
  consent_version: string;
  ip_hash: string | null;
  status: ApplicationStatus;
  rating: number | null;
  hr_notes: string | null;
  assigned_to: string | null;
  status_changed_at: string;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  // joined fields
  job_title?: string | null;
  job_code?: string | null;
  assigned_user_name?: string | null;
}

export interface PublicJobListItem {
  id: string;
  job_code: string;
  slug: string;
  title: string;
  summary: string;
  department_slug: string;
  department_name: string;
  employment_type: JobEmploymentType;
  workplace_type: WorkplaceType;
  experience_level: ExperienceLevel;
  min_experience_years: number;
  max_experience_years: number | null;
  openings: number;
  city: string;
  state_name: string | null;
  is_featured: boolean;
  apply_by: string | null;
  published_at: string;
  salary_min: number | null;
  salary_max: number | null;
  salary_period: SalaryPeriod | null;
}

export interface PublicJobDetail extends PublicJobListItem {
  description_md: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  benefits: string[];
  skills: string[];
  district: string | null;
  country_code: string;
  updated_at: string;
  seo_title: string | null;
  seo_description: string | null;
  show_salary: boolean;
  salary_currency: string | null;
  availability: 'open' | 'closed';
  closed_at: string | null;
}

export interface PublicJobFilters {
  total: number;
  departments: Array<{ slug: string; name: string; count: number }>;
  employment_types: Array<{ value: string; count: number }>;
  workplace_types: Array<{ value: string; count: number }>;
  states: Array<{ id: number; name: string; count: number }>;
}

export interface HiringSummary {
  total_jobs: number;
  published: number;
  drafts: number;
  closed: number;
  applications: number;
  new_applications: number;
  applications_7d: number;
}


export interface JobListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  status?: JobStatus | 'all';
  department?: string;
  employment_type?: string;
  workplace_type?: string;
  state_id?: number;
  sortField?: 'created_at' | 'published_at' | 'apply_by' | 'title' | 'applications';
  sortOrder?: 'asc' | 'desc';
}

export interface ApplicationListQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  job_id?: string;
  status?: ApplicationStatus | 'all';
  rating?: number;
  sortField?: 'created_at' | 'rating' | 'total_experience_yrs';
  sortOrder?: 'asc' | 'desc';
}
