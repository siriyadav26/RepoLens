"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CheckCircle2, AlertTriangle, ShieldAlert, Zap } from "lucide-react";

type InsightVariant = "strengths" | "smells" | "security" | "performance";

interface InsightCardProps {
  title: string;
  items: string[];
  variant: InsightVariant;
}

export function InsightCard({ title, items, variant }: InsightCardProps) {
  const configs = {
    strengths: {
      color: "border-emerald-200 dark:border-emerald-950/60 bg-emerald-50/20 dark:bg-emerald-950/10",
      text: "text-emerald-800 dark:text-emerald-300",
      icon: <CheckCircle2 className="h-4 w-4 text-emerald-500" />,
      dot: "bg-emerald-500",
    },
    smells: {
      color: "border-amber-200 dark:border-amber-950/60 bg-amber-50/20 dark:bg-amber-950/10",
      text: "text-amber-800 dark:text-amber-300",
      icon: <AlertTriangle className="h-4 w-4 text-amber-500" />,
      dot: "bg-amber-500",
    },
    security: {
      color: "border-rose-200 dark:border-rose-950/60 bg-rose-50/20 dark:bg-rose-950/10",
      text: "text-rose-800 dark:text-rose-300",
      icon: <ShieldAlert className="h-4 w-4 text-rose-500" />,
      dot: "bg-rose-500",
    },
    performance: {
      color: "border-yellow-200 dark:border-yellow-950/60 bg-yellow-50/20 dark:bg-yellow-950/10",
      text: "text-yellow-800 dark:text-yellow-300",
      icon: <Zap className="h-4 w-4 text-yellow-500" />,
      dot: "bg-yellow-500",
    },
  };

  const current = configs[variant] || configs.strengths;

  return (
    <Card className={`border shadow-sm ${current.color}`}>
      <CardHeader className="pb-2 pt-3.5 px-4 flex flex-row items-center gap-2 space-y-0">
        {current.icon}
        <CardTitle className="text-xs font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {title}
        </CardTitle>
      </CardHeader>
      <CardContent className="px-4 pb-4">
        {items.length > 0 ? (
          <ul className="space-y-2">
            {items.map((item, idx) => (
              <li key={idx} className="flex items-start gap-2 text-xs leading-relaxed text-slate-700 dark:text-slate-300">
                <span className={`h-1.5 w-1.5 rounded-full mt-1.5 flex-shrink-0 ${current.dot}`} />
                <span>{item}</span>
              </li>
            ))}
          </ul>
        ) : (
          <div className="text-xs text-slate-400 italic">No specific items detected</div>
        )}
      </CardContent>
    </Card>
  );
}
