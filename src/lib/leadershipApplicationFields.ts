export const PLAN_STRATEGY_MIN_LEN = 50;
export const PLAN_STRATEGY_MAX_LEN = 1000;
export const ADDITIONAL_ACHIEVEMENTS_MIN_LEN = 50;
export const ADDITIONAL_ACHIEVEMENTS_MAX_LEN = 5000;

export function validatePlanStrategy(value: unknown): string | true {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "Please share your plan or strategy for fulfilling the responsibilities assigned for this role.";
  }
  if (trimmed.length < PLAN_STRATEGY_MIN_LEN) {
    return `Please write at least ${PLAN_STRATEGY_MIN_LEN} characters.`;
  }
  if (trimmed.length > PLAN_STRATEGY_MAX_LEN) {
    return `Please keep it under ${PLAN_STRATEGY_MAX_LEN} characters.`;
  }
  return true;
}

export function validateAdditionalAchievements(value: unknown): string | true {
  const trimmed = String(value ?? "").trim();
  if (!trimmed) {
    return "Please describe your additional achievements, leadership experience, awards, or qualifications relevant to this role.";
  }
  if (trimmed.length < ADDITIONAL_ACHIEVEMENTS_MIN_LEN) {
    return `Please write at least ${ADDITIONAL_ACHIEVEMENTS_MIN_LEN} characters.`;
  }
  if (trimmed.length > ADDITIONAL_ACHIEVEMENTS_MAX_LEN) {
    return `Please keep it under ${ADDITIONAL_ACHIEVEMENTS_MAX_LEN} characters.`;
  }
  return true;
}

export function parseRequiredPlanStrategy(value: unknown): { ok: true; value: string } | { ok: false; error: string } {
  const message = validatePlanStrategy(value);
  if (message !== true) return { ok: false, error: message };
  return { ok: true, value: String(value ?? "").trim().slice(0, PLAN_STRATEGY_MAX_LEN) };
}

export function parseRequiredAdditionalAchievements(
  value: unknown
): { ok: true; value: string } | { ok: false; error: string } {
  const message = validateAdditionalAchievements(value);
  if (message !== true) return { ok: false, error: message };
  return { ok: true, value: String(value ?? "").trim().slice(0, ADDITIONAL_ACHIEVEMENTS_MAX_LEN) };
}
