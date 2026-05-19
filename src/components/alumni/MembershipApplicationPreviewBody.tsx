"use client";

import type { MembershipApplicationPreview } from "@/lib/membershipApplicationPreview";

type Props = {
  membershipId: number;
  email: string;
  application?: MembershipApplicationPreview;
};

export function MembershipApplicationPreviewBody({ membershipId, email, application }: Props) {
  return (
    <div className="space-y-6 max-h-[75vh] overflow-y-auto pr-2">
      <div className="text-sm text-gray-700 dark:text-gray-300">
        <span className="font-semibold">Email:</span> {email || "-"}
      </div>

      {application ? (
        <div className="rounded-2xl border border-gray-200 bg-white p-6 sm:p-8 text-gray-900 shadow-sm dark:border-gray-700 dark:bg-gray-900 dark:text-gray-100">
          <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3 border-b border-gray-200 pb-4 mb-6 dark:border-gray-700">
            <div className="min-w-0">
              <h4 className="text-xl font-extrabold tracking-tight text-slate-900 dark:text-gray-100">
                {application.title}
              </h4>
              <div className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                Applicant:{" "}
                <span className="font-semibold text-slate-800 dark:text-gray-100">
                  {application.studentName || "-"}
                </span>
              </div>
              {application.applicationRef && (
                <div className="mt-1 text-sm text-slate-600 dark:text-gray-300">
                  Application ID:{" "}
                  <span className="font-semibold">{application.applicationRef}</span>
                </div>
              )}
            </div>
            <div className="text-sm text-slate-700 whitespace-nowrap dark:text-gray-300">
              Date: <span className="font-semibold">{application.dateFormatted}</span>
            </div>
          </div>

          <div className="space-y-6">
            {(
              [
                {
                  title: "(a) Alumni Personal Details",
                  rows: [
                    ["Name", application.studentName],
                    ["Father's Name", application.fatherName],
                    ["DOB", application.dob],
                    ["CNIC", application.cnic],
                  ],
                },
                {
                  title: "(b) Alumni Education Details",
                  rows: [
                    ["Campus", application.campus],
                    ["Faculty", application.faculty],
                    ["Department", application.department],
                    ["Program", application.program],
                    ["SAP ID", application.sapCode],
                    ["CGPA", application.cgpa],
                    ["Passing Out Year", application.passingOutYear],
                  ],
                },
                {
                  title: "(c) Membership Details",
                  rows: [
                    ["Applying For", application.applyingFor],
                    ["Discount Type", application.discountType],
                    ["Membership Type", application.membershipType],
                    ["Membership Start Date", application.membershipStartDate],
                    ["Preferred Timing", application.preferredTiming],
                  ],
                },
                {
                  title: "(d) Medical & Fitness Information",
                  rows: [
                    ["Medical Conditions", application.medicalConditions],
                    ["Allergies", application.allergies],
                    ["Physical Disability", application.physicalDisability],
                  ],
                },
                {
                  title: "(e) Emergency Contact",
                  rows: [
                    ["Contact Name", application.emergencyContactName],
                    ["Relationship", application.emergencyContactRelationship],
                    ["Contact Number", application.emergencyContactNumber],
                  ],
                },
                {
                  title: "(f) Documents Checklist",
                  rows: [
                    ["Alumni Card", application.documentsChecklist.alumniCard],
                    ["CNIC", application.documentsChecklist.cnic],
                  ],
                },
              ] as const
            ).map((section) => (
              <div
                key={section.title}
                className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700"
              >
                <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:bg-gray-800 dark:text-gray-100">
                  {section.title}
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-sm">
                    <tbody className="divide-y divide-slate-200 dark:divide-gray-700">
                      {section.rows.map(([k, v]) => (
                        <tr key={k} className="bg-white dark:bg-gray-900">
                          <td className="w-[260px] px-4 py-3 font-semibold text-slate-800 bg-slate-50/60 dark:bg-gray-800 dark:text-gray-100">
                            {k}
                          </td>
                          <td className="px-4 py-3 text-slate-900 dark:text-gray-100">{String(v || "-")}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ))}

            <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700">
              <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:bg-gray-800 dark:text-gray-100">
                Review & Approval
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-0 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 dark:divide-gray-700">
                <div className="p-6 min-h-[120px] text-sm font-semibold text-slate-800 dark:text-gray-100">
                  Reviewed By (ARO):
                </div>
                <div className="p-6 min-h-[120px] text-sm font-semibold text-slate-800 dark:text-gray-100">
                  Approved By (Competent Authority):
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="w-full border border-gray-200 rounded-lg overflow-hidden bg-white dark:border-gray-700 dark:bg-gray-900">
          <iframe
            title={`membership-application-${membershipId}`}
            src={`/api/alumni/memberships/${membershipId}?mode=form-pdf`}
            className="w-full h-[70vh]"
          />
        </div>
      )}
    </div>
  );
}
