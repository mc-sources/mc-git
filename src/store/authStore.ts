import { create } from "zustand";

interface AuthStore {
  // HTTPS credential modal
  pendingHost: string | null;
  showAuthModal: (host: string) => void;
  hideAuthModal: () => void;
  // SSH TOFU (Trust On First Use) modal
  pendingTofuHost: string | null;
  pendingTofuFingerprint: string | null;
  pendingTofuRetry: (() => Promise<void>) | null;
  showTofuModal: (
    host: string,
    fingerprint: string,
    retry: () => Promise<void>
  ) => void;
  hideTofuModal: () => void;
}

export const useAuthStore = create<AuthStore>((set) => ({
  pendingHost: null,
  showAuthModal: (host) => set({ pendingHost: host }),
  hideAuthModal: () => set({ pendingHost: null }),
  pendingTofuHost: null,
  pendingTofuFingerprint: null,
  pendingTofuRetry: null,
  showTofuModal: (host, fingerprint, retry) =>
    set({ pendingTofuHost: host, pendingTofuFingerprint: fingerprint, pendingTofuRetry: retry }),
  hideTofuModal: () =>
    set({ pendingTofuHost: null, pendingTofuFingerprint: null, pendingTofuRetry: null }),
}));
