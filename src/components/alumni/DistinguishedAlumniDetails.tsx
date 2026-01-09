"use client";

import React from "react";
import { Modal } from "@/components/ui/modal";
import Button from "@/components/ui/button/Button";

interface DistinguishedAlumni {
  id?: number;
  slug: string;
  name: string;
  image: string;
  role: string;
  summary: string;
  headline?: string | null;
  quote?: string | null;
  quote_by?: string | null;
  tags?: any[] | null;
  stats?: any[] | null;
  achievements?: any[] | null;
  story?: any[] | null;
  created_at?: string;
  updated_at?: string;
}

interface DistinguishedAlumniDetailsProps {
  isOpen: boolean;
  onClose: () => void;
  item: DistinguishedAlumni | null;
}

export const DistinguishedAlumniDetails: React.FC<DistinguishedAlumniDetailsProps> = ({
  isOpen,
  onClose,
  item
}) => {
  if (!item) return null;

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      className="max-w-4xl mx-auto max-h-[90vh] overflow-y-auto"
      showCloseButton={true}
    >
      <div className="p-6 lg:p-8" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-6 mb-6">
          {item.image && (
            <img
              src={item.image}
              alt={item.name}
              className="w-32 h-32 object-cover rounded-lg border border-gray-300 dark:border-gray-600 flex-shrink-0"
            />
          )}
          <div className="flex-1">
            <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
              {item.name}
            </h2>
            {item.role && (
              <p className="text-lg text-gray-600 dark:text-gray-400 mb-2">
                {item.role}
              </p>
            )}
            {item.headline && (
              <p className="text-base font-semibold text-gray-700 dark:text-gray-300 italic mb-4">
                {item.headline}
              </p>
            )}
            {item.slug && (
              <p className="text-sm text-gray-500 dark:text-gray-400">
                Slug: <span className="font-mono">{item.slug}</span>
              </p>
            )}
          </div>
        </div>

        {item.summary && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Summary
            </h3>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
              {item.summary}
            </p>
          </div>
        )}

        {item.quote && (
          <div className="mb-6 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg border-l-4 border-blue-500">
            <p className="text-lg italic text-gray-800 dark:text-gray-200 mb-2">
              &ldquo;{item.quote}&rdquo;
            </p>
            {item.quote_by && (
              <p className="text-sm text-gray-600 dark:text-gray-400 text-right">
                — {item.quote_by}
              </p>
            )}
          </div>
        )}

        {item.tags && Array.isArray(item.tags) && item.tags.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Tags
            </h3>
            <div className="flex flex-wrap gap-2">
              {item.tags.map((tag, index) => (
                <span
                  key={index}
                  className="px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 rounded-full text-sm"
                >
                  {typeof tag === "string" ? tag : JSON.stringify(tag)}
                </span>
              ))}
            </div>
          </div>
        )}

        {item.stats && Array.isArray(item.stats) && item.stats.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Statistics
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {item.stats.map((stat, index) => (
                <div
                  key={index}
                  className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  {typeof stat === "object" && stat !== null ? (
                    <div>
                      {Object.entries(stat).map(([key, value]) => (
                        <div key={key} className="mb-1">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {key}:
                          </span>{" "}
                          <span className="text-gray-600 dark:text-gray-400">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300">{String(stat)}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {item.achievements && Array.isArray(item.achievements) && item.achievements.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Achievements
            </h3>
            <ul className="list-disc list-inside space-y-2 text-gray-700 dark:text-gray-300">
              {item.achievements.map((achievement, index) => (
                <li key={index}>
                  {typeof achievement === "string"
                    ? achievement
                    : JSON.stringify(achievement)}
                </li>
              ))}
            </ul>
          </div>
        )}

        {item.story && Array.isArray(item.story) && item.story.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-2">
              Story
            </h3>
            <div className="space-y-4">
              {item.story.map((storyItem, index) => (
                <div
                  key={index}
                  className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg"
                >
                  {typeof storyItem === "object" && storyItem !== null ? (
                    <div>
                      {Object.entries(storyItem).map(([key, value]) => (
                        <div key={key} className="mb-2">
                          <span className="font-medium text-gray-700 dark:text-gray-300">
                            {key}:
                          </span>{" "}
                          <span className="text-gray-600 dark:text-gray-400">
                            {String(value)}
                          </span>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
                      {String(storyItem)}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {(item.created_at || item.updated_at) && (
          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <div className="text-sm text-gray-500 dark:text-gray-400 space-y-1">
              {item.created_at && (
                <p>
                  Created: {new Date(item.created_at).toLocaleString()}
                </p>
              )}
              {item.updated_at && (
                <p>
                  Updated: {new Date(item.updated_at).toLocaleString()}
                </p>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center justify-end gap-3 pt-4 border-t border-gray-200 dark:border-gray-700 mt-6">
          <Button
            size="sm"
            variant="outline"
            onClick={onClose}
          >
            Close
          </Button>
        </div>
      </div>
    </Modal>
  );
};