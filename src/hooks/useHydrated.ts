"use client";

import { useSyncExternalStore } from "react";
import { useOffice } from "@/lib/store/office-store";

/** True once persisted office state has been loaded from localStorage. */
export function useHydrated() {
  return useSyncExternalStore(
    (cb) => useOffice.persist.onFinishHydration(cb),
    () => useOffice.persist.hasHydrated(),
    () => false,
  );
}
