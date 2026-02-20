"use client";
import { useState, Suspense, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import { useAlumniFullDetails } from "@/app/queries/alumni-profile";
import AppHeader from "@/layout/AppHeader";
import BackButton from "@/components/ui/BackButton";
import { Toaster, toast } from "react-hot-toast";
import PageBanner from "@/components/ui/PageBanner";

function UpskillApplicationContent() {
  const searchParams = useSearchParams();
  const safeSearchParams = searchParams ?? new URLSearchParams();
  const sapIdFromParams = safeSearchParams.get("sapid");
  const [sapId, setSapId] = useState(sapIdFromParams || "");
  
  // Try to get SAP ID from session if not in params
  useEffect(() => {
    if (!sapId) {
      // Fetch current user's SAP ID from API
      fetch("/api/alumni/current-sapid")
        .then(res => res.json())
        .then(data => {
          if (data.sapid) {
            setSapId(data.sapid);
          }
        })
        .catch(() => {
          // If API fails, try to get from URL or show error
        });
    }
  }, [sapId]);
  
  const { data, isLoading } = useAlumniFullDetails(sapId || undefined);
  
  const [formData, setFormData] = useState({
    courseName: "",
    departmentName: "",
    facultyId: "",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Database-backed faculties and departments
  const [faculties, setFaculties] = useState<Array<{ id: number; faculty_name: string }>>([]);
  const [departments, setDepartments] = useState<Array<{ id: number; department_name: string }>>([]);
  const [facultiesLoading, setFacultiesLoading] = useState(true);
  const [departmentsLoading, setDepartmentsLoading] = useState(false);

  // Fetch faculties from database
  useEffect(() => {
    const fetchFaculties = async () => {
      setFacultiesLoading(true);
      try {
        const res = await fetch("/api/organization/faculties");
        if (res.ok) {
          const data = await res.json();
          setFaculties(data.faculties || []);
        }
      } catch (error) {
      } finally {
        setFacultiesLoading(false);
      }
    };
    fetchFaculties();
  }, []);

  // Fetch departments when faculty changes
  useEffect(() => {
    const fetchDepartments = async () => {
      if (!formData.facultyId) {
        setDepartments([]);
        return;
      }
      setDepartmentsLoading(true);
      try {
        const res = await fetch(`/api/organization/departments?faculty_id=${formData.facultyId}`);
        if (res.ok) {
          const data = await res.json();
          setDepartments(data.departments || []);
        }
      } catch (error) {
      } finally {
        setDepartmentsLoading(false);
      }
    };
    fetchDepartments();
  }, [formData.facultyId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!formData.courseName || !formData.departmentName) {
      toast.error("Please fill in all required fields", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
      return;
    }

    if (!sapId) {
      toast.error("SAP ID not found. Please ensure you are logged in.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/alumni/${encodeURIComponent(sapId)}/upskill-application`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          courseName: formData.courseName,
          departmentName: formData.departmentName,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "Failed to submit application");
      }

      // Check if email was sent
      if (result.emailSent === false) {
        // Email failed but application was received
        toast.error(
          <div>
            <p className="font-semibold">Application received, but email delivery failed</p>
            <p className="text-xs mt-1">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Error: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 8000,
            style: {
              background: '#fef3c7',
              color: '#92400e',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      } else if (result.emailSent === true) {
        // Email sent successfully
        toast.success("Application submitted successfully! Please check your email for the confirmation document.", {
          duration: 6000,
          style: {
            background: '#d1fae5',
            color: '#065f46',
            padding: '12px',
            borderRadius: '8px',
          },
        });
      } else {
        // Email status unknown (might be SMTP not configured)
        toast.success(
          <div>
            <p className="font-semibold">{result.message}</p>
            {result.emailError && (
              <p className="text-xs mt-1 text-gray-600">Note: {result.emailError}</p>
            )}
          </div>,
          {
            duration: 6000,
            style: {
              background: '#dbeafe',
              color: '#1e40af',
              padding: '12px',
              borderRadius: '8px',
            },
          }
        );
      }

      // Reset form
      setFormData({
        courseName: "",
        departmentName: "",
        facultyId: "",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to submit application. Please try again.", {
        duration: 4000,
        style: {
          background: '#fee2e2',
          color: '#991b1b',
          padding: '12px',
          borderRadius: '8px',
        },
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => {
      const updated = { ...prev, [field]: value };
      // Reset department when faculty changes
      if (field === "facultyId") {
        updated.departmentName = "";
      }
      return updated;
    });
  };

  if (isLoading) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  <p className="text-sm text-gray-600">Loading...</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  if (!data) {
    return (
      <>
        <AppHeader />
        <div className="min-h-screen bg-gray-50">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
            <div className="bg-white rounded-lg shadow-sm p-8">
              <div className="flex items-center justify-center py-12">
                <div className="flex flex-col items-center gap-4">
                  <p className="text-sm text-red-600">Failed to load profile data</p>
                  <BackButton />
                </div>
              </div>
            </div>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <AppHeader />
      <Toaster position="top-right" />
      <PageBanner title="Upskill & Reskill Application" />
      <div className="min-h-screen bg-gray-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="mb-6">
            <BackButton />
          </div>

          <div className="bg-white rounded-lg shadow-sm p-6 sm:p-8">
            <h1 className="text-3xl font-bold text-gray-900 mb-2">Upskill & Reskill Course Application</h1>
            <p className="text-gray-600 mb-8">As a valued UOL alumnus, you can take advantage of our exclusive Upskill & Reskill courses designed to boost your professional knowledge and career growth. Select your preferred course offered by department below.</p>

            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <label htmlFor="courseName" className="block text-sm font-medium text-gray-700 mb-2">
                  Course Name <span className="text-red-500">*</span>
                </label>
                <input
                  type="text"
                  id="courseName"
                  value={formData.courseName}
                  onChange={(e) => handleChange("courseName", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  placeholder="Enter course name"
                />
              </div>

              <div>
                <label htmlFor="facultyId" className="block text-sm font-medium text-gray-700 mb-2">
                  Faculty <span className="text-red-500">*</span>
                </label>
                <select
                  id="facultyId"
                  value={formData.facultyId}
                  onChange={(e) => handleChange("facultyId", e.target.value)}
                  className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                  disabled={facultiesLoading}
                >
                  <option value="">
                    {facultiesLoading ? "Loading..." : "Select Faculty"}
                  </option>
                  {faculties.map((faculty) => (
                    <option key={faculty.id} value={faculty.id}>
                      {faculty.faculty_name}
                    </option>
                  ))}
                </select>
              </div>

              {formData.facultyId && (
                <div>
                  <label htmlFor="departmentName" className="block text-sm font-medium text-gray-700 mb-2">
                    Department Offering Course <span className="text-red-500">*</span>
                  </label>
                  <select
                    id="departmentName"
                    value={formData.departmentName}
                    onChange={(e) => handleChange("departmentName", e.target.value)}
                    className="w-full rounded-md border border-gray-300 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    required
                    disabled={departmentsLoading || departments.length === 0}
                  >
                    <option value="">
                      {departmentsLoading ? "Loading..." : 
                       departments.length === 0 ? "No departments available" : "Select Department"}
                    </option>
                    {departments.map((dept) => (
                      <option key={dept.id} value={dept.department_name}>
                        {dept.department_name}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              <div className="flex items-center gap-4 pt-4">
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-6 py-3 bg-purple-600 text-white font-semibold rounded-lg hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <>
                      <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                      </svg>
                      Submitting...
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                      Submit Application
                    </>
                  )}
                </button>
                <BackButton />
              </div>
            </form>
          </div>
        </div>
      </div>
    </>
  );
}

export default function UpskillApplicationPage() {
  return (
    <Suspense
      fallback={
        <>
          <AppHeader />
          <div className="min-h-screen bg-gray-50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
              <div className="bg-white rounded-lg shadow-sm p-8">
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-4">
                    <svg className="animate-spin h-12 w-12 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    <p className="text-sm text-gray-600">Loading...</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </>
      }
    >
      <UpskillApplicationContent />
    </Suspense>
  );
}

