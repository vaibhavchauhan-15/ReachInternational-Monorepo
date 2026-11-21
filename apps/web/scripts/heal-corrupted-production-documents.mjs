import { createClient } from "@supabase/supabase-js";
import fs from "node:fs";

// Parse production environment
const envFile = fs.readFileSync("apps/web/.env.production.local", "utf-8");
const env = {};
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (trimmed && !trimmed.startsWith("#") && trimmed.includes("=")) {
    const idx = trimmed.indexOf("=");
    env[trimmed.substring(0, idx).trim()] = trimmed.substring(idx + 1).trim();
  }
}

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SECRET_KEY || env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  console.log("=== Healing Corrupted Production Documents ===");

  // 1. Find all user_documents with 7508 bytes
  const { data: corruptDocs, error: fetchErr } = await supabase
    .from("user_documents")
    .select("id, user_id, document_type_code, storage_path, thumb_path, file_size_bytes")
    .eq("file_size_bytes", 7508);

  if (fetchErr) {
    console.error("Fetch error:", fetchErr);
    process.exit(1);
  }

  console.log(`Found ${corruptDocs.length} corrupted documents to heal.`);

  for (const doc of corruptDocs) {
    console.log(`\nProcessing doc ${doc.id} (${doc.document_type_code}) for user ${doc.user_id}...`);
    if (!doc.thumb_path) {
      console.warn(`Doc ${doc.id} has no thumb_path, skipping.`);
      continue;
    }

    // A. Check thumbnail in storage
    const { data: thumbBlob, error: thumbDownloadErr } = await supabase.storage
      .from("user_files")
      .download(doc.thumb_path);

    if (thumbDownloadErr || !thumbBlob) {
      console.error(`Failed to download thumb ${doc.thumb_path}:`, thumbDownloadErr);
      continue;
    }

    const thumbBuffer = Buffer.from(await thumbBlob.arrayBuffer());
    console.log(`Downloaded valid thumbnail: ${thumbBuffer.length} bytes.`);

    // B. Upload thumbnail content directly over the corrupt storage_path (with upsert)
    const { error: uploadErr } = await supabase.storage
      .from("user_files")
      .upload(doc.storage_path, thumbBuffer, {
        contentType: "image/jpeg",
        upsert: true,
      });

    if (uploadErr) {
      console.error(`Failed to overwrite corrupt file at ${doc.storage_path}:`, uploadErr);
      continue;
    }
    console.log(`Overwrote corrupt storage file ${doc.storage_path} with valid document photo.`);

    // C. Update user_documents file_size_bytes
    const { error: updateErr } = await supabase
      .from("user_documents")
      .update({
        file_size_bytes: thumbBuffer.length,
        updated_at: new Date().toISOString(),
      })
      .eq("id", doc.id);

    if (updateErr) {
      console.error(`Failed to update user_documents row ${doc.id}:`, updateErr);
      continue;
    }

    console.log(`Updated user_documents row ${doc.id} with size ${thumbBuffer.length} bytes.`);
  }

  console.log("\n=== Healing Complete ===");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
