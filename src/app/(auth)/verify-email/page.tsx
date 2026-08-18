import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Mail } from "lucide-react";

export default function VerifyEmailPage() {
  return (
    <Card className="w-full max-w-md">
      <CardContent className="pt-6">
        <div className="flex flex-col items-center text-center">
          <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Mail className="h-6 w-6 text-primary" />
          </div>
          <h1 className="font-heading text-xl font-semibold">Verify your email</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            We sent a confirmation link to your email address.
            Click the link to verify your account and continue setup.
          </p>
          <p className="mt-4 text-xs text-muted-foreground">
            Didn&apos;t receive an email? Check your spam folder or{" "}
            <Link href="/login" className="text-primary hover:underline">
              try logging in
            </Link>{" "}
            to resend.
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
