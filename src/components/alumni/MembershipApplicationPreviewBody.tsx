"use client";

import type { MembershipApplicationPreview } from "@/lib/membershipApplicationPreview";

type Props = {
  membershipId: number;
  email: string;
  application?: MembershipApplicationPreview;
};

export function MembershipApplicationPreviewBody({ membershipId, email, application }: Props) {
  const detailSections = application
    ? [
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
          title: `(c) ${application.membershipSectionTitle}`,
          rows: application.membershipRows,
        },
        ...(application.extraSectionTitle
          ? [
              {
                title: application.facilityType === "pool" ? "(d) Swimming Information" : "(c) Playing Information",
                rows: application.extraRows,
              },
            ]
          : [
              {
                title: "(d) Medical & Fitness Information",
                rows: application.extraRows,
              },
            ]),
        {
          title: application.facilityType === "gym" ? "(e) Emergency Contact" : "Emergency Contact",
          rows: application.emergencyRows,
        },
      ]
    : [];

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
            {detailSections.map((section) => (
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
                (f) Documents Checklist
              </div>
              <div className="overflow-x-auto">
                <table className="min-w-[520px] w-full text-sm">
                  <thead className="bg-white border-b border-slate-200 dark:bg-gray-800 dark:border-gray-700">
                    <tr>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 dark:text-gray-100">
                        Document
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[100px] dark:text-gray-100">
                        Submitted
                      </th>
                      <th className="text-left px-4 py-3 font-semibold text-slate-700 w-[120px] dark:text-gray-100">
                        View
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 bg-white dark:divide-gray-700 dark:bg-gray-900">
                    {(application.uploadedDocuments?.length
                      ? application.uploadedDocuments
                      : application.documentsChecklist.map((doc) => ({
                          label: doc.label,
                          filename: "",
                          url: "",
                        }))
                    ).map((doc) => {
                      const submitted =
                        application.documentsChecklist.find((item) => item.label === doc.label)?.status ??
                        (doc.url || doc.filename ? "Yes" : "No");
                      return (
                        <tr key={doc.label} className="bg-white dark:bg-gray-900">
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-900 dark:text-gray-100">{doc.label}</div>
                            {doc.filename ? (
                              <div className="mt-0.5 text-xs text-slate-600 break-all dark:text-gray-400">
                                {doc.filename}
                              </div>
                            ) : null}
                          </td>
                          <td className="px-4 py-3 text-slate-800 dark:text-gray-100">{submitted}</td>
                          <td className="px-4 py-3">
                            {doc.url ? (
                              <a
                                href={doc.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center justify-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 dark:border-gray-600 dark:bg-gray-800 dark:text-gray-100 dark:hover:bg-gray-700"
                              >
                                Open
                              </a>
                            ) : (
                              <span className="text-xs text-slate-500 dark:text-gray-400">—</span>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
            {application.declarationText ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700">
                <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:bg-gray-800 dark:text-gray-100">
                  (e) Declaration
                </div>
                <div className="px-4 py-3 text-sm text-slate-900 dark:text-gray-100">
                  {application.declarationText}
                </div>
              </div>
            ) : null}
            {application.facilityType !== "gym" ? (
              <div className="rounded-xl border border-slate-200 overflow-hidden dark:border-gray-700">
                <div className="bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-900 dark:bg-gray-800 dark:text-gray-100">
                  Review and Approval
                </div>
                <div className="grid sm:grid-cols-2 gap-4 p-4">
                  <div className="min-h-20 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    Reviewed By (ARO)
                  </div>
                  <div className="min-h-20 rounded-lg border border-slate-200 bg-white p-3 text-sm font-semibold text-slate-700 dark:border-gray-700 dark:bg-gray-900 dark:text-gray-200">
                    Approved By (Competent Authority)
                  </div>
                </div>
              </div>
            ) : null}
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
