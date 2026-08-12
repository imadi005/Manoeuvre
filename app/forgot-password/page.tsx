import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
import { requestPasswordReset } from "./actions";

export default function ForgotPasswordPage() {
  return (
    <>
      <Navbar />
      <main className="scanlines relative flex min-h-screen items-center justify-center bg-void px-5 py-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-sm">
          <AuthForm
            action={requestPasswordReset}
            title="Forgot Password"
            subtitle="Enter your username or roll number — we'll send a verification code to your KJIT email so you can set a new password."
            submitLabel="Send Code"
            fields={[{ name: "identifier", label: "Username / Roll Number", placeholder: "24MCA001" }]}
          />
          <p className="mt-4 text-center font-mono-fx text-xs uppercase tracking-widest text-fog-dim">
            Remember your password?{" "}
            <a href="/login" className="text-cyan transition-colors hover:text-fog">
              Log in
            </a>
          </p>
        </div>
      </main>
      <Footer />
    </>
  );
}
