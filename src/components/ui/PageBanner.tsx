import React from "react";

type PageBannerProps = {
  title: string;
};

export default function PageBanner({ title }: PageBannerProps) {
  return (
    <div className="w-full">
      <div className="-mx-4 sm:-mx-6 lg:-mx-8  dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100 dark:outline-gray-700">
        <div className="w-full bg-gradient-to-r from-green-700 to-green-400 text-white dark:bg-gray-900 dark:text-gray-100 dark:border-y dark:border-gray-700 dark:outline-gray-700">
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 md:px-8 lg:px-10 py-8">
            <h1 className="text-center text-2xl sm:text-3xl md:text-4xl font-bold tracking-tight">
              {title}
            </h1>
          </div>
        </div>
      </div>
    </div>
  );
}

