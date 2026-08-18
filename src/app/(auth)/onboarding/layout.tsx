import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function OnboardingLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center bg-background px-4 py-8">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold">adswish</span>
        </Link>
      </div>
      <div className="w-full max-w-2xl">{children}</div>
    </div>
  );
}
