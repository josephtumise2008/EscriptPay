"use client";

import { useSearchParams } from "next/navigation";
import BuyForm from "@/components/BuyForm";
import AirtimeForm from "@/components/AirtimeForm";

// Reading ?network= / ?plan= / ?amount= in the browser (instead of on the
// server) lets the Buy Data and Buy Airtime pages be served ready-made from
// the nearest CDN edge, with no server work per visit.
export function BuyDataFromUrl() {
  const sp = useSearchParams();
  return <BuyForm initialNetwork={sp.get("network") || ""} initialPlanId={sp.get("plan") || ""} />;
}

export function BuyAirtimeFromUrl() {
  const sp = useSearchParams();
  return <AirtimeForm initialNetwork={sp.get("network") || ""} initialAmount={sp.get("amount") || ""} />;
}
