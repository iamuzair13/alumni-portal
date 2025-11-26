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
      className={`bg-slate-50 py-10 dark:bg-gray-900/50 min-h-screen ${className}`}
    >
      {(title || desc) && (
        <div className="px-6 pt-8 pb-4">
          {title && (
            <h2 className="text-2xl font-bold text-slate-900 dark:text-white/90 mb-2">{title}</h2>
          )}
          {desc && (
            <p className="text-sm text-slate-600 dark:text-gray-300">{desc}</p>
          )}
        </div>
      )}
     

      {/* Card Body */}
      <div className="px-6 pb-8">
        <div className="space-y-6">{children}</div>
      </div>
    </div>
  );
};

export default ComponentCard;
