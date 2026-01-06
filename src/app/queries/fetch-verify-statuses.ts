import { useQuery } from "@tanstack/react-query";

export type VerifyStatusOption = {
  key: string;
  label: string;
};

type VerifyStatusesResponse = {
  statuses: VerifyStatusOption[];
};

export function useVerifyStatuses() {
  return useQuery<VerifyStatusesResponse, Error>({
    queryKey: ["verify-statuses"],
    queryFn: async () => {
      const res = await fetch("/api/alumni/verify-statuses", {
        headers: { accept: "application/json" },
        credentials: "include",
      });

      if (!res.ok) {
        const text = await res.text().catch(() => "");
        throw new Error(text || `Failed to fetch verify statuses (${res.status})`);
      }

      return res.json();
    },
    staleTime: 5 * 60 * 1000,
  });
}


