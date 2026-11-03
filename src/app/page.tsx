import { getPageContent } from "@/lib/page-content";
import { HomeClient } from "./home-client";

// ============================================================
// Server component — fetches admin-editable content from DB,
// passes as initial props to HomeClient (client component).
// Backward compatible: if DB empty, all props null → HomeClient
// uses hardcoded defaults (existing behavior).
// ============================================================

export const dynamic = "force-dynamic";

export default async function HomePage() {
  const content = await getPageContent();
  return <HomeClient content={content} />;
}
