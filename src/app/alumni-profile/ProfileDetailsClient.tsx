"use client";
import Image from "next/image";
import { useAlumniProfile } from "@/app/queries/alumni-profile";

export default function ProfileDetailsClient({ sapId }: { sapId: string }) {
  const { data } = useAlumniProfile(sapId);
  const name = String(data?.name ?? "");
  const avatar = String((data as unknown as { image1?: string })?.image1 ?? "") || "/images/person.jpg";
  const faculty = String(data?.faculty ?? "");
  const dept = String(data?.department ?? "");
  const program = String(data?.program ?? "");
  const contact = String(data?.phoneNumber ?? data?.officialPhone ?? "");
  const facebook = String((data as unknown as { facebook?: string })?.facebook ?? "").trim() || null;
  const instagram = String((data as unknown as { instagram?: string })?.instagram ?? "").trim() || null;
  const youtube = String((data as unknown as { youtube?: string })?.youtube ?? "").trim() || null;
  const linkedin = String((data as unknown as { linkedin?: string })?.linkedin ?? "").trim() || null;

  return (
    <div className="w-full flex-shrink-0">
      <div className="bg-white flex justify-between rounded-lg  p-6 pt-0">
        <div>
          <div className="flex flex-col items-start sm:flex-row sm:items-end">
            <div className="w-32 h-32 rounded-full border-4 border-white bg-gray-100 overflow-hidden -mt-16 sm:-mt-10">
              <Image src={avatar} alt={name || "alumni"} width={128} height={128} className="w-full h-full object-cover" />
            </div>
            <div className="pt-4 sm:pt-0 sm:ml-6 flex-grow">
              <h4 className="text-slate-900 text-2xl font-bold">{name}</h4>
              <div className="space-x-3 mt-4">
                {[{ href: facebook, label: "Facebook", svg: (
                  <svg role="img" aria-label="Facebook" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 155.139 155.139"><path d="M89.584 155.139V84.378h23.742l3.562-27.585H89.584V39.184c0-7.984 2.208-13.425 13.67-13.425l14.595-.006V1.08C115.325.752 106.661 0 96.577 0 75.52 0 61.104 12.853 61.104 36.452v20.341H37.29v27.585h23.814v70.761h28.48z"/></svg>
                )}, { href: instagram, label: "Instagram", svg: (
                  <svg role="img" aria-label="Instagram" xmlns="http://www.w3.org/2000/svg" width="12" className="fill-gray-700" viewBox="0 0 512 512"><path d="M512 97.248c-19.04 8.352-39.328 13.888-60.48 16.576 21.76-12.992 38.368-33.408 46.176-58.016-20.288 12.096-42.688 20.64-66.56 25.408C411.872 60.704 384.416 48 354.464 48c-58.112 0-104.896 47.168-104.896 104.992 0 8.32.704 16.32 2.432 23.936-87.264-4.256-164.48-46.08-216.352-109.792-9.056 15.712-14.368 33.696-14.368 53.056 0 36.352 18.72 68.576 46.624 87.232-16.864-.32-33.408-5.216-47.424-12.928v1.152c0 51.008 36.384 93.376 84.096 103.136-8.544 2.336-17.856 3.456-27.52 3.456-6.72 0-13.504-.384-19.872-1.792 13.6 41.568 52.192 72.128 98.08 73.12-35.712 27.936-81.056 44.768-130.144 44.768-8.608 0-16.864-.384-25.12-1.44C46.496 446.88 101.6 464 161.024 464c193.152 0 298.752-160 298.752-298.688 0-4.64-.16-9.12-.384-13.568 20.832-14.784 38.336-33.248 52.608-54.496z"/></svg>
                )}, { href: linkedin, label: "LinkedIn", svg: (
                  <svg role="img" aria-label="LinkedIn" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.994 24v-.001H24v-8.802c0-4.306-.927-7.623-5.961-7.623-2.42 0-4.044 1.328-4.707 2.587h-.07V7.976H8.489v16.023h4.97v-7.934c0-2.089.396-4.109 2.983-4.109 2.549 0 2.587 2.384 2.587 4.243V24zM.396 7.977h4.976V24H.396zM2.882 0C1.291 0 0 1.291 0 2.882s1.291 2.909 2.882 2.909 2.882-1.318 2.882-2.909A2.884 2.884 0 0 0 2.882 0z"/></svg>
                )}, { href: youtube, label: "YouTube", svg: (
                  <svg role="img" aria-label="YouTube" xmlns="http://www.w3.org/2000/svg" width="14" className="fill-gray-700" viewBox="0 0 24 24"><path d="M23.498 6.186a2.999 2.999 0 0 0-2.116-2.12C19.59 3.5 12 3.5 12 3.5s-7.59 0-9.382.566A2.999 2.999 0 0 0 .502 6.186C0 8.002 0 12 0 12s0 3.998.502 5.814a2.999 2.999 0 0 0 2.116 2.12C4.41 20.5 12 20.5 12 20.5s7.59 0 9.382-.566a2.999 2.999 0 0 0 2.116-2.12C24 15.998 24 12 24 12s0-3.998-.502-5.814zM9.75 15.02V8.98L15.5 12l-5.75 3.02z"/></svg>
                )}].map((s, i) => (
                  s.href ? (
                    <a key={i} href={s.href} target="_blank" rel="noopener noreferrer" className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-100 hover:bg-gray-300 transition-colors" aria-label={s.label}>
                      {s.svg}
                    </a>
                  ) : (
                    <button key={i} type="button" className="w-8 h-8 inline-flex items-center justify-center rounded-full bg-gray-50 text-gray-400 cursor-not-allowed" aria-label={`${s.label} not provided`} title={`${s.label} not provided`}>
                      {s.svg}
                    </button>
                  )
                ))}
              </div>
            </div>
          </div>
          <div className="mt-6 pt-4 border-t border-gray-100">
            <h5 className="text-lg font-semibold text-slate-800 mb-3">Profile Details</h5>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 text-sm text-slate-700">
              <div className="col-span-1"><span className="font-semibold">SAP ID:</span> <br/> {sapId || "N/A"}</div>
              <div className="col-span-1"><span className="font-semibold">Phone:</span> <br/> {contact || "Not provided"}</div>
              <div className="col-span-1"><span className="font-semibold">Faculty:</span> <br/> {faculty || "N/A"}</div>
              <div className="col-span-1"><span className="font-semibold">Department:</span> <br/> {dept || "N/A"}</div>
              <div className="col-span-1"><span className="font-semibold">Program:</span> <br/> {program || "N/A"}</div>
            </div>
            
          </div>
        </div>
      </div>
    </div>
  );
}