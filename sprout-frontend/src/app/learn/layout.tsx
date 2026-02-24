import { Space_Grotesk } from "next/font/google";
import type { ReactNode } from "react";

const sg = Space_Grotesk({ subsets: ["latin"] });

export default function LearnLayout({ children }: { children: ReactNode }) {
  return <div className={sg.className}>{children}</div>;
}
