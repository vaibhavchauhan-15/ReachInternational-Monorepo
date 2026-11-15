"use client";

import { MyDocumentsSection } from "@/components/documents/MyDocumentsSection";
import type { UserDocument, DocumentType } from "@/app/actions/documents";

interface ProfileDocumentsSectionProps {
  userId: string;
  documentTypes?: DocumentType[];
  initialDocuments?: UserDocument[];
}

export function ProfileDocumentsSection({}: ProfileDocumentsSectionProps) {
  return (
    <section
      aria-label="My Documents"
      className="border border-[var(--color-hairline)] bg-[var(--color-canvas-elevated)] rounded-2xl p-4 sm:p-5 shadow-xs transition-colors"
    >
      <MyDocumentsSection />
    </section>
  );
}
