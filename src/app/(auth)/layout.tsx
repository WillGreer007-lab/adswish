import { CheckCircle2 } from "lucide-react";
import Link from "next/link";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background px-4">
      <div className="mb-8">
        <Link href="/" className="flex items-center gap-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-md bg-primary">
            <CheckCircle2 className="h-5 w-5 text-white" />
          </div>
          <span className="font-heading text-xl font-bold">adswish</span>
        </Link>
      </div>
      {children}
    </div>
  );
}
