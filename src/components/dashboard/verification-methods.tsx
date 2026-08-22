"use client";

import { useEffect, useState } from "react";
import { VerificationMethodPicker } from "@/components/verification/method-picker";
import { AutomationSetup } from "@/components/verification/automation-setup";
import { ManualFollowerVerification } from "@/components/dashboard/manual-follower-verification";
import { SocialConnections, type SocialAccount } from "@/components/dashboard/social-connections";
import {
  automationStatus,
  manualStatus,
  type VerificationMethod,
} from "@/lib/verification-methods";

/**
 * Settings "Connected accounts" orchestrator: shows the two-box method picker
 * (automation setup vs manual sign up) with live status badges, then renders
 * the steps for whichever method the creator picks. The connected list stays
 * visible below so they always see what's linked.
 */
export function VerificationMethods({ initial }: { initial: SocialAccount[] }) {
  const [method, setMethod] = useState<VerificationMethod | null>(null);
  const [verifications, setVerifications] = useState<{ status: "pending" | "approved" | "rejected" }[]>([]);
  // OAuth callbacks redirect back to the profile with ?error=... — read once.
  const [oauthError] = useState(
    () => new URLSearchParams(window.location.search).get("error") !== null,
  );

  useEffect(() => {
    fetch("/api/internal/manual-verifications")
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => {
        if (j?.verifications) setVerifications(j.verifications);
      })
      .catch(() => {});
  }, []);

  const automationStat = automationStatus(initial, oauthError);
  const manualStat = manualStatus(verifications);

  return (
    <div className="space-y-4">
      <VerificationMethodPicker
        automationStatus={automationStat}
        manualStatus={manualStat}
        selected={method}
        onSelect={setMethod}
      />

      {method === "automation" && (
        <AutomationSetup redirectTo="/dashboard/creator/profile" />
      )}
      {method === "manual" && <ManualFollowerVerification />}

      <SocialConnections initial={initial} />
    </div>
  );
}
