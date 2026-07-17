import AlumniSqlForm from "@/components/forms/AlumniSqlForm";

export default function AlumniRegistrationPage() {
  return (
    <div className="min-h-screen w-full bg-white dark:bg-gray-950">
      <div className="max-w-5xl mx-auto px-4 py-6 sm:py-8">
        <AlumniSqlForm excludeAdminStep={true} />
      </div>
    </div>
  );
}
