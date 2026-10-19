import { Suspense } from "react";
import { AnalyzeStock } from "@/components/analysis/AnalyzeStock";

export default function AnalyzePage() {
  return (
    <Suspense>
      <AnalyzeStock />
    </Suspense>
  );
}
