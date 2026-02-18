"use client";
import type { FC } from "react";
import UnifiedHeader from "@/layout/UnifiedHeader";
import AlumniSqlForm from "@/components/forms/AlumniSqlForm";

export const AlumniTabbedMenu: FC = () => {
  return <UnifiedHeader variant="tabs" />;
};

export const AlumniRegistrationFormComponent: FC = () => {
  return <AlumniSqlForm />;
};