import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
import ResendOtpButton from "@/components/ResendOtpButton";
import { verifyOtp } from "./actions";

export default async function VerifyOtpPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (!session.mustReset) redirect("/login");

  return (
    <>
      <Navbar />
      <main className="scanlines relative flex min-h-screen items-center justify-center bg-void px-5 py-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-sm">
          <AuthForm
            action={verifyOtp}
            title="Verify It's You"
            subtitle="We've sent a 6-digit code to your KJIT email — enter it below before setting a new password."
            submitLabel="Verify & Continue"
            fields={[
              { name: "code", label: "6-Digit Code", type: "text", placeholder: "000000", autoComplete: "one-time-code" },
            ]}
          />
          <ResendOtpButton />
        </div>
      </main>
      <Footer />
    </>
  );
}
