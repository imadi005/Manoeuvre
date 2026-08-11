"use client";

import { useState, useTransition } from "react";
import { resendOtp } from "@/app/verify-otp/actions";

export default function ResendOtpButton() {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [cooldown, setCooldown] = useState(0);

  function handleResend() {
    setMessage(null);
    startTransition(async () => {
      const result = await resendOtp();
      if (result.error) {
        setMessage(result.error);
      } else {
        setMessage("New code sent — check your inbox.");
        setCooldown(45);
        const timer = setInterval(() => {
          setCooldown((c) => {
            if (c <= 1) {
              clearInterval(timer);
              return 0;
            }
            return c - 1;
          });
        }, 1000);
      }
    });
  }

  return (
    <div className="mt-4 flex flex-col items-center gap-2">
      <button
        type="button"
        onClick={handleResend}
        disabled={isPending || cooldown > 0}
        className="font-mono-fx text-xs uppercase tracking-widest text-cyan transition-colors hover:text-fog disabled:opacity-40"
      >
        {isPending ? "Sending..." : cooldown > 0 ? `Resend code (${cooldown}s)` : "Resend code"}
      </button>
      {message && <p className="font-mono-fx text-[11px] uppercase tracking-wide text-fog-dim">{message}</p>}
    </div>
  );
}
