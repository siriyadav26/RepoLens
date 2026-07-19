"use client";

import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface TechStackBadgesProps {
  techStack: string[];
  designPatterns?: string[];
}

export function TechStackBadges({ techStack, designPatterns = [] }: TechStackBadgesProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          Tech Stack & Patterns
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">
            Core Technologies & Libraries
          </div>
          <div className="flex flex-wrap gap-2">
            {techStack.length > 0 ? (
              techStack.map((tech) => (
                <Badge
                  key={tech}
                  className="bg-teal-50 hover:bg-teal-100 text-teal-800 dark:bg-teal-950/40 dark:text-teal-300 dark:hover:bg-teal-950/60 border border-teal-100/80 dark:border-teal-900/50 px-2.5 py-1 text-xs rounded-md"
                >
                  {tech}
                </Badge>
              ))
            ) : (
              <span className="text-xs text-slate-400">None detected</span>
            )}
          </div>
        </div>

        {designPatterns.length > 0 && (
          <div>
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-2">
              Observed Design Patterns
            </div>
            <div className="flex flex-wrap gap-2">
              {designPatterns.map((pattern) => (
                <Badge
                  key={pattern}
                  className="bg-indigo-50 hover:bg-indigo-100 text-indigo-800 dark:bg-indigo-950/40 dark:text-indigo-300 dark:hover:bg-indigo-950/60 border border-indigo-100/80 dark:border-indigo-900/50 px-2.5 py-1 text-xs rounded-md"
                >
                  {pattern}
                </Badge>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
