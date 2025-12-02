-- WARNING: This schema is for context only and is not meant to be run.
-- Table order and constraints may not be valid for execution.

CREATE TABLE public.alumni_chapter (
  id integer GENERATED ALWAYS AS IDENTITY NOT NULL,
  chapter1 numeric,
  chapter2 numeric,
  chapter3 numeric,
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
CREATE TABLE public.tbl_alumni (
  alumniid integer NOT NULL DEFAULT nextval('tbl_alumni_alumniid_seq'::regclass),
  alumniemail character varying NOT NULL,
  password text,
  todaydate timestamp without time zone,
  registrationno character varying,
  sapid character varying,
  alumniname character varying,
  gender character varying,
  fathername character varying,
  dateofbirth character varying,
  maritalstatus character varying,
  cnicpassport character varying,
  contactno character varying,
  contactno1 character varying,
  contactno1show text,
  personalemail character varying,
  personalemailshow text,
  universityemail character varying,
  country character varying,
  province character varying,
  city character varying,
  address character varying,
  academicsession character varying,
  degreetitle character varying,
  cgpa double precision,
  yearofstarting integer,
  yearofending integer,
  facultyname character varying,
  campusname character varying,
  departmentname character varying,
  majorsubject character varying,
  industry character varying,
  employeed character varying,
  nameoforganization character varying,
  designation character varying,
  totalyearsofexpereince character varying,
  officialemail character varying,
  officialnumber character varying,
  work_city text,
  supervisordesignation character varying,
  work_country text,
  supervisornumber character varying,
  image1 character varying,
  cv character varying,
  aboutme text,
  lasttimelogin character varying,
  logincount integer,
  verify character varying,
  emailsendcount smallint,
  emailsendstatus character varying,
  createddatetime character varying,
  facebook character varying,
  instagram character varying,
  youtube character varying,
  linkedin character varying,
  datasource character varying,
  alumnistatus character varying,
  higher_education_institute_name text,
  degree_title text,
  is_scholarship text,
  higher_education_program text,
  father_cnic text,
  image2 text,
  association_id bigint,
  association_job integer,
  chapter_leadership bigint,
  CONSTRAINT tbl_alumni_pkey PRIMARY KEY (alumniid),
  CONSTRAINT tbl_alumni_association_id_fkey FOREIGN KEY (association_id) REFERENCES public.tbl_associations(id),
  CONSTRAINT tbl_alumni_association_job_fkey FOREIGN KEY (association_job) REFERENCES public.tblalumniassociation(id),
  CONSTRAINT tbl_alumni_chapter_leadership_fkey FOREIGN KEY (chapter_leadership) REFERENCES public.chapter_leadership(id)
);
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
  association text,
  parent_type text CHECK (parent_type = ANY (ARRAY['chapter'::text, 'association'::text])),
  parent_id bigint,
  CONSTRAINT tbl_events_pkey PRIMARY KEY (id)
);
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
  topic character varying,
  day character varying,
  timings character varying,
  activity character varying,
  linkedin character varying,
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