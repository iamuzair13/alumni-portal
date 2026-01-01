-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alumni_chapter (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  chapter1 numeric,
  chapter2 numeric,
  chapter3 numeric,
  remarks text,
  CONSTRAINT alumni_chapter_pkey PRIMARY KEY (id),
  CONSTRAINT alumni_chapter_id_fkey FOREIGN KEY (id) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.alumni_memberships (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  gym_membership_month text,
  swimmingpool_membership_month text,
  CONSTRAINT alumni_memberships_pkey PRIMARY KEY (id),
  CONSTRAINT alumni_memberships_id_fkey FOREIGN KEY (id) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.alumni_scholarships (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  kinship_firstname text,
  kinship_lastname text,
  kinship_cnic text,
  apply_for text,
  degree_title text,
  CONSTRAINT alumni_scholarships_pkey PRIMARY KEY (id),
  CONSTRAINT alumni_scholarships_id_fkey FOREIGN KEY (id) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.alumnichapterslocation (
  chapterid integer NOT NULL DEFAULT nextval('alumnichapterslocation_chapterid_seq'::regclass),
  categoryname character varying,
  chaptercode character varying,
  chaptertitle character varying,
  chapterlocation character varying NOT NULL,
  chapterwhatsapp character varying,
  CONSTRAINT alumnichapterslocation_pkey PRIMARY KEY (chapterid)
);
CREATE TABLE public.chapter_leadership (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  post text,
  status text DEFAULT 'pending'::text,
  rejection_reason text,
  updated_at timestamp with time zone DEFAULT now(),
  alumniid integer,
  CONSTRAINT chapter_leadership_pkey PRIMARY KEY (id)
);
CREATE TABLE public.leadership_form_settings (
  id integer NOT NULL DEFAULT nextval('leadership_form_settings_id_seq'::regclass),
  form_type character varying NOT NULL UNIQUE,
  is_enabled boolean NOT NULL DEFAULT true,
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_by integer,
  CONSTRAINT leadership_form_settings_pkey PRIMARY KEY (id),
  CONSTRAINT leadership_form_settings_updated_by_fkey FOREIGN KEY (updated_by) REFERENCES public.tbl_users(userid)
);
CREATE TABLE public.newsletters (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  date date,
  image text,
  link text,
  CONSTRAINT newsletters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.staging_alumni_import (
  alumniemail character varying,
  alumniname text,
  gender text,
  contactno text,
  city text,
  country text,
  work_city text,
  work_country text,
  designation text,
  nameoforganization text,
  imported_at timestamp without time zone DEFAULT now(),
  major text,
  passing text,
  school text,
  job text,
  sapid text
);
create table public.tbl_alumni (
  alumniid serial not null,
  alumniemail character varying(150) not null,
  password text null,
  todaydate timestamp without time zone null,
  registrationno character varying(20) null,
  sapid character varying(20) null,
  alumniname character varying(200) null,
  gender character varying(50) null,
  fathername character varying(200) null,
  dateofbirth character varying(50) null,
  maritalstatus character varying(50) null,
  cnicpassport character varying(50) null,
  contactno character varying(50) null,
  contactno1 character varying(50) null,
  contactno1show text null,
  personalemail character varying(100) null,
  personalemailshow text null,
  universityemail character varying(100) null,
  country character varying(50) null,
  province character varying(50) null,
  city character varying(50) null,
  address character varying(250) null,
  academicsession character varying(50) null,
  degreetitle character varying(300) null,
  cgpa double precision null,
  yearofstarting integer null,
  yearofending integer null,
  facultyname character varying(100) null,
  campusname character varying(100) null,
  departmentname character varying(300) null,
  majorsubject character varying(100) null,
  industry text null,
  employeed text null,
  nameoforganization character varying(100) null,
  designation character varying(100) null,
  totalyearsofexpereince character varying(10) null,
  officialemail character varying(100) null,
  officialnumber character varying(50) null,
  work_city text null,
  supervisordesignation character varying(100) null,
  work_country text null,
  supervisornumber character varying(50) null,
  image1 character varying(200) null,
  cv character varying(200) null,
  aboutme text null,
  lasttimelogin character varying(50) null,
  logincount integer null,
  verify character varying null,
  emailsendcount smallint null,
  emailsendstatus character varying(100) null,
  createddatetime character varying(50) null,
  facebook character varying(300) null,
  instagram character varying(300) null,
  youtube character varying(300) null,
  linkedin character varying(300) null,
  datasource character varying(50) null,
  alumnistatus character varying(50) null,
  higher_education_institute_name text null,
  degree_title text null,
  is_scholarship text null,
  higher_education_program text null,
  father_cnic text null,
  image2 text null,
  association_id bigint null,
  association_job integer null,
  chapter_leadership bigint null,
  organization_address text null,
  higher_education_institute_country text null,
  higher_education_institute_province text null,
  higher_education_institute_city text null,
  about text null,
  category text null,
  faculty bigint null,
  department bigint null,
  program bigint null,
  constraint tbl_alumni_pkey primary key (alumniid),
  constraint tbl_alumni_association_job_fkey foreign KEY (association_job) references tblalumniassociation (id),
  constraint tbl_alumni_chapter_leadership_fkey foreign KEY (chapter_leadership) references chapter_leadership (id),
  constraint tbl_alumni_association_id_fkey foreign KEY (association_id) references tbl_associations (id),
  constraint tbl_alumni_faculty_fkey foreign KEY (faculty) references tbl_faculties (id),
  constraint tbl_alumni_program_fkey foreign KEY (program) references tbl_programs (id),
  constraint tbl_alumni_department_fkey foreign KEY (department) references tbl_departments (id)
) TABLESPACE pg_default;
CREATE TABLE public.tbl_associations (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  description text,
  dean text,
  dean_message text,
  phone text,
  email text,
  address text,
  image text,
  CONSTRAINT tbl_associations_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tbl_banner (
  bannerid integer NOT NULL DEFAULT nextval('tbl_banner_bannerid_seq'::regclass),
  bannertitle1 character varying,
  bannertitle2 character varying,
  bannertitle3 character varying,
  bannerimage character varying,
  orderby smallint,
  CONSTRAINT tbl_banner_pkey PRIMARY KEY (bannerid)
);
-- Table: public.tbl_departments

-- DROP TABLE IF EXISTS public.tbl_departments;

CREATE TABLE IF NOT EXISTS public.tbl_departments
(
    id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    department_name text COLLATE pg_catalog."default",
    faculty_id bigint,
    department_code text COLLATE pg_catalog."default",
    CONSTRAINT uol_departments_pkey PRIMARY KEY (id),
    CONSTRAINT tbl_departments_faculty_id_fkey FOREIGN KEY (faculty_id)
        REFERENCES public.tbl_faculties (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.tbl_departments
    OWNER to postgres;
CREATE TABLE public.tbl_events (
  id integer NOT NULL DEFAULT nextval('tbl_events_id_seq'::regclass),
  category character varying,
  title character varying,
  shortdescription character varying,
  longdescription text,
  fromdate date,
  todate date,
  eventtime character varying,
  image1 character varying NOT NULL,
  image2 character varying,
  image3 character varying,
  image4 character varying,
  image5 character varying,
  parent_type text CHECK (parent_type = ANY (ARRAY['chapter'::text, 'association'::text])),
  parent_id bigint,
  chapter_id bigint,
  association_id bigint,
  type text,
  CONSTRAINT tbl_events_pkey PRIMARY KEY (id)
);

-- Table: public.tbl_courses

-- DROP TABLE IF EXISTS public.tbl_courses;

CREATE TABLE IF NOT EXISTS public.tbl_courses
(
    course_name text COLLATE pg_catalog."default",
    id bigint NOT NULL,
    course_code numeric,
    CONSTRAINT tbl_courses_pkey PRIMARY KEY (id)
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.tbl_courses
    OWNER to postgres;

CREATE TABLE public.tbl_faculties (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  faculty_name text,
  CONSTRAINT tbl_faculties_pkey PRIMARY KEY (id)
);
-- Table: public.tbl_programs

-- DROP TABLE IF EXISTS public.tbl_programs;

CREATE TABLE IF NOT EXISTS public.tbl_programs
(
    id bigint NOT NULL GENERATED BY DEFAULT AS IDENTITY ( INCREMENT 1 START 1 MINVALUE 1 MAXVALUE 9223372036854775807 CACHE 1 ),
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    program_name text COLLATE pg_catalog."default",
    department_id bigint,
    program_abv numeric,
    CONSTRAINT tbl_programs_pkey PRIMARY KEY (id),
    CONSTRAINT tbl_programs_department_id_fkey FOREIGN KEY (department_id)
        REFERENCES public.tbl_departments (id) MATCH SIMPLE
        ON UPDATE NO ACTION
        ON DELETE NO ACTION
)

TABLESPACE pg_default;

ALTER TABLE IF EXISTS public.tbl_programs
    OWNER to postgres;

ALTER TABLE IF EXISTS public.tbl_programs
    ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.tbl_users (
  userid integer NOT NULL DEFAULT nextval('tbl_users_userid_seq'::regclass),
  email text,
  password text,
  firstname character varying,
  lastname character varying,
  department character varying,
  type character varying,
  blocked boolean,
  lastlogindatetime character varying,
  CONSTRAINT tbl_users_pkey PRIMARY KEY (userid)
);
CREATE TABLE public.tblalumniassociation (
  id integer NOT NULL DEFAULT nextval('tblalumniassociation_id_seq'::regclass),
  q3 character varying,
  q2 character varying,
  q2others character varying,
  q4 character varying,
  q5 character varying,
  q6 character varying,
  q7 character varying,
  createddatetime timestamp without time zone,
  status character varying DEFAULT 'pending'::character varying,
  alumni_id integer,
  CONSTRAINT tblalumniassociation_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tblalumnistories (
  alumniid integer NOT NULL,
  alumnistories text,
  story_image character varying,
  status character varying,
  createdat timestamp without time zone,
  storytitle text,
  id integer NOT NULL DEFAULT nextval('tblalumnistories_id_seq'::regclass),
  CONSTRAINT tblalumnistories_pkey PRIMARY KEY (id),
  CONSTRAINT tblalumnistories_alumniid_fkey FOREIGN KEY (alumniid) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.tblalumnitalks (
  id integer NOT NULL DEFAULT nextval('tblalumnitalks_id_seq'::regclass),
  alumniid integer NOT NULL,
  alumnitalks character varying,
  mentorshipprogram character varying,
  topic text,
  date_1 date,
  timings_1 text,
  activity text,
  linkedin character varying,
  mode text,
  timings_2 text,
  timings_3 text,
  date_2 date,
  date_3 date,
  brief_outline text,
  talk_status text,
  onhold_reason text,
  CONSTRAINT tblalumnitalks_pkey PRIMARY KEY (alumniid),
  CONSTRAINT tblalumnitalks_alumniid_fkey FOREIGN KEY (alumniid) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.tblcard (
  cardid integer NOT NULL DEFAULT nextval('tblcard_cardid_seq'::regclass),
  alumniid integer NOT NULL,
  cardpicture character varying,
  cardaddress character varying,
  cnicno character varying,
  status character varying,
  createdat timestamp without time zone,
  card_image text,
  printed boolean,
  reason_onhold text,
  validity_date date,
  comment text,
  CONSTRAINT tblcard_pkey PRIMARY KEY (alumniid),
  CONSTRAINT tblcard_alumniid_fkey FOREIGN KEY (alumniid) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.tblchapters (
  id integer NOT NULL DEFAULT nextval('tblchapters_id_seq'::regclass),
  chapter_whatsapp text,
  national_chapter text,
  international_chapter text,
  chapter_image text,
  is_active boolean,
  description text,
  cities text,
  CONSTRAINT tblchapters_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tbljobs (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  title text,
  category text,
  company text,
  deadline date,
  location text,
  job_link text,
  CONSTRAINT tbljobs_pkey PRIMARY KEY (id)
);
CREATE TABLE public.tblstories (
  id integer NOT NULL DEFAULT nextval('tblstories_id_seq'::regclass),
  alumniname character varying,
  alumnisession character varying,
  alumnifaculty character varying,
  alumnicompany character varying,
  alumnidesignation character varying,
  alumnicitycountry character varying,
  alumnistories text,
  alumnishortstories character varying,
  alumnistoriesdate date,
  alumniimage1 character varying,
  alumnishowhome character varying,
  CONSTRAINT tblstories_pkey PRIMARY KEY (id),
  CONSTRAINT tblstories_id_fkey FOREIGN KEY (id) REFERENCES public.tbl_alumni(alumniid)
);
CREATE TABLE public.ucoming_events (
  id bigint GENERATED ALWAYS AS IDENTITY NOT NULL,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  category text,
  title text,
  date text,
  chapter_id numeric,
  association_id numeric,
  CONSTRAINT ucoming_events_pkey PRIMARY KEY (id)
);
CREATE TABLE public.user_access_assignments (
  id integer NOT NULL DEFAULT nextval('user_access_assignments_id_seq'::regclass),
  userid integer NOT NULL,
  faculty_name text,
  department_name text,
  program_name text,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  CONSTRAINT user_access_assignments_pkey PRIMARY KEY (id),
  CONSTRAINT user_access_assignments_userid_fkey FOREIGN KEY (userid) REFERENCES public.tbl_users(userid)
);