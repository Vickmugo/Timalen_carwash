"use client";

/**
 * THE NAME ON THE STAFF SESSION, FOR THE CLIENT COMPONENTS THAT SHOW IT.
 *
 * Read once, server-side, in ./layout.tsx from the signed cookie, and
 * handed down here. It is for DISPLAY and for the few records that still
 * live in this browser's localStorage (change requests). Everything written
 * to the server is attributed by the server from the cookie itself; no
 * request sends a name.
 */

import { createContext, useContext, useEffect } from "react";

const StaffNameContext = createContext<string>("");

/** The sessionStorage key the old "Acting as" box used. */
const LEGACY_ACTOR_KEY = "demo.actingAs";

export function StaffNameProvider({
  name,
  children,
}: {
  name: string;
  children: React.ReactNode;
}) {
  // Clears the name tag the old "Acting as" box left in this tab, so no
  // stale self-typed name lingers in storage after the change.
  useEffect(() => {
    try {
      window.sessionStorage.removeItem(LEGACY_ACTOR_KEY);
    } catch {
      // storage blocked; nothing to clear
    }
  }, []);

  return <StaffNameContext.Provider value={name}>{children}</StaffNameContext.Provider>;
}

export function useStaffName(): string {
  return useContext(StaffNameContext);
}
