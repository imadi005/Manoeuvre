import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth/session";
import { createAdminClient } from "@/lib/supabase/admin";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
import { resetPassword } from "./actions";

export default async function ResetPasswordPage() {
  const session = await getSession();
  if (!session) redirect("/login");
  if (session.mustReset && !session.otpVerified) redirect("/verify-otp");

  let needsEmail = session.role === "faculty";
  if (needsEmail) {
    const supabase = createAdminClient();
    const { data } = await supabase.from("organizers").select("email").eq("id", session.id).maybeSingle();
    if (data?.email) needsEmail = false;
  }

  return (
    <>
      <Navbar />
      <main className="scanlines relative flex min-h-screen items-center justify-center bg-void px-5 py-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-sm">
          <AuthForm
            action={resetPassword}
            title="Set a New Password"
            subtitle="You're using a temporary password. Set your own before continuing."
            submitLabel="Save & Continue"
            fields={[
              { name: "newPassword", label: "New Password", type: "password", autoComplete: "new-password" },
              { name: "confirmPassword", label: "Confirm Password", type: "password", autoComplete: "new-password" },
              ...(needsEmail
                ? [{ name: "email", label: "Email Address", type: "email", placeholder: "you@example.com", autoComplete: "email" }]
                : []),
            ]}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
