# DB Value/Label Audit

This document is an inventory of UI fields that are sent to the backend and stored in the database (directly or via API mapping/normalization).

Notes:
- For **text inputs**, the stored value is whatever the user types (after trimming/cleaning on the API).
- For **select/radio inputs**, the stored value is the literal `value` string unless explicitly mapped/normalized before save.
- Some dropdowns are **dynamic** (loaded from APIs / DB tables). For those, this file lists the source endpoint and the stored value type.

---

## 1) Alumni Registration / Create (Admin) — `src/components/forms/AlumniSqlForm.tsx`

### 1.1 Personal
- **FieldKey: `registrationno`**
  - **Label:** Registration #
  - **Type:** text
- **FieldKey: `sapid`**
  - **Label:** SAP ID
  - **Type:** text
- **FieldKey: `alumniname`**
  - **Label:** Full Name
  - **Type:** text
- **FieldKey: `fathername`**
  - **Label:** Father Name
  - **Type:** text
- **FieldKey: `gender`**
  - **Label:** Gender
  - **Type:** select
  - **Options (value -> label):**
    - `""` -> Select
    - `Male` -> Male
    - `Female` -> Female
- **FieldKey: `maritalstatus`**
  - **Label:** Marital Status
  - **Type:** select
  - **Options (value -> label):**
    - `""` -> Select
    - `Married` -> Married
    - `Un-Married` -> Un-Married
- **FieldKey: `cnicpassport`**
  - **Label:** CNIC/Passport
  - **Type:** text
- **FieldKey: `contactno`**
  - **Label:** Contact #
  - **Type:** text
- **FieldKey: `contactno1`**
  - **Label:** Secondary Contact #
  - **Type:** text
- **FieldKey: `personalemail`**
  - **Label:** Personal Email
  - **Type:** email

### 1.2 Address / Location
- **FieldKey: `country`**
  - **Label:** Country
  - **Type:** select (Controller)
  - **Options:** Hardcoded list in-file (large list). Stored value is the selected country string.
- **FieldKey: `province`**
  - **Label:** Province
  - **Type:** select
  - **Options (value -> label) when country is Pakistan:**
    - `Punjab` -> Punjab
    - `Sindh` -> Sindh
    - `KPK` -> KPK
    - `Balochistan` -> Balochistan
    - `Islamabad` -> Islamabad Capital Territory
    - `GB` -> Gilgit-Baltistan
    - `AJK` -> Azad Kashmir
  - **Other countries:** `Not applicable`
- **FieldKey: `homeCity`**
  - **Label:** Home City
  - **Type:** text (search input)
  - **Value:** free text / matched city string
- **FieldKey: `homeCountry`**
  - **Label:** Home Country
  - **Type:** derived
  - **Value:** synced from `country`
- **FieldKey: `workCountry`**
  - **Label:** Work Country
  - **Type:** select/text
- **FieldKey: `workCity`**
  - **Label:** Work City
  - **Type:** select/text
- **FieldKey: `address`**
  - **Label:** Address
  - **Type:** textarea

### 1.3 Academic
- **FieldKey: `campusname`**
  - **Label:** Campus
  - **Type:** select
  - **Options (value -> label):**
    - `""` -> Select
    - `Lahore` -> Lahore
    - `Sargodha` -> Sargodha
    - `Islamabad` -> Islamabad
    - `Pakpattan` -> Pakpattan
- **FieldKey: `faculty`**
  - **Label:** Faculty
  - **Type:** select (DB-backed)
  - **Source:** `/api/organization/faculties`
  - **Stored value:** numeric id (HTML select returns string; component uses `valueAsNumber: true`)
  - **Special option:** `other` -> Other (then uses custom text fields like `facultyname`)
- **FieldKey: `department`**
  - **Label:** Department
  - **Type:** select (DB-backed)
  - **Source:** `/api/organization/departments?faculty_id=...`
  - **Stored value:** numeric id (via `valueAsNumber: true`)
  - **Special option:** `other` -> Other (then uses custom text fields like `departmentname`)
- **FieldKey: `program`**
  - **Label:** Program
  - **Type:** select (DB-backed)
  - **Source:** `/api/organization/programs?department_id=...`
  - **Stored value:** numeric id
- **FieldKey: `yearofstarting`**
  - **Label:** Admission Year
  - **Type:** select
  - **Stored value:** number
  - **Options:** generated year list (1998..current year)
- **FieldKey: `yearofending`**
  - **Label:** Passing Out Year
  - **Type:** select
  - **Stored value:** number
  - **Options:** generated year list (2000..current year)

### 1.4 Employment / Occupation
- **FieldKey: `employeed`**
  - **Label:** Employment Status
  - **Type:** radio
  - **Options (value -> label):**
    - `Employed` -> Employed
    - `Self-Employed/Enterpreneur` -> Self-Employed/Enterpreneur
    - `Pursuing Higher Education` -> Pursuing Higher Education
    - `Unemployed(By Choice)` -> Unemployed(By Choice)
    - `Unemployed(Searching for job)` -> Unemployed(Searching for job)
  - **Normalization before save (client):**
    - Legacy values `Self-Emplo`, `Self-Employed`, `Self-employed`, `Self employed` are normalized to `Self-Employed/Enterpreneur`.
    - Legacy `Employed/Business` normalized to `Employed`.
    - Legacy `highered` normalized to `Pursuing Higher Education`.
  - **Normalization before DB save (API):** also normalized in `/api/alumni/create` and `/api/alumni/[sapid]/update-fields`.

- **FieldKey: `industry`**
  - **Label:** Sector
  - **Type:** datalist/text
  - **Datalist options (value -> label):**
    - `NA` -> NA
    - `IT & Software Development` -> IT & Software Development
    - `Engineering & Manufacturing` -> Engineering & Manufacturing
    - `Finance & Banking` -> Finance & Banking
    - `Healthcare` -> Healthcare
    - `Education & Research` -> Education & Research
    - `Media & Communication` -> Media & Communication
    - `Retail & E-commerce` -> Retail & E-commerce
    - `Logistics & Supply Chain` -> Logistics & Supply Chain
    - `Textile & Fashion` -> Textile & Fashion
    - `Architecture & Planning` -> Architecture & Planning
    - `Hospitality & Tourism` -> Hospitality & Tourism
    - `NGO & Social Services` -> NGO & Social Services
    - `Government Sector` -> Government Sector
    - `Construction & Real Estate` -> Construction & Real Estate
- **FieldKey: `nameoforganization`**
  - **Label:** Current Organization / Business Name
  - **Type:** text
- **FieldKey: `designation`**
  - **Label:** Designation
  - **Type:** text
- **FieldKey: `officialemail`**
  - **Label:** Work Email / Business Email
  - **Type:** email
- **FieldKey: `officialnumber`**
  - **Label:** Work Phone / Business Phone
  - **Type:** text
- **FieldKey: `organization_address`**
  - **Label:** Work Address / Business Address
  - **Type:** textarea
- **FieldKey: `startOfCareer`**
  - **Label:** Start of Career
  - **Type:** date/year
  - **Mapping:** Converted to `totalyearsofexpereince` in client submit logic.
- **FieldKey: `totalyearsofexpereince`**
  - **Label:** Total Years of Experience
  - **Type:** derived string/number

### 1.5 Higher Education (when `employeed` = Pursuing Higher Education)
- **FieldKey: `highereducationinstitute`**
  - **Label:** Institution Name
  - **Type:** text
- **FieldKey: `highereducationprogram`**
  - **Label:** Program
  - **Type:** text
- **FieldKey: `scholarship`**
  - **Label:** Funding Source
  - **Type:** select
  - **Options (value -> label):**
    - `""` -> Select
    - `Full Scholarship` -> Full Scholarship
    - `Partial Scholarship` -> Partial Scholarship
    - `Self Paid` -> Self Paid

### 1.6 Chapters
- **FieldKey: `chapters`**
  - **Label:** Chapters
  - **Type:** multi-select (custom)
  - **Source:** `/api/chapters/list`
  - **Stored value:** array of numeric chapter ids

### 1.7 Admin/System
- **FieldKey: `verify`**
  - **Label:** Verification
  - **Type:** select (string)
  - **Stored values:** `Yes` / `No` / `underApproval` depending on flow (API also sets this)
- **FieldKey: `datasource`**
  - **Label:** Data Source
  - **Type:** text/select (varies)
- **FieldKey: `alumnistatus`**
  - **Label:** Alumni Status
  - **Type:** select

---

## 2) Admin inline edit — `src/components/alumni/AlumniExpandableDetails.tsx`

This component updates the DB via:
- `PUT /api/alumni/{sapid}/update-fields`

### 2.1 Select fields with explicit options
- **FieldKey: `gender`**
  - **Label:** Gender
  - **Options:** `""` Select, `Male`, `Female`
- **FieldKey: `maritalstatus`**
  - **Label:** Marital Status
  - **Options:** `""` Select, `Married`, `Un-Married`
- **FieldKey: `campusname`**
  - **Label:** Campus
  - **Options:** `""` Select, `Lahore`, `Sargodha`, `Islamabad`, `Pakpattan`
- **FieldKey: `employeed`**
  - **Label:** Occupation Status
  - **Options:**
    - `""` -> Select
    - `Employed` -> Employed
    - `Self-Employed/Enterpreneur` -> Self-Employed/Enterpreneur
    - `Unemployed(By Choice)` -> Unemployed(By Choice)
    - `Unemployed(Searching for job)` -> Unemployed (Searching for Job)
    - `Pursuing Higher Education` -> Pursuing Higher Education
- **FieldKey: `is_scholarship`**
  - **Label:** Funding Source
  - **Options:** `""` Select, `Full Scholarship`, `Partial Scholarship`, `Self Paid`
- **FieldKey: `verify`**
  - **Label:** Verification Status
  - **Options:** `""` Select, `Verified`, `Unverified`, `On-Hold`
- **FieldKey: `alumnistatus`**
  - **Label:** Alumni Status
  - **Options:** `""` Select, `Active`, `Inactive`
- **FieldKey: `category`**
  - **Label:** Alumni Category
  - **Options:** `""` Select, `A+`, `A`, `B`, `C`, `D`

### 2.2 Dynamic selects
- **FieldKey: `country`**
  - **Label:** Home Country
  - **Options:** `allCountries` hardcoded array in-file (large list)
- **FieldKey: `province`**
  - **Label:** Home Province
  - **Options:** `provinceOptions` (Pakistan only)
- **FieldKey: `city`**
  - **Label:** Home City
  - **Type:** searchable input (Pakistan uses province city list)
- **FieldKey: `faculty`, `department`, `program`**
  - **Type:** DB-backed numeric ids (from organization APIs)
- **FieldKey: `association_id`**
  - **Type:** select
  - **Source:** `/api/associations/list`
  - **Stored value:** numeric association id

---

## 3) Alumni Profile “More Details” page — `src/app/alumni-profile/more-details/page.tsx`

This page saves edits via:
- `PUT /api/alumni/{sapid}/update-fields`

### 3.1 DB-bound fields
This page uses `EditableField` components. Stored field keys are the `fieldKey` values passed into those components.

Notable enumerations (stored values):
- **FieldKey: `employeed`**
  - **Label:** Employment Status
  - **Options:** provided by `EditableEmploymentStatus` (`src/components/ui/EditableEmploymentStatus.tsx`)
  - **Canonical stored value:** `Self-Employed/Enterpreneur`
  - **Legacy values accepted (normalized):** `self-emplo`, `self-employed`, etc.

Higher education fields enforced by validation when `employeed` is pursuing higher education:
- `higher_education_institute_name`
- `higher_education_program`
- `higher_education_institute_country`
- `higher_education_institute_city`
- `is_scholarship`

Employment fields enforced by validation when employed/business or self-employed:
- `industry`
- `nameoforganization`
- `designation`
- `startOfCareer` (special handling: derived from `totalyearsofexpereince`)
- `organization_address`

---

## 4) Other DB-writing forms (non-alumni core)

### 4.1 Jobs — `src/components/forms/JobForm.tsx`
- **Endpoint:** `POST /api/jobs` (create), `PUT /api/jobs/{id}` (update)
- **Stored payload keys:**
  - `title` (required)
  - `category` (nullable)
  - `company` (required)
  - `deadline` (nullable)
  - `location` (nullable)
  - `jobLink` (nullable)

### 4.2 Alumni Card Application — `src/components/forms/alumni-card.tsx`
- **Endpoint:** `POST /api/alumni-cards` (multipart FormData)
- **Stored keys (FormData):**
  - `alumniId`
  - `sapId`
  - `image`
  - `comment`
  - `cardaddress`
    - If user selects Deliver => address string
    - Else => literal `Collect from Campus`
  - `validity_date` (YYYY-MM-DD)
- **Enum enforced by schema:**
  - `addressPreference`: `Collect` | `Deliver`

### 4.3 Gym Membership — `src/components/forms/gym-membership.tsx`
- **Endpoint:** `POST /api/alumni/gym-membership`
- **Stored keys:** `alumniId`, `month`
- **Month options:** generated strings like `January 2026` … `December 2026` (current month + next 11)

### 4.4 Swimming Pool Membership — `src/components/forms/swimming-pool-membership.tsx`
- **Endpoint:** `POST /api/alumni/swimming-pool-membership`
- **Stored keys:** `alumniId`, `month`
- **Month options:** generated strings like `January 2026` … `December 2026` (current month + next 11)

### 4.5 Alumni Association Leadership — `src/components/forms/AlumniAssociationForm.tsx`
- **Endpoint:** `POST /api/alumni/association`
- **Stored keys:** `alumniId`, `role`
- **Role options (value -> label):**
  - `president` -> President
  - `vicePresident` -> Vice President
  - `coordinator` -> Coordinator

### 4.6 Chapter Leadership — `src/components/forms/AlumniChapterLeadershipForm.tsx`
- **Endpoint:** `POST /api/alumni/chapter-leadership`
- **Stored keys:** `alumniId`, `post`
- **Post options (value -> label):**
  - `president` -> Chapter President
  - `vicePresident` -> Chapter Vice President
  - `coordinator` -> Chapter Coordinator

### 4.7 Association Membership — `src/components/forms/AlumniAssociationMembershipForm.tsx`
- **Endpoint:** `POST /api/alumni/association-membership`
- **Stored keys:** `alumniId`, `associationId`
- **Options:** dynamic list from `/api/associations/list` (stored value numeric id)

---

## 5) Follow-up (if you want full exhaustive export)

There are additional pages/components that include select/radio options (events admin, scholarship applications, talks, newsletters, etc.). If you want, I can generate a **second file** listing those too, but they are not part of the main alumni create/update path.
