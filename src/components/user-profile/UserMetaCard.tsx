"use client";
import React, { useMemo, useState } from "react";
import { useModal } from "../../hooks/useModal";
import { Modal } from "../ui/modal";
import Button from "../ui/button/Button";
import Input from "../form/input/InputField";
import Label from "../form/Label";
import Image from "next/image";
import { useAlumniProfile, useUpdateAlumniProfile } from "@/app/queries/alumni-profile";

type UserMetaCardProps = { sapid: string };

export default function UserMetaCard({ sapid }: UserMetaCardProps) {
  const { isOpen, openModal, closeModal } = useModal();
  const { data, isLoading, error } = useAlumniProfile(sapid);
  const updateMut = useUpdateAlumniProfile(sapid);

  const [formName, setFormName] = useState<string>("");
  const [formDesignation, setFormDesignation] = useState<string>("");
  const [formHomeCity, setFormHomeCity] = useState<string>("");
  const [formHomeCountry, setFormHomeCountry] = useState<string>("");

  const safeName = useMemo(() => data?.name ?? "-", [data]);
  const safeDesignation = useMemo(() => data?.designation ?? "-", [data]);
  const safeLocation = useMemo(() => {
    const c = data?.homeCity ?? "-";
    const co = data?.homeCountry ?? "-";
    return `${c}, ${co}`;
  }, [data]);

  const handleOpenEdit = () => {
    if (!sapid) {
      // Guard against missing sapid: do not open modal
      return;
    }
    setFormName(data?.name ?? "");
    setFormDesignation(data?.designation ?? "");
    setFormHomeCity(data?.homeCity ?? "");
    setFormHomeCountry(data?.homeCountry ?? "Pakistan");
    openModal();
  };

  const handleSave = async () => {
    if (!data) return closeModal();
    await updateMut.mutateAsync({
      ...data,
      name: formName || data.name,
      designation: formDesignation || data.designation,
      homeCity: formHomeCity || data.homeCity,
      homeCountry: (formHomeCountry as "United Kingdom" | "Pakistan" | "France" | "China" | "Canada" | "Saudi Arabia" | "Germany" | "United States" | "United Arab Emirates" | "Australia") || data.homeCountry,
    });
    closeModal();
  };

  return (
    <>
      <section
        aria-labelledby="user-meta-heading"
        className="p-5  rounded-2xl bg-white/90 backdrop-blur-sm shadow-sm dark:border-gray-800 dark:bg-white/[0.03] lg:p-6"
      >
        <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex flex-col items-center w-full gap-6 xl:flex-row">
            <div className="order-3 xl:order-2">
              {isLoading ? (
                <div className="h-6 w-48 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
              ) : error ? (
                <h4 className="mb-2 text-sm font-medium text-rose-600 xl:text-left" role="status">Failed to load</h4>
              ) : (
                <h4
                  id="user-meta-heading"
                  className="mb-2 text-[30px] font-semibold text-center text-gray-900 tracking-tight dark:text-white/90 xl:text-left"
                >
                  {safeName}
                </h4>
              )}
              <div className="flex flex-col items-center gap-1 text-center xl:flex-row xl:gap-3 xl:text-left">
                {isLoading ? (
                  <div className="h-5 w-24 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
                ) : (
                  <p className="text-lg text-gray-600 dark:text-gray-400" aria-live="polite">
                    {safeDesignation}
                  </p>
                )}
                <div className="hidden h-3.5 w-px bg-gray-300 dark:bg-gray-700 xl:block"></div>
                {isLoading ? (
                  <div className="h-5 w-40 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
                ) : (
                  <p className="text-lg text-gray-600 dark:text-gray-400" aria-live="polite">
                    {safeLocation}
                  </p>
                )}
              </div>
            </div>
          </div>
          <button
            onClick={handleOpenEdit}
            aria-label="Edit personal information"
            aria-haspopup="dialog"
            aria-controls="user-meta-edit-modal"
            className="flex w-full items-center justify-center gap-2 rounded-full border border-gray-300 bg-white px-4 py-3 text-sm font-medium text-gray-700 shadow-theme-xs transition-colors duration-150 hover:bg-gray-50 hover:text-gray-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-white dark:border-gray-700 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-white/[0.03] dark:hover:text-gray-200 dark:focus-visible:ring-gray-500 lg:inline-flex lg:w-auto"
          
          >
            <svg
              className="fill-current"
              width="18"
              height="18"
              viewBox="0 0 18 18"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                fillRule="evenodd"
                clipRule="evenodd"
                d="M15.0911 2.78206C14.2125 1.90338 12.7878 1.90338 11.9092 2.78206L4.57524 10.116C4.26682 10.4244 4.0547 10.8158 3.96468 11.2426L3.31231 14.3352C3.25997 14.5833 3.33653 14.841 3.51583 15.0203C3.69512 15.1996 3.95286 15.2761 4.20096 15.2238L7.29355 14.5714C7.72031 14.4814 8.11172 14.2693 8.42013 13.9609L15.7541 6.62695C16.6327 5.74827 16.6327 4.32365 15.7541 3.44497L15.0911 2.78206ZM12.9698 3.84272C13.2627 3.54982 13.7376 3.54982 14.0305 3.84272L14.6934 4.50563C14.9863 4.79852 14.9863 5.2734 14.6934 5.56629L14.044 6.21573L12.3204 4.49215L12.9698 3.84272ZM11.2597 5.55281L5.6359 11.1766C5.53309 11.2794 5.46238 11.4099 5.43238 11.5522L5.01758 13.5185L6.98394 13.1037C7.1262 13.0737 7.25666 13.003 7.35947 12.9002L12.9833 7.27639L11.2597 5.55281Z"
                fill=""
              />
            </svg>
            Edit
          </button>
        </div>
        {/* Details grid mapped from normalized profile data */}
        {isLoading ? (
          <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-4  lg:grid-cols-5">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="rounded-xl   bg-gray-50 p-3 shadow-xs dark:border-gray-800 dark:bg-white/[0.02]">
                <div className="h-3 w-24 bg-gray-200 animate-pulse rounded mb-2" aria-hidden="true" />
                <div className="h-4 w-48 bg-gray-200 animate-pulse rounded" aria-hidden="true" />
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="mt-6 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-800" role="alert">
            Failed to load profile details.
          </div>
        ) : (
          <dl className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {([
              ["Email", data?.personalEmail ?? "-"],
              ["Password", data?.password ?? "-"],
              ["Registration No", data?.registrationNo ?? "-"],
              ["Sap-ID", data?.sapId ?? "-"],
              ["Gender", data?.gender ?? "-"],
              ["Father Name", data?.fatherName ?? "-"],
              ["Date of Birth", data?.dob ?? "-"],
              ["Marital Status", data?.maritalStatus ?? "-"],
              ["CNIC/Passport", data?.cnicOrPassport ?? "-"],
              ["Contact No", `${data?.countryCode ?? ""} ${data?.phoneNumber ?? ""}`.trim() || "-"],
              ["Country", data?.homeCountry ?? "-"],
              ["Province", data?.province ?? "-"],
              ["City", data?.homeCity ?? "-"],
              ["Address", data?.address ?? "-"],
              ["Academic Session", "-"],
              ["Degree Title", data?.program ?? "-"],
              ["Passing Year", (data?.passingYear ?? "-").toString()],
              ["Faculty Name", data?.faculty ?? "-"],
              ["Campus Name", data?.campus ?? "-"],
              ["Department Name", data?.department ?? "-"],
              ["Industry", data?.sector ?? "-"],
              ["Employment Status", data?.employmentStatus ?? "-"],
              ["Organization Name", data?.organization ?? "-"],
              ["Designation", data?.designation ?? "-"],
              ["Total Years of Experience", (data?.totalExperienceYears ?? "-").toString()],
              ["Verified", String(data?.verified ?? false)],
              ["Data Source", data?.source ?? "-"],
              ["Alumni Status", data?.category ?? "-"],
            ] as Array<[string, string]>).map(([label, value]) => (
              <div
                key={label}
                className="rounded-xl p-3 shadow-xs transition-colors duration-150  dark:border-gray-800 dark:bg-white/[0.02] dark:hover:bg-white/[0.04]"
              >
                <dt className="mb-1 text-[16px] leading-normal  text-gray-900 dark:text-gray-400">{label}</dt>
                <dd className="text-[16px] text-gray-600 break-words dark:text-white/90">{value ?? "-"}</dd>
              </div>
            ))}
          </dl>
        )}
      </section>
      <Modal isOpen={isOpen} onClose={closeModal} className="max-w-[700px] m-4">
        <div
          id="user-meta-edit-modal"
          className="no-scrollbar relative w-full max-w-[700px] overflow-y-auto rounded-3xl bg-white p-4 shadow-lg ring-1 ring-gray-100 transition-shadow duration-150 dark:bg-gray-900 lg:p-11"
        >
          <div className="px-2 pr-14">
            <h4 className="mb-2 text-2xl font-semibold text-gray-900 tracking-tight dark:text-white/90">
              Edit Personal Information
            </h4>
            <p className="mb-6 text-sm text-gray-600 dark:text-gray-400 lg:mb-7">
              Update your details to keep your profile up-to-date.
            </p>
          </div>
          <form className="flex flex-col">
            <div className="custom-scrollbar h-[450px] overflow-y-auto px-2 pb-3">
              <div className="mt-2">
                <h5 className="mb-5 text-lg font-medium text-gray-800 dark:text-white/90 lg:mb-6">
                  Personal Information
                </h5>

                <div className="grid grid-cols-1 gap-x-6 gap-y-5 lg:grid-cols-2">
                  <div className="col-span-2 lg:col-span-1">
                    <Label>First Name</Label>
                    <Input
                      type="text"
                      value={(formName.split(" ")[0] ?? "")}
                      onChange={(e) => {
                        const last = formName.split(" ").slice(1).join(" ");
                        const first = e.target.value;
                        setFormName(`${first}${last ? ` ${last}` : ""}`);
                      }}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Last Name</Label>
                    <Input
                      type="text"
                      value={formName.split(" ").slice(1).join(" ")}
                      onChange={(e) => {
                        const first = formName.split(" ")[0] ?? "";
                        const last = e.target.value;
                        setFormName(`${first}${last ? ` ${last}` : ""}`);
                      }}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Email Address</Label>
                    <Input type="text" value={data?.personalEmail ?? ""} disabled aria-disabled="true" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Phone</Label>
                    <Input type="text" value={`${data?.countryCode ?? "+92"} ${data?.phoneNumber ?? ""}`} disabled aria-disabled="true" />
                  </div>

                  <div className="col-span-2">
                    <Label>Bio</Label>
                    <Input
                      type="text"
                      value={formDesignation}
                      onChange={(e) => setFormDesignation(e.target.value)}
                      className="focus-visible:ring-primary"
                    />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>City</Label>
                    <Input type="text" value={formHomeCity} onChange={(e) => setFormHomeCity(e.target.value)} className="focus-visible:ring-primary" />
                  </div>

                  <div className="col-span-2 lg:col-span-1">
                    <Label>Country</Label>
                    <Input type="text" value={formHomeCountry} onChange={(e) => setFormHomeCountry(e.target.value)} className="focus-visible:ring-primary" />
                  </div>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-3 px-2 mt-6 lg:justify-end">
              <Button size="sm" variant="outline" onClick={closeModal} className="focus-visible:ring-2 focus-visible:ring-primary">
                Close
              </Button>
              <Button size="sm" onClick={handleSave} disabled={updateMut.isPending} className="focus-visible:ring-2 focus-visible:ring-primary">
                Save Changes
              </Button>
            </div>
          </form>
        </div>
      </Modal>
    </>
  );
}
