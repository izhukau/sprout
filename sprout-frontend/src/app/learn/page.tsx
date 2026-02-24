import type { Metadata } from "next";
import { Suspense } from "react";
import { LearnView } from "@/components/learn-view";

export const metadata: Metadata = {
  title: "Learn",
};

export default function LearnPage() {
  return (
    <Suspense>
      <LearnView />
    </Suspense>
  );
}
