const AUTH_KEYS = ["userId", "adminId", "sessionUserId", "sessionToken"] as const;

type AuthKey = (typeof AUTH_KEYS)[number];

const readStorage = (storage: Storage | undefined, key: AuthKey) => {
  try {
    return storage?.getItem(key) ?? null;
  } catch {
    return null;
  }
};

const writeStorage = (storage: Storage | undefined, key: AuthKey, value: string) => {
  try {
    storage?.setItem(key, value);
  } catch {
    // Some mobile browsers can reject storage writes in private mode.
  }
};

const removeStorage = (storage: Storage | undefined, key: AuthKey) => {
  try {
    storage?.removeItem(key);
  } catch {
    // Ignore storage cleanup failures.
  }
};

const local = () => (typeof window === "undefined" ? undefined : window.localStorage);
const session = () => (typeof window === "undefined" ? undefined : window.sessionStorage);

export const authStorage = {
  get(key: AuthKey) {
    const saved = readStorage(local(), key) ?? readStorage(session(), key);
    if (saved) writeStorage(local(), key, saved);
    return saved;
  },
  set(key: AuthKey, value: string) {
    writeStorage(local(), key, value);
    writeStorage(session(), key, value);
  },
  remove(key: AuthKey) {
    removeStorage(local(), key);
    removeStorage(session(), key);
  },
  clear() {
    AUTH_KEYS.forEach((key) => this.remove(key));
  },
};
