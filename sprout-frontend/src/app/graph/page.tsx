import type { Metadata } from "next";
import { Suspense } from "react";
import { GraphViewContainer } from "@/components/graph-view";

export const metadata: Metadata = {
  title: "Graph",
};

export default function GraphPage() {
  return (
    <Suspense>
      <GraphViewContainer />
    </Suspense>
  );
}
