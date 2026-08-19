"use client";

import { useEffect, useState } from "react";
import { AnimatedCookie } from "./animated-icons";
import { motion, AnimatePresence } from "framer-motion";
import { Button } from "./Button";

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
    setShow(false);
  };

  const handleReject = () => {
    localStorage.setItem(CONSENT_KEY, "rejected");
    setShow(false);
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.98 }}
          transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          className="fixed bottom-4 left-4 right-4 md:left-auto md:right-4 md:w-[420px] z-[90] pointer-events-auto"
        >
          <div className="card-elevated border border-border bg-card/95 backdrop-blur-md shadow-2xl rounded-xl overflow-hidden">
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-lg bg-amber-500/15">
                  <AnimatedCookie size={18} className="text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="label-sm text-foreground font-semibold mb-1">
                    We value your privacy
                  </p>
                  <p className="body-sm text-muted-foreground text-xs leading-relaxed">
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
        </motion.div>
      )}
    </AnimatePresence>
  );
}