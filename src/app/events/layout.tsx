import AlumniHeader from "@/components/alumni/AlumniHeader";

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <AlumniHeader />
      <main id="main-content" className="min-w-0">
        {children}
      </main>
    </>
  );
}
