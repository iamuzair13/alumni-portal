"use client";

import React, { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import Button from "@/components/ui/button/Button";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import {
  DISCOUNT_BASIS_OPTIONS,
  MEMBERSHIP_FACILITY_OPTIONS,
  type MembershipDiscountBasis,
  type MembershipFacilityType,
  membershipDiscountBasisLabel,
} from "@/lib/membershipSettingsShared";

type MembershipSettingsItem = {
  id: number;
  facilityType: MembershipFacilityType;
  discountBasis: MembershipDiscountBasis;
  paymentAmount: number;
  discountPct: number;
  updatedAt: string | null;
  updatedBy: number | null;
};

async function fetchMembershipSettings() {
  const res = await fetch("/api/membership/settings");
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(data.error || "Failed to fetch membership settings");
  }
  return (await res.json()) as { items: MembershipSettingsItem[] };
}

async function updateMembershipSettings(payload: {
  facilityType: MembershipFacilityType;
  discountBasis: MembershipDiscountBasis;
  paymentAmount: number;
  discountPct: number;
}) {
  const res = await fetch("/api/membership/settings", {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || "Failed to update membership settings");
  return data;
}

export default function MembershipSettingsComponent() {
  const queryClient = useQueryClient();
  const { data, isLoading, error } = useQuery({
    queryKey: ["membership-settings"],
    queryFn: fetchMembershipSettings,
    refetchOnWindowFocus: false,
  });

  const [selectedFacilityType, setSelectedFacilityType] =
    useState<MembershipFacilityType>("gym");
  const [discountBasis, setDiscountBasis] = useState<MembershipDiscountBasis>(
    "same_as_staff_student",
  );
  const [paymentAmount, setPaymentAmount] = useState<string>("");
  const [discountPct, setDiscountPct] = useState<string>("");
  const [validationError, setValidationError] = useState<string | null>(null);

  const settingsMap = useMemo(() => {
    const map = new Map<MembershipFacilityType, MembershipSettingsItem>();
    data?.items.forEach((item) => map.set(item.facilityType, item));
    return map;
  }, [data]);

  const selectedSettings = settingsMap.get(selectedFacilityType);

  useEffect(() => {
    if (!selectedSettings) return;
    setDiscountBasis(selectedSettings.discountBasis);
    setPaymentAmount(String(selectedSettings.paymentAmount ?? ""));
    setDiscountPct(String(selectedSettings.discountPct ?? ""));
    setValidationError(null);
  }, [selectedSettings]);

  const mutation = useMutation({
    mutationFn: updateMembershipSettings,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membership-settings"] });
    },
  });

  const hasChanges = useMemo(() => {
    if (!selectedSettings) return false;
    return (
      discountBasis !== selectedSettings.discountBasis ||
      paymentAmount !== String(selectedSettings.paymentAmount ?? "") ||
      discountPct !== String(selectedSettings.discountPct ?? "")
    );
  }, [selectedSettings, discountBasis, paymentAmount, discountPct]);

  const handleSave = () => {
    setValidationError(null);
    const payment = Number(paymentAmount);
    const discount = Number(discountPct);

    if (!Number.isFinite(payment) || payment < 0 || !Number.isInteger(payment)) {
      setValidationError("Payment amount must be a non-negative integer.");
      return;
    }
    if (!Number.isFinite(discount) || discount < 1 || discount > 100 || !Number.isInteger(discount)) {
      setValidationError("Discount percent must be an integer between 1 and 100.");
      return;
    }

    mutation.mutate({
      facilityType: selectedFacilityType,
      discountBasis,
      paymentAmount: payment,
      discountPct: discount,
    });
  };

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
      <div className="mb-5">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Membership Fee Settings
        </h3>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          Select a membership type below, set its payment and discount rules, then save. These values are only shown on the downloaded PDF and are not visible to alumni.
        </p>
      </div>

      {isLoading && (
        <p className="text-sm text-gray-600 dark:text-gray-300">Loading settings...</p>
      )}

      {error && (
        <div className="mb-4 rounded-lg border border-error-500 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/15">
          <p className="text-sm text-error-600 dark:text-error-400">
            {error instanceof Error ? error.message : "Failed to load settings"}
          </p>
        </div>
      )}

      {!isLoading && (
        <>
          <div className="grid grid-cols-1 gap-5 md:grid-cols-2 lg:grid-cols-3">
            <div>
              <Label>Select Membership</Label>
              <select
                value={selectedFacilityType}
                onChange={(e) =>
                  setSelectedFacilityType(e.target.value as MembershipFacilityType)
                }
                className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {MEMBERSHIP_FACILITY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Choose the membership whose payment settings you want to edit.
              </p>
            </div>

            <div>
              <Label>Discount Basis</Label>
              <select
                value={discountBasis}
                onChange={(e) =>
                  setDiscountBasis(e.target.value as MembershipDiscountBasis)
                }
                className="mt-1.5 h-11 w-full rounded-lg border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-800 focus:border-brand-300 focus:outline-hidden focus:ring-3 focus:ring-brand-500/10 dark:border-gray-700 dark:bg-gray-900 dark:text-white/90"
              >
                {DISCOUNT_BASIS_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                {membershipDiscountBasisLabel(discountBasis)}
              </p>
            </div>

            <div>
              <Label>Payment Amount (Rs)</Label>
              <Input
                type="number"
                min={0}
                step={1}
                placeholder="e.g. 3000"
                value={paymentAmount}
                onChange={(e) => setPaymentAmount(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Integer amount shown in the PDF membership details.
              </p>
            </div>

            <div>
              <Label>Discount %</Label>
              <Input
                type="number"
                min={1}
                max={100}
                step={1}
                placeholder="1 - 100"
                value={discountPct}
                onChange={(e) => setDiscountPct(e.target.value)}
              />
              <p className="mt-1.5 text-xs text-gray-500 dark:text-gray-400">
                Enter a value between 1 and 100.
              </p>
            </div>
          </div>

          {(validationError || mutation.isError) && (
            <div className="mt-4 rounded-lg border border-error-500 bg-error-50 p-3 dark:border-error-500/30 dark:bg-error-500/15">
              <p className="text-sm text-error-600 dark:text-error-400">
                {validationError ||
                  (mutation.error instanceof Error ? mutation.error.message : "Failed to save")}
              </p>
            </div>
          )}

          {mutation.isSuccess && (
            <div className="mt-4 rounded-lg border border-success-500 bg-success-50 p-3 dark:border-success-500/30 dark:bg-success-500/15">
              <p className="text-sm text-success-600 dark:text-success-400">
                Membership settings saved successfully.
              </p>
            </div>
          )}

          <div className="mt-6 flex items-center justify-end gap-3">
            <Button
              size="sm"
              disabled={!hasChanges || mutation.isPending}
              onClick={handleSave}
            >
              {mutation.isPending ? "Saving..." : "Save Settings"}
            </Button>
          </div>

          <div className="mt-8 border-t border-gray-200 pt-5 dark:border-gray-700">
            <h4 className="mb-3 text-base font-semibold text-gray-900 dark:text-gray-100">
              Configured Membership Payments
            </h4>
            <div className="overflow-x-auto rounded-lg border border-gray-200 dark:border-gray-700">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-gray-50 dark:bg-gray-800/70">
                  <tr>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Membership</th>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Discount Basis</th>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Payment (Rs)</th>
                    <th className="px-4 py-2 font-medium text-gray-700 dark:text-gray-300">Discount %</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
                  {MEMBERSHIP_FACILITY_OPTIONS.map((opt) => {
                    const item = settingsMap.get(opt.value);
                    const hasPayment = Boolean(item && item.paymentAmount > 0);
                    return (
                      <tr
                        key={opt.value}
                        className={`${
                          opt.value === selectedFacilityType
                            ? "bg-blue-50 dark:bg-blue-900/20"
                            : "bg-white dark:bg-gray-900"
                        }`}
                      >
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-200">
                          {opt.label}
                          {hasPayment && (
                            <span className="ml-2 inline-flex items-center rounded-full bg-success-100 px-2 py-0.5 text-xs font-medium text-success-700 dark:bg-success-900/30 dark:text-success-300">
                              Applied
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-2 text-gray-600 dark:text-gray-400">
                          {item ? membershipDiscountBasisLabel(item.discountBasis) : "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-200">
                          {item && item.paymentAmount > 0 ? item.paymentAmount.toLocaleString() : "—"}
                        </td>
                        <td className="px-4 py-2 text-gray-900 dark:text-gray-200">
                          {item && item.discountPct > 0 ? `${item.discountPct}%` : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
