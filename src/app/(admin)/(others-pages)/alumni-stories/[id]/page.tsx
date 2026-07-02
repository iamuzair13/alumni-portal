import AdminStoryDetailClient from "./AdminStoryDetailClient";

export default async function AdminStoryDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <AdminStoryDetailClient id={id} />;
}
