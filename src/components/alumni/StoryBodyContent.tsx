import { sanitizeStoryHtml } from "@/lib/sanitizeStoryHtml";

type Props = {
  html: string;
  className?: string;
};

export default function StoryBodyContent({ html, className = "" }: Props) {
  const safeHtml = sanitizeStoryHtml(html);
  if (!safeHtml.trim()) {
    return <p className="text-slate-500 text-sm">No story content available.</p>;
  }
  return (
    <div
      className={`story-body text-slate-700 leading-relaxed dark:text-gray-300 ${className}`}
      dangerouslySetInnerHTML={{ __html: safeHtml }}
    />
  );
}
