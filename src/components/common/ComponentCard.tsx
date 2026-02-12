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
  const hasNoPadding = className.includes("p-0");
  return (
    <div
      className={`bg-gray-50 dark:bg-gray-900/50 min-h-screen pt-2  ${className}`}
    >
      {(title || desc) && (
        <div className={hasNoPadding ? "" : "px-6 pt-8 pb-6"}>
          {title && (
            <h2 className="text-3xl font-extrabold text-white dark:text-white/90 mb-2 tracking-tight">{title}</h2>
          )}
          {desc && (
            <p className="text-sm text-white dark:text-gray-400 mt-1">{desc}</p>
          )}
        </div>
      )}
     

      {/* Card Body */}
      <div className={hasNoPadding ? "" : "px-6 pb-8"}>
        <div className={hasNoPadding ? "" : "space-y-6"}>{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;
