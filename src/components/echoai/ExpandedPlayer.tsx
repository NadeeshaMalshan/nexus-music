"use client";

import { useEffect, useState } from "react";
import { DesktopExpandedPlayer } from "./DesktopExpandedPlayer";
import { MobileExpandedPlayer } from "./MobileExpandedPlayer";
import { type ExpandedPlayerProps } from "./types";

/**
 * Responsive Switcher for the Expanded Player.
 * Delegates rendering to specialized Desktop or Mobile components.
 */
export function ExpandedPlayer(props: ExpandedPlayerProps) {
  const [isMobile, setIsMobile] = useState<boolean | null>(null);

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 1024);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Avoid hydration mismatch by waiting for mount
  if (isMobile === null) return null;

  return isMobile ? (
    <MobileExpandedPlayer {...props} />
  ) : (
    <DesktopExpandedPlayer {...props} />
  );
}
