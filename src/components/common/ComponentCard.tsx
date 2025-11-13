import React from "react";

interface ComponentCardProps {
  title?: string;
  children: React.ReactNode;
  className?: string; // Additional custom classes for styling
  desc?: string; // Description text
}

const ComponentCard: React.FC<ComponentCardProps> = ({
  title,
  children,
  className = "",
  desc = "",
}) => {
  return (
    <div
      className={`rounded-2xl py-2 px-2  bg-white dark:border-gray-800 dark:bg-white/[0.03] ${className}`}
    >
      {(title || desc) && (
        <div className="p-4 sm:p-6">
          {title && (
            <h2 className="text-lg font-semibold text-gray-800 dark:text-white/90">{title}</h2>
          )}
          {desc && (
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-300">{desc}</p>
          )}
        </div>
      )}
     

      {/* Card Body */}
      <div className=" border-gray-100 dark:border-gray-800 ">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;
