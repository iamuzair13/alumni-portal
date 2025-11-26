import ComponentCard from "@/components/common/ComponentCard";

export default function AdminPage() {
  return (
    <ComponentCard title="Admin" className="">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-800 dark:bg-white/[0.03]">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white/90 mb-2">Admin Dashboard</h2>
          <p className="text-sm text-gray-600 dark:text-gray-400">This page is under construction.</p>
        </div>
      </div>
    </ComponentCard>
  );
}