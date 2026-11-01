"use client";

import { useEffect, useState } from "react";
import { Cookie } from "lucide-react";
import { Button } from "./Button";
import { updateConsent, trackEvent } from "@/lib/analytics";

const CONSENT_KEY = "cookie-consent";
const CONSENT_VALUE = "accepted";

export function CookieConsent() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    const stored = localStorage.getItem(CONSENT_KEY);
    if (!stored) {
      const id = requestAnimationFrame(() => setShow(true));
      return () => cancelAnimationFrame(id);
    }
  }, []);

  const handleAccept = () => {
    localStorage.setItem(CONSENT_KEY, CONSENT_VALUE);
    updateConsent(true);
    trackEvent("cookie_consent_accepted");
    setShow(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, "rejected");
    updateConsent(false);
    trackEvent("cookie_consent_rejected");
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[90] pointer-events-auto animate-in fade-in-0 slide-in-from-bottom-4 duration-300">
      <div className="card-elevated border border-border bg-card/95 backdrop-blur-md shadow-2xl rounded-xl overflow-hidden">
        <div className="p-5">
          <div className="flex items-start gap-3.5">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
              <Cookie className="size-4.5 text-amber-600 dark:text-amber-400" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="label-sm text-foreground font-semibold mb-1">
                We value your privacy
              </p>
              <p className="body-sm text-neutral-600 dark:text-neutral-300 text-xs leading-relaxed">
                We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking &ldquo;Accept All&rdquo;, you consent to our use of cookies.
              </p>
            </div>
          </div>
          <div className="flex flex-row items-center gap-2.5 mt-4">
            <Button variant="primary" onClick={handleAccept} className="flex-1">
              Accept All
            </Button>
            <Button variant="secondary" onClick={handleReject} className="flex-1">
              Reject All
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}