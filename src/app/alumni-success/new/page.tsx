import ComponentCard from "@/components/common/ComponentCard";
import AlumniSuccessForm from "@/components/forms/alumni-success";
import { sql } from "@/lib/dbconnect";
import { auth } from "@/lib/auth";

export default async function Page() {
  const session = await auth();
  const email = session?.user?.email ? String(session.user.email) : undefined;
  if (!email) {
    return (
      <ComponentCard title="Success Story">
        <div className="text-sm text-red-600">You must be logged in to submit a success story.</div>
      </ComponentCard>
    );
  }
  const rows = await sql/* sql */`
    SELECT sapid, alumniname, facultyname, departmentname, personalemail, officialemail, universityemail
    FROM public.tbl_alumni 
    WHERE personalemail = ${email} OR officialemail = ${email} OR universityemail = ${email}
    ORDER BY alumniid DESC LIMIT 1`;
  const r = rows[0] as {
    sapid: string | null;
    alumniname: string | null;
    facultyname: string | null;
    departmentname: string | null;
    personalemail: string | null;
    officialemail: string | null;
    universityemail: string | null;
  } | undefined;
  const sapId = String(r?.sapid ?? "");
  const name = String(r?.alumniname ?? session?.user?.name ?? "");
  const emailResolved = String(r?.personalemail ?? r?.officialemail ?? r?.universityemail ?? email);
  const faculty = String(r?.facultyname ?? "");
  const department = String(r?.departmentname ?? "");

  return (
    <ComponentCard title="Submit Your Success Story">
      <AlumniSuccessForm sapId={sapId} name={name} email={emailResolved} faculty={faculty} department={department} />
    </ComponentCard>
  );
}