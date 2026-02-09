import { z } from "zod";

export const provinces = [
  "Punjab",
  "Sindh",
  "Khyber Pakhtunkhwa",
  "Balochistan",
  "Islamabad Capital Territory",
  "Azad Jammu & Kashmir",
  "Gilgit-Baltistan",
] as const;

export const countries = [
  "Pakistan",
  "United States",
  "United Kingdom",
  "Canada",
  "United Arab Emirates",
  "Saudi Arabia",
  "China",
  "Germany",
  "France",
  "Australia",
] as const;

const genderValues = ["Male", "Female", "Other"] as const;
const maritalValues = ["Married", "Un-Married"] as const;
const employmentValues = ["Employed", "Unemployed"] as const;

export const cnicRegex = /^\d{5}-\d{7}-\d$/;
export const passportRegex = /^[A-Za-z0-9]{6,20}$/;
export const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
export const sapIdNumericRegex = /^\d{4,20}$/;
export const phoneRegex = /^\d{7,15}$/; // local part digits length
export const countryCodeRegex = /^\+\d{1,3}$/;

export const passwordStrength = (pwd: string) => {
  const len = pwd.length >= 8;
  const upper = /[A-Z]/.test(pwd);
  const lower = /[a-z]/.test(pwd);
  const num = /\d/.test(pwd);
  const special = /[^A-Za-z0-9]/.test(pwd);
  const score = [len, upper, lower, num, special].filter(Boolean).length;
  return { len, upper, lower, num, special, score };
};

export const generateRegistrationNo = (): string => {
  const now = new Date();
  const pad = (n: number) => n.toString().padStart(2, "0");
  const id = `${now.getFullYear()}${pad(now.getMonth() + 1)}${pad(now.getDate())}${pad(now.getHours())}${pad(now.getMinutes())}${pad(now.getSeconds())}`;
  const rand = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `REG-${id}-${rand}`;
};

export const alumniRegistrationSchema = z.object({
  registrationNo: z
    .preprocess((v) => {
      if (typeof v !== "string" || v.trim() === "") return undefined;
      return v;
    }, z.string().optional())
    .transform((v) => v ?? generateRegistrationNo()),
  sapId: z.string().trim().regex(sapIdNumericRegex, "SAP ID must be numeric and 4–20 digits."),
  name: z.string().trim().min(1, "Name is required"),
  fatherName: z.string().trim().optional().or(z.literal("")),
  gender: z.enum(genderValues),
  dob: z.string().trim().optional().or(z.literal("")),
  maritalStatus: z.enum(maritalValues).optional().or(z.literal("")),

  cnicOrPassport: z.string().trim().min(1, "CNIC/Passport is required"),
  countryCode: z.string().trim().regex(countryCodeRegex, "Country code must be like +92"),
  phoneNumber: z.string().trim().regex(phoneRegex, "Phone number must be 7–15 digits"),
  personalEmail: z.string().trim().regex(emailRegex, "Enter a valid email address"),
  password: z.string().min(8, "Password must be at least 8 characters"),

  address: z.string().trim().optional().or(z.literal("")),
  province: z.enum(provinces).optional(),
  homeCity: z.string().trim().min(1, "Home City is required"),
  homeCountry: z.enum(countries).default("Pakistan"),
}).superRefine((val, ctx) => {
  // Country-specific ID validation
  if (val.homeCountry === "Pakistan") {
    if (!cnicRegex.test(val.cnicOrPassport)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cnicOrPassport"],
        message: "CNIC must be in format 12345-1234567-1",
      });
    }
  } else {
    if (!passportRegex.test(val.cnicOrPassport)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["cnicOrPassport"],
        message: "Passport must be 6–20 alphanumeric characters",
      });
    }
  }
});

export type AlumniRegistrationForm = z.infer<typeof alumniRegistrationSchema>;

// Comprehensive schema with Academic, Employment, and Administrative sections
export const alumniRegistrationComprehensiveSchema = alumniRegistrationSchema
  .and(z.object({
    // Academic Information
    campus: z.string().trim().min(1, "Campus is required"),
    faculty: z.string().trim().min(1, "Faculty is required"),
    department: z.string().trim().min(1, "Department is required"),
    program: z.string().trim().min(1, "Program is required"),
    passingYear: z
      .string()
      .trim()
      .regex(/^\d{4}$/i, "Year must be YYYY")
      .transform((y) => Number(y)),

    // Employment Information
    employmentStatus: z.enum(employmentValues).default("Unemployed"),
    sector: z.string().trim().optional(),
    subSector: z.string().trim().optional(),
    organization: z.string().trim().optional(),
    designation: z.string().trim().optional(),
    totalExperienceYears: z
      .string()
      .trim()
      .regex(/^\d+(\.\d+)?$/i, "Experience must be numeric")
      .optional()
      .transform((v) => (v === undefined ? undefined : Number(v))),
    officialEmail: z.string().trim().regex(emailRegex, "Enter a valid email address").optional(),
    officialPhone: z.string().trim().regex(phoneRegex, "Phone must be 7–15 digits").optional(),
    workCity: z.string().trim().optional(),
    workCountry: z.enum(countries).optional(),

    // Administrative
    source: z.string().trim().optional(),
    verified: z.boolean().default(false),
    category: z.string().trim().optional(),
  }))
  .superRefine((val, ctx) => {
    if (val.employmentStatus === "Employed") {
      const requiredEmployed: Array<keyof typeof val> = [
        "sector",
        "subSector",
        "organization",
        "designation",
        "totalExperienceYears",
        "officialEmail",
        "officialPhone",
        "workCity",
        "workCountry",
      ];
      requiredEmployed.forEach((key) => {
        if (!val[key]) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: [key as string], message: "Field is required for employed" });
        }
      });
    }
  });

export type AlumniRegistrationComprehensiveForm = z.infer<typeof alumniRegistrationComprehensiveSchema>;