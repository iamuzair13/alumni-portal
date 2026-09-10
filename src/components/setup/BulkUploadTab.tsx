"use client";

import React, { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import BulkUploadStaffModal from "@/components/alumni/BulkUploadStaffModal";
import { useAlumniListPaginated } from "@/app/queries/fetch-alumni";
import { useAlumniFaculties } from "@/app/queries/fetch-alumni-faculties";
import { useAlumniDepartments } from "@/app/queries/fetch-alumni-departments";
import { useAlumniPrograms } from "@/app/queries/fetch-alumni-programs";
import type { AlumniFilterOption } from "@/app/queries/fetch-alumni-faculties";

/**
 * Full-page Bulk Upload tab for the Setup page.
 * Renders the BulkUploadStaffModal inline (always open) so it functions as a
 * page rather than a modal dialog. Only accessible by superadmins.
 */
export default function BulkUploadTab() {
  const queryClient = useQueryClient();
  const [resetKey, setResetKey] = useState(0);

  // Fetch all alumni for duplicate detection (enabled immediately since this is a dedicated page)
  const { data: bulkData } = useAlumniListPaginated(
    undefined,
    1,
    100000,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    undefined,
    { enabled: true }
  );

  // Fetch filter options for mapping
  const { data: alumniFacultiesData } = useAlumniFaculties();
  const { data: alumniDepartmentsData } = useAlumniDepartments();
  const { data: alumniProgramsData } = useAlumniPrograms();

  const facultyOptions: AlumniFilterOption[] = alumniFacultiesData?.faculties ?? [];
  const departmentOptions: AlumniFilterOption[] = alumniDepartmentsData?.departments ?? [];
  const programOptions: AlumniFilterOption[] = alumniProgramsData?.programs ?? [];

  return (
    <div className="mt-6">
      <BulkUploadStaffModal
        key={resetKey}
        isOpen={true}
        inline={true}
        onClose={() => {
          setResetKey((k) => k + 1);
        }}
        staffRows={bulkData?.items ?? []}
        facultyOptions={facultyOptions}
        departmentOptions={departmentOptions}
        programOptions={programOptions}
        onSaved={async () => {
          await queryClient.invalidateQueries({ queryKey: ["alumnilist"], exact: false });
        }}
      />
    </div>
  );
}
