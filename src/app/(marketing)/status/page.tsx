import type { Metadata } from "next";
import { PublicStatus } from "@/components/marketing/public-status";

export const metadata: Metadata = {
  title: "System status — Adswish",
  description: "Live Adswish application and database status.",
};

export default function StatusPage() {
  return <PublicStatus />;
}
