"use client";

import { useCallback, useEffect, useState } from "react";

const DEFAULT_PLACEHOLDER = "/images/person.jpg";

type Props = {
  src?: string | null;
  alt: string;
  className?: string;
  placeholder?: string;
};

export default function AlumniProfilePhoto({
  src,
  alt,
  className,
  placeholder = DEFAULT_PLACEHOLDER,
}: Props) {
  const normalized = String(src || "").trim() || placeholder;
  const [resolvedSrc, setResolvedSrc] = useState(normalized);

  useEffect(() => {
    setResolvedSrc(String(src || "").trim() || placeholder);
  }, [src, placeholder]);

  const handleError = useCallback(() => {
    setResolvedSrc((current) => (current === placeholder ? current : placeholder));
  }, [placeholder]);

  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={resolvedSrc} alt={alt} className={className} onError={handleError} />
  );
}
