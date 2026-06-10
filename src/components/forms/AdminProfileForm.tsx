"use client";

import React, { useState, useEffect, useRef, useCallback } from "react";
import { useSession } from "next-auth/react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useSpring,
  useTransform,
  type Variants,
} from "motion/react";
import Image from "next/image";
import toast from "react-hot-toast";
import { currentUserImageKey } from "@/app/queries/alumni-profile";

// ─── Types ───────────────────────────────────────────────────────────────────
type UserData = {
  userid: number;
  email: string | null;
  firstname: string | null;
  lastname: string | null;
  department: string | null;
  type: string | null;
  blocked: boolean | null;
  lastlogindatetime: string | null;
  user_image: string | null;
  password?: string | null;
};

type AccessAssignmentsResponse = {
  isSuperAdmin: boolean;
  isAlumni: boolean;
  faculties: string[];
  departments: string[];
  programs: string[];
};

// ─── Animation Config ──────────────────────────────────────────────────────────
const springConfig = { stiffness: 300, damping: 30 };

const containerVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.06,
      delayChildren: 0.04,
    },
  },
};

const itemVariants: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: {
    opacity: 1,
    y: 0,
    transition: {
      duration: 0.35,
      ease: [0.25, 0.46, 0.45, 0.94] as [number, number, number, number],
    },
  },
};

const cardHover = {
  scale: 1.005,
  transition: { duration: 0.3, ease: "easeOut" as const },
};

/** Light-first tokens; dark mode via `dark:` (system / header theme toggle). */
const profileTheme = {
  page:
    "relative w-full bg-slate-50 font-sans text-slate-900 antialiased selection:bg-slate-900/10 selection:text-slate-900 dark:bg-slate-950 dark:text-slate-200 dark:selection:bg-white/10 dark:selection:text-white",
  glassCard:
    "border-slate-200/80 bg-white/80 backdrop-blur-xl backdrop-saturate-150 dark:border-white/[0.08] dark:bg-slate-900/40",
  skeleton: "bg-slate-200/70 dark:bg-white/[0.04]",
  skeletonCard: "border-slate-200/80 bg-white/80 backdrop-blur-xl dark:border-white/[0.06] dark:bg-slate-900/40",
  heading: "text-slate-900 dark:text-white",
  subheading: "text-slate-700 dark:text-slate-300",
  body: "text-slate-600 dark:text-slate-400",
  muted: "text-slate-500 dark:text-slate-500",
  faint: "text-slate-400 dark:text-slate-600",
  divider: "bg-gradient-to-r from-transparent via-slate-300 to-transparent dark:via-white/10",
  label: "text-slate-600 dark:text-slate-400",
  input:
    "w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-900 placeholder-slate-400 outline-none transition-all focus:border-slate-400 focus:ring-1 focus:ring-slate-200 dark:border-white/[0.06] dark:bg-white/[0.03] dark:text-slate-200 dark:placeholder-slate-600 dark:focus:border-white/20 dark:focus:bg-white/[0.05] dark:focus:ring-white/10",
  staticField:
    "rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5 dark:border-white/[0.06] dark:bg-white/[0.02]",
  tabShell:
    "border-slate-200 bg-slate-100/90 p-1 backdrop-blur-xl dark:border-white/[0.06] dark:bg-white/[0.02]",
  tabActiveBg: "bg-white border border-slate-200 dark:bg-white/5 dark:border-white/10",
  tabActiveText: "text-slate-900 dark:text-white",
  tabInactiveText: "text-slate-500 hover:text-slate-800 dark:text-slate-500 dark:hover:text-slate-300",
  uploadBtn:
    "border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:border-white/10 dark:bg-white/5 dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
  avatar:
    "border-slate-200 bg-slate-100 dark:border-white/10 dark:bg-slate-800/50",
  avatarFallback: "from-slate-200 to-slate-100 dark:from-slate-800 dark:to-slate-900",
  avatarLetter: "text-slate-500 dark:text-slate-400",
  meshBg:
    "from-slate-100 via-white to-slate-50 dark:from-slate-900 dark:via-slate-950 dark:to-black",
  meshOrb: "opacity-[0.12] dark:opacity-[0.03]",
  meshGrid: "opacity-[0.035] dark:opacity-[0.02]",
} as const;

// ─── Magnetic Button Component ─────────────────────────────────────────────────
type MagneticButtonProps = {
  children: React.ReactNode;
  className?: string;
  variant?: "primary" | "secondary" | "ghost";
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  disabled?: boolean;
  type?: "button" | "submit" | "reset";
};

function MagneticButton({
  children,
  className = "",
  variant = "primary",
  onClick,
  disabled,
  type = "button",
}: MagneticButtonProps) {
  const ref = useRef<HTMLButtonElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const springX = useSpring(x, springConfig);
  const springY = useSpring(y, springConfig);

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;
    const distX = e.clientX - centerX;
    const distY = e.clientY - centerY;
    x.set(distX * 0.15);
    y.set(distY * 0.15);
  };

  const handleMouseLeave = () => {
    x.set(0);
    y.set(0);
  };

  const variantStyles = {
    primary:
      "bg-slate-900 text-white shadow-lg shadow-slate-900/10 hover:bg-slate-800 dark:bg-slate-100 dark:text-slate-950 dark:shadow-white/5 dark:hover:bg-white",
    secondary:
      "border border-slate-200 bg-slate-100 text-slate-700 hover:bg-slate-200 dark:border-white/10 dark:bg-white/5 dark:text-slate-200 dark:hover:bg-white/10",
    ghost:
      "text-slate-500 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200",
  };

  return (
    <motion.button
      ref={ref}
      style={{ x: springX, y: springY }}
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.97 }}
      className={`relative overflow-hidden rounded-xl px-5 py-2.5 text-sm font-medium tracking-tight transition-colors ${variantStyles[variant]} ${className}`}
      onClick={onClick}
      disabled={disabled}
      type={type}
    >
      <span className="relative z-10">{children}</span>
      {variant === "primary" && (
        <motion.div
          className="absolute inset-0 bg-gradient-to-r from-slate-200 to-white opacity-0 dark:from-slate-200 dark:to-white"
          whileHover={{ opacity: 1 }}
          transition={{ duration: 0.3 }}
        />
      )}
    </motion.button>
  );
}

// ─── Glass Card Component ────────────────────────────────────────────────────
function GlassCard({
  children,
  className = "",
  hover = true,
  spotlight = true,
}: {
  children: React.ReactNode;
  className?: string;
  hover?: boolean;
  spotlight?: boolean;
}) {
  const cardRef = useRef<HTMLDivElement>(null);
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    setMousePosition({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  }, []);

  return (
    <motion.div
      ref={cardRef}
      variants={itemVariants}
      whileHover={hover ? cardHover : undefined}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative overflow-hidden rounded-2xl ${profileTheme.glassCard} ${className}`}
    >
      {spotlight && (
        <motion.div
          className="pointer-events-none absolute -inset-px rounded-2xl opacity-0 transition-opacity duration-500"
          style={{
            background: `radial-gradient(600px circle at ${mousePosition.x}px ${mousePosition.y}px, rgba(148,163,184,0.12), transparent 40%)`,
            opacity: isHovered ? 1 : 0,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </motion.div>
  );
}

// ─── Skeleton Loader ───────────────────────────────────────────────────────────
function SkeletonPulse({ className = "" }: { className?: string }) {
  return (
    <div className={`relative overflow-hidden rounded-lg ${profileTheme.skeleton} ${className}`}>
      <motion.div
        className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-slate-300/40 to-transparent dark:via-white/10"
        animate={{ translateX: ["0%", "200%"] }}
        transition={{
          duration: 1.5,
          repeat: Infinity,
          ease: "easeInOut",
        }}
      />
    </div>
  );
}

function ProfileSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero Skeleton */}
      <div className={`rounded-2xl p-8 ${profileTheme.skeletonCard}`}>
        <div className="flex items-center gap-6">
          <SkeletonPulse className="h-24 w-24 rounded-full" />
          <div className="flex-1 space-y-3">
            <SkeletonPulse className="h-7 w-48" />
            <SkeletonPulse className="h-4 w-64" />
            <SkeletonPulse className="h-3 w-32" />
          </div>
        </div>
      </div>

      {/* Bento Grid Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className={`rounded-2xl p-6 ${profileTheme.skeletonCard}`}>
            <SkeletonPulse className="mb-4 h-5 w-24" />
            <div className="flex flex-wrap gap-2">
              {[1, 2, 3].map((j) => (
                <SkeletonPulse key={j} className="h-6 w-16 rounded-full" />
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* Form Skeleton */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {[1, 2].map((i) => (
          <div key={i} className={`rounded-2xl p-6 ${profileTheme.skeletonCard}`}>
            <SkeletonPulse className="mb-6 h-6 w-32" />
            <div className="space-y-4">
              <SkeletonPulse className="h-11 w-full rounded-xl" />
              <SkeletonPulse className="h-11 w-full rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Animated Badge ────────────────────────────────────────────────────────────
function StatusBadge({
  children,
  variant = "default",
}: {
  children: React.ReactNode;
  variant?: "default" | "success" | "error" | "warning" | "info";
}) {
  const variants = {
    default:
      "border-slate-200 bg-slate-100 text-slate-700 dark:border-white/10 dark:bg-white/5 dark:text-slate-300",
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-500/20 dark:bg-emerald-500/10 dark:text-emerald-400",
    error:
      "border-red-200 bg-red-50 text-red-700 dark:border-red-500/20 dark:bg-red-500/10 dark:text-red-400",
    warning:
      "border-amber-200 bg-amber-50 text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400",
    info:
      "border-sky-200 bg-sky-50 text-sky-700 dark:border-sky-500/20 dark:bg-sky-500/10 dark:text-sky-400",
  };

  return (
    <motion.span
      initial={{ opacity: 0, scale: 0.8 }}
      animate={{ opacity: 1, scale: 1 }}
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium tracking-tight ${variants[variant]}`}
    >
      {children}
    </motion.span>
  );
}

// ─── Accordion Section ───────────────────────────────────────────────────────
function AccordionSection({
  title,
  children,
  defaultOpen = false,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <GlassCard className="p-0" spotlight={false}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex w-full items-center justify-between p-5 text-left"
      >
        <h4 className={`text-sm font-semibold tracking-tight ${profileTheme.subheading}`}>{title}</h4>
        <motion.div
          animate={{ rotate: isOpen ? 180 : 0 }}
          transition={{ duration: 0.3, ease: "easeInOut" }}
        >
          <svg className={`h-4 w-4 ${profileTheme.muted}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </motion.div>
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className="overflow-hidden"
          >
            <div className="border-t border-slate-200 p-5 dark:border-white/[0.06]">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </GlassCard>
  );
}

// ─── Tooltip Component ─────────────────────────────────────────────────────────
function Tooltip({ content, children }: { content: string; children: React.ReactNode }) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative inline-block" onMouseEnter={() => setShow(true)} onMouseLeave={() => setShow(false)}>
      {children}
      <AnimatePresence>
        {show && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute bottom-full left-1/2 z-50 mb-2 -translate-x-1/2 whitespace-nowrap rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-700 shadow-xl backdrop-blur-xl dark:border-white/10 dark:bg-slate-800 dark:text-slate-300"
          >
            {content}
            <div className="absolute left-1/2 top-full -translate-x-1/2 border-4 border-transparent border-t-white dark:border-t-slate-800" />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ─── Mesh Gradient Background ──────────────────────────────────────────────────
function MeshGradient() {
  const mouseX = useMotionValue(0);
  const mouseY = useMotionValue(0);

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      mouseX.set(e.clientX);
      mouseY.set(e.clientY);
    };
    window.addEventListener("mousemove", handleMouseMove);
    return () => window.removeEventListener("mousemove", handleMouseMove);
  }, [mouseX, mouseY]);

  const gradientX = useTransform(mouseX, [0, typeof window !== "undefined" ? window.innerWidth : 1920], [20, 80]);
  const gradientY = useTransform(mouseY, [0, typeof window !== "undefined" ? window.innerHeight : 1080], [20, 80]);

  return (
    <div className="pointer-events-none absolute inset-0 -z-10 overflow-hidden rounded-2xl">
      <motion.div
        className={`absolute h-[800px] w-[800px] rounded-full blur-[120px] ${profileTheme.meshOrb}`}
        style={{
          background: "radial-gradient(circle, rgba(148,163,184,1) 0%, transparent 70%)",
          left: useTransform(gradientX, (v) => `${v}%`),
          top: useTransform(gradientY, (v) => `${v}%`),
          transform: "translate(-50%, -50%)",
        }}
      />
      <div
        className={`absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] ${profileTheme.meshBg}`}
      />
      <div
        className={`absolute inset-0 ${profileTheme.meshGrid}`}
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23000000' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
      <div
        className="absolute inset-0 hidden opacity-[0.02] dark:block"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='1'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
        }}
      />
    </div>
  );
}

// ─── Main Component ────────────────────────────────────────────────────────────
export default function AdminProfileForm() {
  const { data: session, update: updateSession } = useSession();
  const queryClient = useQueryClient();
  const [saving, setSaving] = useState(false);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [formData, setFormData] = useState({
    email: "",
    currentPassword: "",
    newPassword: "",
    firstname: "",
    lastname: "",
    department: "",
  });
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [activeTab, setActiveTab] = useState<"general" | "security">("general");

  const currentUserQuery = useQuery<{ user: UserData }, Error>({
    queryKey: ["users", "current"],
    queryFn: async ({ signal }) => {
      const res = await fetch("/api/users/current", { signal, headers: { accept: "application/json" } });
      if (!res.ok) {
        const error = await res.json().catch(() => ({} as any));
        throw new Error((error as any)?.error || "Failed to fetch user data");
      }
      return (await res.json()) as { user: UserData };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: true,
  });

  const accessAssignmentsQuery = useQuery({
    queryKey: ["users", "current", "access-assignments"],
    enabled: Boolean(currentUserQuery.data?.user ?? userData),
    queryFn: async () => {
      const res = await fetch("/api/users/current/access-assignments");
      if (!res.ok) {
        throw new Error("Failed to fetch access assignments");
      }
      return (await res.json()) as AccessAssignmentsResponse;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  useEffect(() => {
    if (currentUserQuery.isError) {
      toast.error("Failed to load profile data");
      return;
    }
    const user = currentUserQuery.data?.user;
    if (!user) return;

    setUserData(user);
    setFormData({
      email: user.email || "",
      currentPassword: user.password || "",
      newPassword: "",
      firstname: user.firstname || "",
      lastname: user.lastname || "",
      department: user.department || "",
    });

    if (user.user_image) {
      setImagePreview(`/images/${user.user_image}`);
    }
  }, [currentUserQuery.data, currentUserQuery.isError]);

  const handleInputChange = (field: string, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith("image/")) {
        setErrors((prev) => ({ ...prev, image: "Please select an image file" }));
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        setErrors((prev) => ({ ...prev, image: "Image size must be less than 5MB" }));
        return;
      }
      setImageFile(file);
      setErrors((prev) => {
        const newErrors = { ...prev };
        delete newErrors.image;
        return newErrors;
      });
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!isRestrictedStaff) {
      if (!formData.email || !formData.email.includes("@")) {
        newErrors.email = "Valid email is required";
      }
    }
    if (formData.newPassword && formData.newPassword.length < 8) {
      newErrors.newPassword = "New password must be at least 8 characters";
    }
    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      return;
    }
    try {
      setSaving(true);
      const formDataToSend = new FormData();
      if (!isRestrictedStaff) {
        formDataToSend.append("email", formData.email);
        formDataToSend.append("firstname", formData.firstname);
        formDataToSend.append("lastname", formData.lastname);
        if (formData.department) {
          formDataToSend.append("department", formData.department);
        }
      }
      if (formData.newPassword && formData.newPassword.trim().length > 0) {
        formDataToSend.append("newPassword", formData.newPassword.trim());
      }
      if (imageFile) {
        formDataToSend.append("image", imageFile);
      }
      const res = await fetch("/api/users/current", {
        method: "PUT",
        body: formDataToSend,
      });
      if (!res.ok) {
        const error = await res.json();
        throw new Error(error.error || "Failed to update profile");
      }
      const data = await res.json();
      toast.success("Profile updated successfully");
      queryClient.invalidateQueries({ queryKey: currentUserImageKey() });
      queryClient.invalidateQueries({ queryKey: ["users", "list"] });
      if (data.user?.user_image) {
        setImagePreview(`/images/${data.user.user_image}`);
      }
      if (data.user) {
        await updateSession({
          ...session,
          user: {
            ...session?.user,
            email: data.user.email,
            name: `${data.user.firstname || ""} ${data.user.lastname || ""}`.trim() || data.user.email,
          },
        });
      }
      if (data.user) {
        setUserData((prev) => (prev ? { ...prev, ...data.user } : data.user));
        setFormData((prev) => ({
          ...prev,
          email: data.user.email || prev.email,
          firstname: data.user.firstname || prev.firstname,
          lastname: data.user.lastname || prev.lastname,
          department: data.user.department || prev.department,
          currentPassword: formData.newPassword && formData.newPassword.trim().length > 0
            ? formData.newPassword.trim()
            : (data.user.password || prev.currentPassword),
          newPassword: "",
        }));
      } else {
        await currentUserQuery.refetch();
        setFormData((prev) => ({ ...prev, newPassword: "" }));
      }
      setImageFile(null);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  const profileUser = userData ?? currentUserQuery.data?.user ?? null;
  const isProfileLoading = currentUserQuery.isPending || currentUserQuery.isLoading;

  if (isProfileLoading) {
    return (
      <div className={`relative ${profileTheme.page}`}>
        <MeshGradient />
        <div className="relative z-10 mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6">
          <ProfileSkeleton />
        </div>
      </div>
    );
  }

  if (currentUserQuery.isError || !profileUser) {
    return (
      <div className={`relative ${profileTheme.page}`}>
        <MeshGradient />
        <motion.div
          initial={false}
          animate={{ opacity: 1, scale: 1 }}
          className="relative z-10 flex min-h-[280px] items-center justify-center px-4 py-8"
        >
          <GlassCard className="p-8 text-center">
            <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-red-500/10 mx-auto">
              <svg className="h-8 w-8 text-red-500 dark:text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
            </div>
            <h3 className={`text-lg font-semibold tracking-tight ${profileTheme.subheading}`}>Failed to load profile</h3>
            <p className={`mt-2 text-sm ${profileTheme.muted}`}>We couldn't retrieve your profile data. Please try again.</p>
            <MagneticButton
              variant="secondary"
              className="mt-6"
              onClick={() => currentUserQuery.refetch()}
            >
              Retry
            </MagneticButton>
          </GlassCard>
        </motion.div>
      </div>
    );
  }

  const normalizedType = profileUser.type ? String(profileUser.type).toLowerCase().trim() : "";
  const isSuperAdmin = normalizedType === "superadmin";
  const isRestrictedStaff = !isSuperAdmin;

  const roleLabel = profileUser.type || "N/A";
  const statusLabel = profileUser.blocked ? "Blocked" : "Active";
  const displayName = `${profileUser.firstname ?? ""} ${profileUser.lastname ?? ""}`.trim() || profileUser.email || "User";
  const lastLoginLabel = profileUser.lastlogindatetime
    ? new Date(profileUser.lastlogindatetime).toLocaleString()
    : "Never";

  return (
    <div className={`relative ${profileTheme.page}`}>
      <MeshGradient />

      <motion.div
        variants={containerVariants}
        initial="visible"
        animate="visible"
        className="relative z-10 mx-auto max-w-5xl px-2 py-4 sm:px-4 sm:py-6"
      >
        {/* Header */}
        <motion.div variants={itemVariants} className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className={`h-px flex-1 ${profileTheme.divider}`} />
            <span className={`text-xs font-medium tracking-[0.2em] uppercase ${profileTheme.muted}`}>Profile Settings</span>
            <div className={`h-px flex-1 ${profileTheme.divider}`} />
          </div>
        </motion.div>

        {/* Hero Card - Profile Identity */}
        <GlassCard className="mb-6 p-6 sm:p-8">
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            {/* Avatar */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              className={`relative h-24 w-24 shrink-0 overflow-hidden rounded-2xl shadow-2xl ${profileTheme.avatar}`}
            >
              {imagePreview ? (
                <Image
                  src={imagePreview}
                  alt="Profile"
                  width={96}
                  height={96}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${profileTheme.avatarFallback}`}>
                  <span className={`text-3xl font-bold tracking-tighter ${profileTheme.avatarLetter}`}>
                    {profileUser.firstname?.[0]?.toUpperCase() || profileUser.email?.[0]?.toUpperCase() || "U"}
                  </span>
                </div>
              )}
              <div className="absolute inset-0 rounded-2xl ring-1 ring-inset ring-slate-200 dark:ring-white/10" />
            </motion.div>

            {/* Identity */}
            <div className="flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-2 mb-2">
                <h1 className={`text-2xl font-bold tracking-tight sm:text-3xl ${profileTheme.heading}`}>
                  {displayName}
                </h1>
                <StatusBadge variant={isSuperAdmin ? "info" : "default"}>
                  {roleLabel}
                </StatusBadge>
                <StatusBadge variant={profileUser.blocked ? "error" : "success"}>
                  {statusLabel}
                </StatusBadge>
              </div>
              <p className={`text-sm font-medium ${profileTheme.body}`}>{profileUser.email || "—"}</p>
              <p className={`mt-1 text-xs ${profileTheme.faint}`}>Last login: {lastLoginLabel}</p>
            </div>

            {/* Image Upload */}
            <div className="shrink-0">
              <label className={`group relative flex cursor-pointer items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors ${profileTheme.uploadBtn}`}>
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Change Photo
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageChange}
                  className="sr-only"
                />
              </label>
              {errors.image && (
                <motion.p
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="mt-2 text-xs text-red-600 dark:text-red-400"
                >
                  {errors.image}
                </motion.p>
              )}
              <p className={`mt-2 text-[11px] ${profileTheme.faint}`}>JPG, PNG, GIF · Max 5MB</p>
            </div>
          </div>
        </GlassCard>

        {/* Bento Grid - Access Assignments */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className={`text-sm font-semibold tracking-tight ${profileTheme.subheading}`}>Access Assignments</h2>
            {accessAssignmentsQuery.data?.isSuperAdmin && (
              <StatusBadge variant="info">Full Access</StatusBadge>
            )}
          </div>
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            {(["faculties", "departments", "programs"] as const).map((key, idx) => {
              const items = accessAssignmentsQuery.data?.[key] ?? [];
              const isLoading = accessAssignmentsQuery.isLoading;
              const isAll = accessAssignmentsQuery.data?.isSuperAdmin;
              const labels = { faculties: "Faculties", departments: "Departments", programs: "Programs" };
              const colors = ["from-sky-500/10", "from-violet-500/10", "from-emerald-500/10"] as const;

              return (
                <GlassCard key={key} className="p-5" hover>
                  <div className="mb-4 flex items-center justify-between">
                    <span className={`text-sm font-medium tracking-tight ${profileTheme.subheading}`}>{labels[key]}</span>
                    <span className={`text-xs font-medium ${profileTheme.muted}`}>
                      {isLoading ? "…" : isAll ? "All" : items.length}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {isAll ? (
                      <StatusBadge>All {labels[key]}</StatusBadge>
                    ) : items.length > 0 ? (
                      items.map((item) => (
                        <motion.span
                          key={item}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className={`inline-flex items-center rounded-lg border border-slate-200 bg-gradient-to-r ${colors[idx]} to-transparent px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-white/5 dark:text-slate-300`}
                        >
                          {item}
                        </motion.span>
                      ))
                    ) : (
                      <span className={`text-xs ${profileTheme.faint}`}>No assigned {key}</span>
                    )}
                  </div>
                </GlassCard>
              );
            })}
          </div>
        </motion.div>

        {/* Tab Navigation */}
        <motion.div variants={itemVariants} className="mb-6">
          <div className={`flex gap-1 rounded-xl ${profileTheme.tabShell}`}>
            {(["general", "security"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className="relative flex-1 rounded-lg py-2.5 text-sm font-medium tracking-tight transition-colors"
              >
                {activeTab === tab && (
                  <motion.div
                    layoutId="activeTab"
                    className={`absolute inset-0 rounded-lg ${profileTheme.tabActiveBg}`}
                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                  />
                )}
                <span
                  className={`relative z-10 ${
                    activeTab === tab ? profileTheme.tabActiveText : profileTheme.tabInactiveText
                  }`}
                >
                  {tab === "general" ? "General" : "Security"}
                </span>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Form Content */}
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 12, filter: "blur(4px)" }}
            animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
            exit={{ opacity: 0, y: -12, filter: "blur(4px)" }}
            transition={{ duration: 0.3, ease: "easeOut" }}
          >
            {activeTab === "general" ? (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Account Info */}
                <GlassCard className="p-6" hover>
                  <h3 className={`mb-5 text-sm font-semibold tracking-tight ${profileTheme.subheading}`}>Account Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>
                        Email Address <span className={profileTheme.faint}>*</span>
                      </label>
                      <input
                        type="email"
                        value={formData.email}
                        onChange={(e) => handleInputChange("email", e.target.value)}
                        readOnly={isRestrictedStaff}
                        className={`${profileTheme.input} ${
                          errors.email ? "border-red-400 dark:border-red-500/50" : ""
                        } ${isRestrictedStaff ? "cursor-not-allowed opacity-50" : ""}`}
                      />
                      {errors.email && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                          {errors.email}
                        </motion.p>
                      )}
                    </div>

                    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                      <div>
                        <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>First Name</label>
                        <input
                          type="text"
                          value={formData.firstname}
                          onChange={(e) => handleInputChange("firstname", e.target.value)}
                          readOnly={isRestrictedStaff}
                          className={`${profileTheme.input} ${
                            isRestrictedStaff ? "cursor-not-allowed opacity-50" : ""
                          }`}
                        />
                      </div>
                      <div>
                        <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>Last Name</label>
                        <input
                          type="text"
                          value={formData.lastname}
                          onChange={(e) => handleInputChange("lastname", e.target.value)}
                          readOnly={isRestrictedStaff}
                          className={`${profileTheme.input} ${
                            isRestrictedStaff ? "cursor-not-allowed opacity-50" : ""
                          }`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>Department</label>
                      <input
                        type="text"
                        value={formData.department}
                        onChange={(e) => handleInputChange("department", e.target.value)}
                        readOnly={!isSuperAdmin}
                        className={`${profileTheme.input} ${
                          !isSuperAdmin ? "cursor-not-allowed opacity-50" : ""
                        }`}
                      />
                    </div>
                  </div>
                </GlassCard>

                {/* System Info */}
                <GlassCard className="p-6" hover>
                  <h3 className={`mb-5 text-sm font-semibold tracking-tight ${profileTheme.subheading}`}>System Information</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>User Type</label>
                      <div className={`flex items-center gap-2 ${profileTheme.staticField}`}>
                        <span className={`text-sm ${profileTheme.body}`}>{profileUser.type || "N/A"}</span>
                      </div>
                    </div>
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>Account Status</label>
                      <div className={`flex items-center gap-2 ${profileTheme.staticField}`}>
                        <span className={`inline-block h-2 w-2 rounded-full ${profileUser.blocked ? "bg-red-500 dark:bg-red-400" : "bg-emerald-500 dark:bg-emerald-400"}`} />
                        <span className={`text-sm ${profileTheme.body}`}>{profileUser.blocked ? "Blocked" : "Active"}</span>
                      </div>
                    </div>
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>User ID</label>
                      <Tooltip content="Your unique identifier in the system">
                        <div className={`flex cursor-help items-center gap-2 ${profileTheme.staticField}`}>
                          <span className={`text-sm font-mono ${profileTheme.muted}`}>#{profileUser.userid}</span>
                          <svg className={`h-3.5 w-3.5 ${profileTheme.faint}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                        </div>
                      </Tooltip>
                    </div>
                  </div>
                </GlassCard>
              </div>
            ) : (
              <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
                {/* Security */}
                <GlassCard className="p-6" hover>
                  <h3 className={`mb-5 text-sm font-semibold tracking-tight ${profileTheme.subheading}`}>Password</h3>
                  <div className="space-y-4">
                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>
                        Current Password
                      </label>
                      <Tooltip content="Stored as plain text (legacy)">
                        <div className={`flex cursor-help items-center gap-2 ${profileTheme.staticField}`}>
                          <span className={`text-sm font-mono ${profileTheme.muted}`}>
                            {formData.currentPassword || "—"}
                          </span>
                        </div>
                      </Tooltip>
                      <p className={`mt-1.5 text-[11px] ${profileTheme.faint}`}>Your current password from the database</p>
                    </div>

                    <div>
                      <label className={`mb-1.5 block text-xs font-medium tracking-tight ${profileTheme.label}`}>
                        New Password
                      </label>
                      <input
                        type="password"
                        value={formData.newPassword}
                        onChange={(e) => handleInputChange("newPassword", e.target.value)}
                        placeholder="Enter new password"
                        className={`${profileTheme.input} ${
                          errors.newPassword ? "border-red-400 dark:border-red-500/50" : ""
                        }`}
                      />
                      {errors.newPassword && (
                        <motion.p initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="mt-1.5 text-xs text-red-600 dark:text-red-400">
                          {errors.newPassword}
                        </motion.p>
                      )}
                      <p className={`mt-1.5 text-[11px] ${profileTheme.faint}`}>Leave blank to keep current. Minimum 8 characters.</p>
                    </div>
                  </div>
                </GlassCard>

                {/* Advanced Security */}
                <AccordionSection title="Advanced Security Settings" defaultOpen={false}>
                  <div className={`space-y-3 text-sm ${profileTheme.body}`}>
                    <div className={`flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]`}>
                      <div>
                        <p className={`font-medium ${profileTheme.subheading}`}>Two-Factor Authentication</p>
                        <p className={`mt-0.5 text-xs ${profileTheme.faint}`}>Add an extra layer of security</p>
                      </div>
                      <StatusBadge variant="warning">Coming Soon</StatusBadge>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]`}>
                      <div>
                        <p className={`font-medium ${profileTheme.subheading}`}>Session Management</p>
                        <p className={`mt-0.5 text-xs ${profileTheme.faint}`}>Manage active sessions</p>
                      </div>
                      <StatusBadge variant="warning">Coming Soon</StatusBadge>
                    </div>
                    <div className={`flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 dark:border-white/[0.04] dark:bg-white/[0.02]`}>
                      <div>
                        <p className={`font-medium ${profileTheme.subheading}`}>Login History</p>
                        <p className={`mt-0.5 text-xs ${profileTheme.faint}`}>View recent login activity</p>
                      </div>
                      <StatusBadge variant="warning">Coming Soon</StatusBadge>
                    </div>
                  </div>
                </AccordionSection>
              </div>
            )}
          </motion.div>
        </AnimatePresence>

        {/* Actions */}
        <motion.div variants={itemVariants} className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-end">
          <MagneticButton variant="ghost" onClick={() => currentUserQuery.refetch()} disabled={saving}>
            Discard Changes
          </MagneticButton>
          <MagneticButton variant="primary" onClick={handleSubmit} disabled={saving}>
            {saving ? (
              <span className="flex items-center gap-2">
                <motion.span
                  animate={{ rotate: 360 }}
                  transition={{ duration: 1, repeat: Infinity, ease: "linear" }}
                  className="inline-block h-3.5 w-3.5 rounded-full border-2 border-slate-500 border-t-transparent dark:border-slate-400"
                />
                Saving...
              </span>
            ) : (
              "Save Changes"
            )}
          </MagneticButton>
        </motion.div>
      </motion.div>
    </div>
  );
}