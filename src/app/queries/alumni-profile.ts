"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getAlumniBySapId, updateAlumniBySapId } from "@/services/alumniService";
import type { AlumniRegistrationComprehensiveForm } from "@/lib/alumniRegistration";

export const alumniProfileKey = (sapId: string | undefined) => ["alumni", "profile", sapId ?? ""];

export async function getAlumniProfile(sapId: string, ): Promise<AlumniRegistrationComprehensiveForm> {
  const res = await getAlumniBySapId(sapId);
  return res.item as AlumniRegistrationComprehensiveForm;
}

export function useAlumniProfile(sapId: string | undefined) {
  return useQuery({
    queryKey: alumniProfileKey(sapId),
    queryFn: ({ signal }) => {
      if (!sapId) throw new Error("Missing sapid");
      return getAlumniProfile(sapId );
      console.log(signal);
      
    },
    enabled: !!sapId,
    staleTime: 5 * 60 * 1000, // 5 minutes
    refetchOnWindowFocus: false,
  });
}

export function useUpdateAlumniProfile(sapId: string | undefined) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (payload: AlumniRegistrationComprehensiveForm) => {
      if (!sapId) throw new Error("Missing sapid");
      return updateAlumniBySapId(sapId, payload);
    },
    onMutate: async (next) => {
      const key = alumniProfileKey(sapId);
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<AlumniRegistrationComprehensiveForm>(key);
      qc.setQueryData<AlumniRegistrationComprehensiveForm>(key, (cur) => ({ ...(cur ?? next), ...next }));
      return { prev } as { prev?: AlumniRegistrationComprehensiveForm };
    },
    onError: (_err, _vars, ctx) => {
      const key = alumniProfileKey(sapId);
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
    },
    onSuccess: () => {
      const key = alumniProfileKey(sapId);
      qc.invalidateQueries({ queryKey: key });
    },
  });
}