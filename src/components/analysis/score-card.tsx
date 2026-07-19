"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";

interface ScoreCardProps {
  maintainabilityScore: number;
  testingScore: number;
  documentationScore: number;
}

export function ScoreCard({
  maintainabilityScore,
  testingScore,
  documentationScore,
}: ScoreCardProps) {
  const getScoreColor = (score: number) => {
    if (score >= 80) return "text-emerald-600 dark:text-emerald-400";
    if (score >= 50) return "text-amber-600 dark:text-amber-400";
    return "text-rose-600 dark:text-rose-400";
  };

  const getProgressColor = (score: number) => {
    if (score >= 80) return "[&>div]:bg-emerald-500";
    if (score >= 50) return "[&>div]:bg-amber-500";
    return "[&>div]:bg-rose-500";
  };

  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          AI Architecture & Code Scores
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Maintainability & Quality
            </span>
            <span className={`text-sm font-bold ${getScoreColor(maintainabilityScore)}`}>
              {maintainabilityScore}%
            </span>
          </div>
          <Progress
            value={maintainabilityScore}
            className={`h-2 bg-slate-100 dark:bg-slate-800 ${getProgressColor(maintainabilityScore)}`}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Testing & Coverage
            </span>
            <span className={`text-sm font-bold ${getScoreColor(testingScore)}`}>
              {testingScore}%
            </span>
          </div>
          <Progress
            value={testingScore}
            className={`h-2 bg-slate-100 dark:bg-slate-800 ${getProgressColor(testingScore)}`}
          />
        </div>

        <div>
          <div className="flex justify-between items-center mb-1.5">
            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
              Documentation & Readability
            </span>
            <span className={`text-sm font-bold ${getScoreColor(documentationScore)}`}>
              {documentationScore}%
            </span>
          </div>
          <Progress
            value={documentationScore}
            className={`h-2 bg-slate-100 dark:bg-slate-800 ${getProgressColor(documentationScore)}`}
          />
        </div>
      </CardContent>
    </Card>
  );
}
