/**
 * Node (v20+) can expose Web Storage globals that throw SecurityError unless
 * `node --localstorage-file=...` is set. Next may execute code during RSC/SSR
 * that touches localStorage/sessionStorage — replace with an in-memory Storage
 * when the built-in implementation is unusable.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;

  const createMemoryStorage = (): Storage => {
    const map = new Map<string, string>();
    return {
      get length() {
        return map.size;
      },
      clear() {
        map.clear();
      },
      getItem(key: string) {
        return map.get(String(key)) ?? null;
      },
      key(index: number) {
        return [...map.keys()][index] ?? null;
      },
      removeItem(key: string) {
        map.delete(String(key));
      },
      setItem(key: string, value: string) {
        map.set(String(key), String(value));
      },
    };
  };

  const patchIfBroken = (name: "localStorage" | "sessionStorage") => {
    try {
      const current = (globalThis as unknown as Record<string, unknown>)[name] as Storage | undefined;
      if (current && typeof current.getItem === "function") {
        current.getItem("__next_storage_probe__");
        return;
      }
    } catch {
      // Native storage exists but throws (Node without --localstorage-file)
    }

    try {
      Object.defineProperty(globalThis, name, {
        value: createMemoryStorage(),
        configurable: true,
        enumerable: true,
        writable: true,
      });
    } catch {
      // Property may be non-configurable; user can set NODE_OPTIONS instead
    }
  };

  patchIfBroken("localStorage");
  patchIfBroken("sessionStorage");
}
