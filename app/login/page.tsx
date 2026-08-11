import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import AuthForm from "@/components/AuthForm";
import { login } from "./actions";

export default function LoginPage() {
  return (
    <>
      <Navbar />
      <main className="scanlines relative flex min-h-screen items-center justify-center bg-void px-5 py-32">
        <div className="grid-bg pointer-events-none absolute inset-0" />
        <div className="relative w-full max-w-sm">
          <AuthForm
            action={login}
            title="Grid Access"
            subtitle="Log in with your username or roll number."
            submitLabel="Enter the Grid"
            fields={[
              { name: "username", label: "Username / Roll Number", placeholder: "24MCA001" },
              { name: "password", label: "Password", type: "password" },
            ]}
          />
        </div>
      </main>
      <Footer />
    </>
  );
}
