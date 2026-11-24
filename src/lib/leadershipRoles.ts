/**
 * Canonical leadership role names shared by forms, API validators, and admin screens.
 * role_name values are stored in public.leadership_roles and filtered via substring
 * matching on stored position text (see leadershipRoleSql.ts).
 */
export const LEADERSHIP_ROLE_NAMES = [
  "president",
  "vice_president",
  "coordinator",
  "secretary_general",
  "vice_president_regional_affairs",
  "vice_president_administrative_affairs",
  "coordinator_regional_affairs",
  "coordinator_administrative_affairs",
] as const;

export type LeadershipRoleName = (typeof LEADERSHIP_ROLE_NAMES)[number];

const ROLE_NAME_SET: ReadonlySet<string> = new Set(LEADERSHIP_ROLE_NAMES);

export const LEADERSHIP_ROLE_LABELS: Record<LeadershipRoleName, string> = {
  president: "President",
  vice_president: "Vice President",
  coordinator: "Coordinator",
  secretary_general: "Secretary General",
  vice_president_regional_affairs: "Vice President Regional Affairs",
  vice_president_administrative_affairs: "Vice President Administrative Affairs",
  coordinator_regional_affairs: "Coordinator Regional Affairs",
  coordinator_administrative_affairs: "Coordinator Administrative Affairs",
};

export function parseLeadershipRoleName(v: string | null | undefined): LeadershipRoleName | null {
  return v != null && ROLE_NAME_SET.has(v) ? (v as LeadershipRoleName) : null;
}

/**
 * Infer the canonical role_name from free-text stored position values
 * (chapter_leadership.post / association_leadership.q3). Stored values are
 * inconsistent camelCase/concatenated strings (e.g. "vicePresident",
 * "chapterpresident"), so matching is substring-based. Specific compound
 * roles are checked before their generic counterparts.
 */
/**
 * Application-form post options. `value` is the string submitted and stored
 * in the application's position column; `roleName` is the canonical
 * role_name used for criteria/role-description lookups.
 */
export const LEADERSHIP_POST_OPTIONS = [
  { value: "president", label: "President", roleName: "president" },
  { value: "vicePresident", label: "Vice President", roleName: "vice_president" },
  { value: "coordinator", label: "Coordinator", roleName: "coordinator" },
  { value: "secretaryGeneral", label: "Secretary General", roleName: "secretary_general" },
  { value: "vicePresidentRegionalAffairs", label: "Vice President Regional Affairs", roleName: "vice_president_regional_affairs" },
  { value: "vicePresidentAdministrativeAffairs", label: "Vice President Administrative Affairs", roleName: "vice_president_administrative_affairs" },
  { value: "coordinatorRegionalAffairs", label: "Coordinator Regional Affairs", roleName: "coordinator_regional_affairs" },
  { value: "coordinatorAdministrativeAffairs", label: "Coordinator Administrative Affairs", roleName: "coordinator_administrative_affairs" },
] as const;

export function postValueToRoleName(v: string | null | undefined): LeadershipRoleName | null {
  const opt = LEADERSHIP_POST_OPTIONS.find((o) => o.value === v);
  return opt ? opt.roleName : null;
}

export function inferRoleNameFromPosition(position: string): LeadershipRoleName {
  const s = String(position || "").toLowerCase();
  if (s.includes("secretary")) return "secretary_general";
  const isRegional = s.includes("regional");
  const isAdministrative = s.includes("administrative");
  if (s.includes("vice")) {
    if (isRegional) return "vice_president_regional_affairs";
    if (isAdministrative) return "vice_president_administrative_affairs";
    return "vice_president";
  }
  if (s.includes("coordinator")) {
    if (isRegional) return "coordinator_regional_affairs";
    if (isAdministrative) return "coordinator_administrative_affairs";
    return "coordinator";
  }
  return "president";
}
