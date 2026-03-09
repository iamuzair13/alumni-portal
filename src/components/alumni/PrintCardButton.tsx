"use client";

import { DownloadIcon } from "@/icons";
import toast from "react-hot-toast";

type Props = {
  sapId: string;
  studentName: string;
  registrationNo?: string | null;
};

export default function PrintCardButton({ sapId }: Props) {
  const handleDownloadPDF = () => {
    const url = `/alumni-profile/card-print?sapid=${encodeURIComponent(sapId)}&download=1`;
    const opened = window.open(url, "_blank", "noopener,noreferrer");
    if (!opened) {
      toast.error("Please allow popups to download PDF");
      return;
    }
    toast.success("Downloading PDF...");
  };

  return (
    <>
      <button
        type="button"
        onClick={handleDownloadPDF}
        className="p-2 rounded-lg text-gray-500 dark:text-gray-400 transition-all duration-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1 hover:text-blue-600 hover:bg-gray-100 dark:hover:bg-gray-700/50 disabled:opacity-50 disabled:cursor-not-allowed"
        aria-label="Download Card PDF"
        title="Download Card PDF"
      >
        <DownloadIcon className="h-4 w-4" />
      </button>
    </>
  );
}

