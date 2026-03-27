"use client";

import { ChangeEvent, FormEvent, useEffect, useMemo, useRef, useState } from "react";
import { Roboto } from "next/font/google";
import html2canvas from "html2canvas";
import JsBarcode from "jsbarcode";
import jsPDF from "jspdf";

import backTemplate from "./card-layout/UOL-Alumni-Card-Artworks-Revised-Curve-png-back.png";
import frontTemplate from "./card-layout/alumni-card-front.jpg";

type FormState = {
  studentName: string;
  department: string;
  faculty: string;
  alumniId: string;
  validity: string;
};

const ACCESS_PIN = "2374";


const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700"],
});

const normalizeOklab = (value: string) =>
  value.includes("oklab")
    ? value.replace(/oklab\([^)]*\)/g, "rgba(0, 0, 0, 0.12)")
    : value;

const patchGetComputedStyle = () => {
  if (typeof window === "undefined") return undefined;

  const original = window.getComputedStyle;

  window.getComputedStyle = function getComputedStylePatched(...args) {
    const style = original.apply(window, args);

    return new Proxy(style, {
      get(target, prop, receiver) {
        if (typeof prop === "symbol") {
          return Reflect.get(target, prop, receiver);
        }

        if (prop === "getPropertyValue") {
          return (name: string) => normalizeOklab(target.getPropertyValue(name));
        }

        const value = Reflect.get(target, prop);
        if (typeof value === "string") {
          return normalizeOklab(value);
        }

        if (typeof value === "function") {
          return value.bind(target);
        }

        return value;
      },
    });
  } as typeof window.getComputedStyle;

  return () => {
    window.getComputedStyle = original;
  };
};

export default function Home() {
  const [formData, setFormData] = useState<FormState>({
    studentName: "",
    department: "",
    faculty: "",
    alumniId: "",
    validity: "",
  });
  const [photoPreview, setPhotoPreview] = useState<string>("");
  const [isGenerating, setIsGenerating] = useState(false);
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinValue, setPinValue] = useState("");
  const [pinError, setPinError] = useState("");

  const previewRef = useRef<HTMLDivElement>(null);
  const barcodeRef = useRef<SVGSVGElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const alumniInfoRef = useRef<HTMLDivElement>(null);

  const formattedValidity = useMemo(() => {
    if (!formData.validity) return "MM/YYYY";

    const date = new Date(`${formData.validity}-01T00:00:00`);
    if (Number.isNaN(date.getTime())) return formData.validity;

    const month = String(date.getMonth() + 1).padStart(2, "0");
    const year = date.getFullYear();

    return `${month}/${year}`;
  }, [formData.validity]);

  useEffect(() => {
    if (!barcodeRef.current) return;

    const value = formData.alumniId.trim() || "00000000";
    try {
      JsBarcode(barcodeRef.current, value, {
        format: "CODE128B",
        displayValue: false,
        lineColor: "#000",
        background: "transparent",
        height: 140,
        width: 3.5,
        margin: 0,
      });
    } catch (error) {
      // jsbarcode throws for unsupported values; ignore and clear barcode
      barcodeRef.current.innerHTML = "";
    }
  }, [formData.alumniId]);

  useEffect(() => {
    return () => {
      if (photoPreview) {
        URL.revokeObjectURL(photoPreview);
      }
    };
  }, [photoPreview]);

  const handleInputChange = (
    event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
  ) => {
    const { name, value } = event.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handlePhotoUpload = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const objectUrl = URL.createObjectURL(file);
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return objectUrl;
    });
  };

  const handleDownloadPdf = async () => {
    if (!previewRef.current || isGenerating) return;

    const restoreGetComputedStyle = patchGetComputedStyle();
    let originalAlumniTransform: string | null = null;

    try {
      setIsGenerating(true);
      if (alumniInfoRef.current) {
        originalAlumniTransform = alumniInfoRef.current.style.transform;
        alumniInfoRef.current.style.transform = "translateY(-6px)";
      }
      const canvas = await html2canvas(previewRef.current, {
        scale: 2,
        backgroundColor: "#ffffff",
      });

      const imageData = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: canvas.width >= canvas.height ? "landscape" : "portrait",
        unit: "pt",
        format: [canvas.width, canvas.height],
      });

      pdf.addImage(imageData, "PNG", 0, 0, canvas.width, canvas.height);
      const filename = `${(formData.studentName || "alumni-card").replace(/\s+/g, "-")}.pdf`;
      pdf.save(filename.toLowerCase());
    } finally {
      if (alumniInfoRef.current) {
        alumniInfoRef.current.style.transform =
          originalAlumniTransform ?? "";
      }
      if (restoreGetComputedStyle) {
        restoreGetComputedStyle();
      }
      setIsGenerating(false);
    }
  };

  const handleResetPhoto = () => {
    setPhotoPreview((prev) => {
      if (prev) URL.revokeObjectURL(prev);
      return "";
    });
    if (photoInputRef.current) {
      photoInputRef.current.value = "";
    }
  };

  const handlePinSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (pinValue.trim() === ACCESS_PIN) {
      setIsAuthorized(true);
      setPinError("");
      setPinValue("");
      return;
    }

    setPinError("Incorrect PIN. Please try again.");
  };

  if (!isAuthorized) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#0f7a3a]">
        <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-2xl">
          <h1 className="text-2xl font-semibold text-[#0f7a3a]">Secure Access</h1>
          <p className="mt-2 text-sm text-[#0f7a3acc]">
            Enter the authorized PIN to continue to the Alumni Card Generator.
          </p>

          <form onSubmit={handlePinSubmit} className="mt-6 flex flex-col gap-4">
            <input
              type="password"
              inputMode="numeric"
              autoComplete="off"
              value={pinValue}
              onChange={(event) => setPinValue(event.target.value)}
              placeholder="Enter PIN"
              className="rounded-xl border border-[#0f7a3a33] bg-white px-4 py-3 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
            />

            {pinError && (
              <p className="text-sm font-medium text-red-600">{pinError}</p>
            )}

            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-2xl bg-[#0f7a3a] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#0d6a32]"
            >
              Unlock Workspace
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className={`${roboto.className} min-h-screen bg-[#f2f8f4] pb-16 pt-12 text-[#0f7a3a]`}>
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10 px-6 lg:flex-row">
        <section className="w-full rounded-3xl bg-white/90 p-8 shadow-lg shadow-emerald-900/5 lg:max-w-sm">
          <header className="mb-6">
            <h1 className="text-3xl font-semibold tracking-tight">
              Alumni Card Generator
            </h1>
            <p className="mt-2 text-sm text-[#0f7a3acc]">
              Fill in the graduate details, upload a portrait, and export the
              designed card as a PDF.
            </p>
          </header>

          <form className="flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm font-medium">
              Student Name
              <input
                type="text"
                name="studentName"
                value={formData.studentName}
                onChange={handleInputChange}
                className="rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Department
              <input
                type="text"
                name="department"
                value={formData.department}
                onChange={handleInputChange}
                className="rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Faculty
              <input
                type="text"
                name="faculty"
                value={formData.faculty}
                onChange={handleInputChange}
                className="rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Alumni ID
              <input
                type="text"
                name="alumniId"
                value={formData.alumniId}
                onChange={handleInputChange}
                className="rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
              />
            </label>

            <label className="flex flex-col gap-2 text-sm font-medium">
              Validity
              <input
                type="month"
                name="validity"
                value={formData.validity}
                onChange={handleInputChange}
                className="rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-base text-[#0f7a3a] placeholder:text-[#0f7a3a66] focus:border-[#0f7a3a] focus:outline-none focus:ring-2 focus:ring-[#0f7a3a33]"
              />
            </label>

           

            <label className="flex flex-col gap-2 text-sm font-medium">
              Portrait
              <div className="flex items-center gap-3">
                <input
                  ref={photoInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handlePhotoUpload}
                  className="w-full rounded-xl border border-[#0f7a3a33] bg-white px-3 py-2 text-[#0f7a3a] file:mr-4 file:rounded-lg file:border-0 file:bg-[#0f7a3a] file:px-4 file:py-2 file:text-sm file:font-medium file:text-white hover:file:bg-[#0d6a32]"
                />
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleResetPhoto}
                    className="rounded-full border border-[#0f7a3a33] px-3 py-2 text-xs font-semibold text-[#0f7a3a] transition hover:border-[#0f7a3a] hover:text-[#0d6a32]"
                  >
                    Clear
                  </button>
                )}
              </div>
            </label>

            <button
              type="button"
              onClick={handleDownloadPdf}
              disabled={isGenerating}
              className="mt-2 inline-flex items-center justify-center rounded-2xl bg-[#0f7a3a] px-4 py-3 text-base font-semibold text-white transition hover:bg-[#0d6a32] disabled:cursor-not-allowed disabled:bg-[#0f7a3a99]"
            >
              {isGenerating ? "Preparing PDF..." : "Download PDF"}
            </button>
          </form>
        </section>

        <section className="flex w-full flex-1 flex-col items-center gap-8">
          <div className="w-full rounded-3xl bg-white/80 p-8 shadow-xl shadow-emerald-900/10">
            <h2 className="text-2xl font-semibold tracking-tight">
              Live Preview
            </h2>
            <p className="mt-1 text-sm text-[#0f7a3acc]">
              Update the form to see both sides of the card. All typography is
              styled in institutional green to match the provided layout.
            </p>
          </div>

          <div
            ref={previewRef}
            className="flex w-full flex-col items-center gap-10 rounded-3xl bg-white/70 p-10 shadow-xl shadow-emerald-900/10"
          >
            <div className="relative aspect-7/4 w-full max-w-[550px] overflow-hidden rounded-3xl">
              <img
                src={frontTemplate.src as string}
                alt="Alumni card front template"
                width={550}
                height={740}
                className="object-cover"
              />

              <div className="absolute left-6 right-[40%] top-18 flex flex-col gap-2 text-[15px] leading-tight text-[#0f7a3a]">
                <span className="text-lg font-semibold  tracking-tight">
                  {formData.studentName || "Shan Muhammad"}
                </span>
                <span className="font-semibold text-lg leading-tight">
                  {formData.department || "Department of Computer Science"}
                </span>
                <span className="font-semibold text-medium">
                  {formData.faculty || "Faculty of Computer Science and Engineering"}
                </span>
              </div>

              <div
                ref={alumniInfoRef}
                className="absolute bottom-[87px] left-28 flex flex-col text-sm font-medium text-[#0f7a3a]"
              >
                <span>
                   {formData.alumniId || "UOL-AL-0000"}
                </span>
                <span>{formattedValidity}</span>
              </div>

              <div className="absolute right-[42px] top-[50px] flex h-[214px] w-[158px] items-center justify-center overflow-hidden ">
              
                  <img
                    src={photoPreview || ""}
                    alt={formData.studentName || "Student"}
                    width={150}
                    height={195}
                    className="h-full w-full object-cover"
                  />
              
              </div>
            </div>

            <div className="relative aspect-7/4 w-full max-w-[520px] overflow-hidden rounded-3xl">
              <img
                src={backTemplate.src}
                alt="Alumni card back template"
                width={520}
                height={740}
                className="object-cover"
              />

              <div
                className="absolute -right-[120px] top-[119px] flex h-[60px] w-[300px] items-stretch bg-white"
                style={{
                  transform: "rotate(90deg)",
                  transformOrigin: "center",
                  paddingTop: "4px",
                  paddingBottom: "4px",
                }}
              >
                <svg
                  ref={barcodeRef}
                  className="h-full w-full origin-center"
                />
              </div>

          
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
