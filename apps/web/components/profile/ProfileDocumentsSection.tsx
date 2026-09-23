"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { DocumentUploadSection } from "@/components/documents/DocumentUploadSection";
import type { UserDocument, DocumentType } from "@/app/actions/documents";

interface ProfileDocumentsSectionProps {
  userId: string;
  documentTypes: DocumentType[];
  initialDocuments: UserDocument[];
}

export function ProfileDocumentsSection({
  userId,
  documentTypes,
  initialDocuments,
}: ProfileDocumentsSectionProps) {
  const router = useRouter();
  const [documents, setDocuments] = useState(initialDocuments);

  useEffect(() => {
    setDocuments(initialDocuments);
  }, [initialDocuments]);

  const handleDocumentChange = useCallback(() => {
    // Refresh page data from server to get updated signed URLs
    router.refresh();
  }, [router]);

  const validDocumentTypes = documentTypes.filter((d) => d.code !== "profile_photo");

  if (validDocumentTypes.length === 0) return null;

  return (
    <DocumentUploadSection
      userId={userId}
      mode="edit"
      documentTypes={validDocumentTypes}
      existingDocuments={documents}
      onDocumentChange={handleDocumentChange}
    />
  );
}
