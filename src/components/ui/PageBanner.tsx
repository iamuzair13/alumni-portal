import React from "react";
import PageHeader from "./PageHeader";

type PageBannerProps = {
  title: string;
  description?: string;
  breadcrumbs?: Array<{ label: string; href?: string }>;
  actions?: React.ReactNode;
};

/**
 * Backward-compatible wrapper: renders the flat PageHeader instead of the
 * old full-bleed gradient banner. Existing `<PageBanner title="..." />`
 * call sites keep working unchanged.
 */
export default function PageBanner({
  title,
  description,
  breadcrumbs,
  actions,
}: PageBannerProps) {
  return (
    <PageHeader
      title={title}
      description={description}
      breadcrumbs={breadcrumbs}
      actions={actions}
      className="-mx-4 sm:-mx-6 lg:-mx-8 mb-6 bg-white dark:bg-gray-900"
    />
  );
}
