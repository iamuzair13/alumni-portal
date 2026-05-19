"use client";

import { useEffect, useRef } from "react";
import flatpickr from "flatpickr";
import type { Instance } from "flatpickr/dist/types/instance";
import "flatpickr/dist/flatpickr.css";
import { CalenderIcon } from "@/icons";

type Props = {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  placeholder?: string;
  inputClassName?: string;
  labelClassName?: string;
};

export default function MembershipDatePicker({
  id,
  label,
  value,
  onChange,
  required,
  placeholder = "Select date",
  inputClassName,
  labelClassName,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const fpRef = useRef<Instance | null>(null);

  useEffect(() => {
    if (!inputRef.current) return;

    const fp = flatpickr(inputRef.current, {
      mode: "single",
      static: true,
      monthSelectorType: "static",
      dateFormat: "Y-m-d",
      defaultDate: value || undefined,
      minDate: "today",
      onChange: (_selectedDates, dateStr) => {
        onChange(dateStr);
      },
    });

    fpRef.current = Array.isArray(fp) ? fp[0] : fp;

    return () => {
      fpRef.current?.destroy();
      fpRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    const fp = fpRef.current;
    if (!fp) return;
    if (value) {
      fp.setDate(value, false);
    } else {
      fp.clear();
    }
  }, [value]);

  return (
    <div>
      <label htmlFor={id} className={labelClassName}>
        {label} {required && <span className="text-red-500">*</span>}
      </label>
      <div className="relative">
        <input
          ref={inputRef}
          id={id}
          type="text"
          readOnly
          placeholder={placeholder}
          className={inputClassName}
          required={required}
        />
        <span className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none text-gray-500">
          <CalenderIcon className="w-5 h-5" />
        </span>
      </div>
    </div>
  );
}
