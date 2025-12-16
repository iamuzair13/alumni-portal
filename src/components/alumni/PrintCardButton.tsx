"use client";

import { DownloadIcon } from "@/icons";

type Props = {
  sapId: string;
  studentName: string;
};

export default function PrintCardButton({ sapId }: Props) {
  const handlePrint = () => {
    // Open card print page in new window for preview, download, and print
    const url = `/alumni-profile/card-print?sapid=${encodeURIComponent(sapId)}`;
    const windowFeatures = "width=1200,height=900,scrollbars=yes,resizable=yes";
    window.open(url, "_blank", windowFeatures);
  };

  return (
    <button
      type="button"
      onClick={handlePrint}
      className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50"
      aria-label="Print/Export Card"
      title="Print/Export Card"
    >
      <DownloadIcon className="h-5 w-5" />
    </button>
  );
}

