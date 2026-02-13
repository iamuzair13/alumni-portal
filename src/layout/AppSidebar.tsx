"use client";
import React, { useEffect, useRef, useState,useCallback, Suspense } from "react";
import Link from "next/link";
import Image from "next/image";
import { usePathname, useSearchParams } from "next/navigation";
import { useSidebar } from "../context/SidebarContext";
import { useSession } from "next-auth/react";
import { isAdminUser, isSuperAdminUser, isViewerUser } from "@/lib/alumniProfile";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CalenderIcon,
  ChevronDownIcon,
  GridIcon,
  HorizontaLDots,
  PageIcon,
  UserCircleIcon,
  BoltIcon,
} from "../icons/index";

type NavItem = {
  name: string;
  icon: React.ReactNode;
  path?: string;
  subItems?: { name: string; path: string; pro?: boolean; new?: boolean }[];
};

const navItems: NavItem[] = [
  {
    icon: <GridIcon />,
    name: "Dashboard",
    subItems: [
      { name: "Dashboard", path: "/dashboard?tab=dashboard" },
      { name: "Alumni Cards", path: "/dashboard?tab=alumni-cards" },
      { name: "Alumni Talks", path: "/dashboard?tab=alumni-talks" },
      { name: "Alumni Chapters", path: "/dashboard?tab=alumni-chapters" },
      { name: "Alumni Association", path: "/dashboard?tab=alumni-association" },
      { name: "Alumni Scholarships", path: "/dashboard?tab=alumni-scholarships" },
      { name: "Alumni Memberships", path: "/dashboard?tab=alumni-memberships" },
      { name: "Jobs", path: "/dashboard?tab=jobs" },
      { name: "Add Alumni", path: "/dashboard?tab=add-alumni" },
    ],
  },
 
  {
    icon: <PageIcon />,
    name: "Stories Management", //add dropdown with add and view
    path: "/alumni-stories",
  },
  {
    icon: <CalenderIcon />,
    name: "Events Management", //add dropdown with add and view
    path: "/events",
  },
  {
    icon: <UserCircleIcon />,
    name: "Leadership", 
    path: "/leadership",
  },
  {
    icon: <BoltIcon />,
    name: "Setup",
    subItems: [
      { name: "Users", path: "/setup?tab=users" },
      { name: "Organizations", path: "/setup?tab=organizations" },
      { name: "Chapters", path: "/setup?tab=chapters" },
      { name: "Newsletters", path: "/setup?tab=newsletters" },
      { name: "Activity Logs", path: "/activity-logs" },
    ],
  },
];


const TEXT_COLORS = {
  active: "text-white",
  inactive: "text-white/80",
  hover: "group-hover:text-white",
  focus: "focus-visible:text-white",
};

const AppSidebarContent: React.FC = () => {
  const { isExpanded, isMobileOpen, isHovered, setIsHovered } = useSidebar();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const queryClient = useQueryClient();

  const { data: session } = useSession();
  const isSuperAdmin = isSuperAdminUser(session?.user);
  const isAdmin = isAdminUser(session?.user);
  const isViewer = isViewerUser(session?.user);
  const canSeeSetup = isSuperAdmin && !isAdmin && !isViewer;

  const {
    data: leadershipCountsData,
    isLoading: leadershipCountsLoading,
    isFetching: leadershipCountsFetching,
  } = useQuery({
    queryKey: ["leadership-counts"],
    queryFn: async () => {
      const res = await fetch("/api/leadership/counts", { headers: { accept: "application/json" } });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error((j as any)?.error || `Failed (${res.status})`);
      }
      const j = (await res.json()) as { counts?: { all?: number; pending?: number } };
      return { all: Number(j.counts?.all || 0), pending: Number(j.counts?.pending || 0) };
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    refetchOnMount: false,
  });

  useEffect(() => {
    // When on leadership page, keep counts fresh after any actions trigger invalidation.
    if (pathname === "/leadership") {
      queryClient.invalidateQueries({ queryKey: ["leadership-counts"], exact: false });
    }
  }, [pathname, queryClient]);

  const renderMenuItems = (
    navItems: NavItem[],
    menuType: "main" | "others"
  ) => (
    <ul className="flex flex-col gap-1">
      {navItems.map((nav, index) => (
        <li key={nav.name}>
          {nav.subItems ? (
            <button
              onClick={() => handleSubmenuToggle(index, menuType)}
              className={`menu-item group text-white/90 ${
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? "bg-white/10"
                  : "bg-transparent"
              } cursor-pointer rounded-xl px-3 py-2.5 transition-colors hover:bg-white/10 focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                !isExpanded && !isHovered
                  ? "lg:justify-center"
                  : "lg:justify-start"
              }`}
              aria-expanded={
                openSubmenu?.type === menuType && openSubmenu?.index === index
                  ? true
                  : false
              }
              aria-controls={`${menuType}-${index}-submenu`}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  handleSubmenuToggle(index, menuType);
                }
              }}
            >
              <span
                className={` ${
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? "text-white"
                    : "text-white/80 group-hover:text-white"
                }`}
              >
                {nav.icon}
              </span>
              {(isExpanded || isHovered || isMobileOpen) && (
                <span
                  className={`menu-item-text ${
                    openSubmenu?.type === menuType && openSubmenu?.index === index
                      ? TEXT_COLORS.active
                      : TEXT_COLORS.inactive
                  } ${TEXT_COLORS.hover} ${TEXT_COLORS.focus} transition-colors duration-200`}
                >
                  {nav.name}
                </span>
              )}
              {(isExpanded || isHovered || isMobileOpen) && (
                <ChevronDownIcon
                  className={`ml-auto w-5 h-5 transition-transform duration-200 text-white/80 group-hover:text-white ${
                    openSubmenu?.type === menuType &&
                    openSubmenu?.index === index
                      ? "rotate-180 text-white"
                      : ""
                  }`}
                />
              )}
            </button>
          ) : (
            nav.path && (
              <Link
                href={nav.path}
                className={`menu-item group rounded-xl px-3 py-2.5 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                  isActive(nav.path) ? "bg-white/10" : "bg-transparent hover:bg-white/10"
                }`}
                aria-current={isActive(nav.path) ? "page" : undefined}
              >
                <span
                  className={`${
                    isActive(nav.path)
                      ? "text-white"
                      : "text-white/80 group-hover:text-white"
                  }`}
                >
                  {nav.icon}
                </span>
                {(isExpanded || isHovered || isMobileOpen) && (
                  <span
                    className={`menu-item-text ${
                      isActive(nav.path) ? TEXT_COLORS.active : TEXT_COLORS.inactive
                    } ${TEXT_COLORS.hover} ${TEXT_COLORS.focus} transition-colors duration-200`}
                  >
                    <span className="inline-flex items-center gap-2">
                      {nav.name}
                      {nav.name === "Leadership" && (
                        <span className="inline-flex items-center gap-1">
                          {(leadershipCountsLoading || leadershipCountsFetching) && !leadershipCountsData ? (
                            <span className="inline-flex items-center justify-center h-4 w-8">
                              <span className="h-3 w-3 rounded-full border-2 border-white/30 border-t-white animate-spin" />
                            </span>
                          ) : leadershipCountsData ? (
                            <>
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-white/15 text-white border border-white/20">{leadershipCountsData.all}</span>
                              <span className="text-[10px] text-white/50">/</span>
                              <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold leading-none bg-white/15 text-white border border-white/20">{leadershipCountsData.pending}</span>
                            </>
                          ) : null}
                        </span>
                      )}
                    </span>
                  </span>
                )}
              </Link>
            )
          )}
          {nav.subItems && (isExpanded || isHovered || isMobileOpen) && (
            <div
              ref={(el) => {
                subMenuRefs.current[`${menuType}-${index}`] = el;
              }}
              className="overflow-hidden transition-all duration-300"
              id={`${menuType}-${index}-submenu`}
              style={{
                height:
                  openSubmenu?.type === menuType && openSubmenu?.index === index
                    ? `${subMenuHeight[`${menuType}-${index}`]}px`
                    : "0px",
              }}
            >
              <ul className="mt-1 space-y-1 ml-9">
                {nav.subItems.map((subItem) => (
                  <li key={subItem.name}>
                    <Link
                      href={subItem.path}
                      className={`menu-dropdown-item rounded-lg px-3 py-2 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-white/30 ${
                        isActive(subItem.path)
                          ? "bg-white/10 text-white"
                          : "text-white/80 hover:bg-white/10 hover:text-white"
                      }`}
                      aria-current={isActive(subItem.path) ? "page" : undefined}
                    >
                      {subItem.name}
                      <span className="flex items-center gap-1 ml-auto">
                        {subItem.new && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            new
                          </span>
                        )}
                        {subItem.pro && (
                          <span
                            className={`ml-auto ${
                              isActive(subItem.path)
                                ? "menu-dropdown-badge-active"
                                : "menu-dropdown-badge-inactive"
                            } menu-dropdown-badge `}
                          >
                            pro
                          </span>
                        )}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}
        </li>
      ))}
    </ul>
  );

  const [openSubmenu, setOpenSubmenu] = useState<{
    type: "main" | "others";
    index: number;
  } | null>(null);
  const [subMenuHeight, setSubMenuHeight] = useState<Record<string, number>>(
    {}
  );
  const subMenuRefs = useRef<Record<string, HTMLDivElement | null>>({});

  // const isActive = (path: string) => path === pathname;
   const isActive = useCallback((path: string) => {
     // Handle dashboard routes with query parameters
     if (path.startsWith("/dashboard")) {
       // Parse the tab from the path string
       const pathMatch = path.match(/[?&]tab=([^&]*)/);
       const pathTab = pathMatch ? pathMatch[1] : null;
       const currentTab = searchParams.get("tab");
       
       // If pathname is /dashboard
       if (pathname === "/dashboard") {
         // If path has a tab, check if it matches current tab
         if (pathTab) {
           return pathTab === currentTab;
         }
         // If path has no tab, it's the default dashboard (tab=dashboard)
         // Check if current tab is dashboard or null/undefined
         return !currentTab || currentTab === "dashboard";
       }
     }
     return path === pathname;
   }, [pathname, searchParams]);

  useEffect(() => {
    let submenuMatched = false;
    const items = canSeeSetup ? navItems : navItems.filter((i) => i.name !== "Setup");
    items.forEach((nav, index) => {
      if (nav.subItems) {
        nav.subItems.forEach((subItem) => {
          if (isActive(subItem.path)) {
            setOpenSubmenu({ type: "main", index });
            submenuMatched = true;
          }
        });
      }
    });
    if (!submenuMatched) {
      setOpenSubmenu(null);
    }
  }, [pathname, isActive]);

  useEffect(() => {
    // Set the height of the submenu items when the submenu is opened
    if (openSubmenu !== null) {
      const key = `${openSubmenu.type}-${openSubmenu.index}`;
      if (subMenuRefs.current[key]) {
        setSubMenuHeight((prevHeights) => ({
          ...prevHeights,
          [key]: subMenuRefs.current[key]?.scrollHeight || 0,
        }));
      }
    }
  }, [openSubmenu]);

  const handleSubmenuToggle = (index: number, menuType: "main" | "others") => {
    setOpenSubmenu((prevOpenSubmenu) => {
      if (
        prevOpenSubmenu &&
        prevOpenSubmenu.type === menuType &&
        prevOpenSubmenu.index === index
      ) {
        return null;
      }
      return { type: menuType, index };
    });
  };

  return (
    <aside
      className={`fixed flex flex-col lg:mt-0 top-0 left-0 bg-[#183D32] text-white shadow-lg h-screen transition-all duration-300 ease-in-out z-50 border-r border-white/10 
        ${
          isExpanded || isMobileOpen
            ? "w-[290px]"
            : isHovered
            ? "w-[290px]"
            : "w-[90px]"
        }
        ${isMobileOpen ? "translate-x-0" : "-translate-x-full"}
        lg:translate-x-0`}
      onMouseEnter={() => !isExpanded && setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div
        className={`py-8 ${
          !isExpanded && !isHovered ? "lg:justify-center" : "justify-start"
        }`}
      >
        <Link href="/dashboard">
          {isExpanded || isHovered || isMobileOpen ? (
            <>
              <Image
                className="dark:hidden"
                src="/images/logo/UOL-LOGO-White.png"
                alt="Logo"
                width={150}
                height={40}
              />
              <Image
                className="hidden dark:block"
                src="/images/logo/UOL-Rebrand-ID_Final-03.png"
                alt="Logo"
                width={150}
                height={40}
              />
            </>
          ) : (
           ""
          )}
        </Link>
      </div>
      <div className="flex flex-col overflow-y-auto duration-300 ease-linear no-scrollbar px-4">
        <nav className="mb-6">
          <div className="flex flex-col gap-4">
            <div>
              <h2
                className={`mb-4 text-xs uppercase flex leading-[20px] tracking-wider text-white/70 ${
                  !isExpanded && !isHovered
                    ? "lg:justify-center"
                    : "justify-start"
                }`}
              >
                {isExpanded || isHovered || isMobileOpen ? (
                  "Menu"
                ) : (
                  <HorizontaLDots />
                )}
              </h2>
              {renderMenuItems(canSeeSetup ? navItems : navItems.filter((i) => i.name !== "Setup"), "main")}
            </div>
            
          </div>
        </nav>
      </div>
    </aside>
  );
};

const AppSidebar: React.FC = () => {
  return (
    <Suspense fallback={
      <aside className="fixed mt-16 flex flex-col lg:mt-0 top-0 px-5 left-0 bg-gradient-to-b from-white to-gray-50 text-gray-900 shadow-sm dark:from-gray-950 dark:to-gray-900 dark:border-gray-800 h-screen transition-all duration-300 ease-in-out z-50 border-r border-gray-200 w-[90px] lg:translate-x-0">
        <div className="py-8 lg:justify-center"></div>
      </aside>
    }>
      <AppSidebarContent />
    </Suspense>
  );
};

export default AppSidebar;
