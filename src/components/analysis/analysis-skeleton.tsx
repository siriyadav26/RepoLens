"use client";

import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent, CardHeader } from "@/components/ui/card";

export function AnalysisSkeleton() {
  return (
    <div className="space-y-6">
      {/* Overview Skeleton */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-32" />
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {[...Array(4)].map((_, i) => (
              <div key={i} className="h-14 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-800/20">
                <Skeleton className="h-3 w-16 mb-2" />
                <Skeleton className="h-4 w-24" />
              </div>
            ))}
          </div>
          <div className="h-16 mt-4 p-3 rounded-lg border border-slate-100 dark:border-slate-800/80 bg-slate-50 dark:bg-slate-800/20">
            <Skeleton className="h-3 w-28 mb-2" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </CardContent>
      </Card>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Tech Stack Skeleton */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-40" />
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Skeleton className="h-3 w-32 mb-2" />
              <div className="flex flex-wrap gap-2">
                {[...Array(5)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-16 rounded-md" />
                ))}
              </div>
            </div>
            <div>
              <Skeleton className="h-3 w-32 mb-2" />
              <div className="flex flex-wrap gap-2">
                {[...Array(3)].map((_, i) => (
                  <Skeleton key={i} className="h-6 w-20 rounded-md" />
                ))}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Scores Skeleton */}
        <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
          <CardHeader className="pb-3">
            <Skeleton className="h-4 w-44" />
          </CardHeader>
          <CardContent className="space-y-5">
            {[...Array(3)].map((_, i) => (
              <div key={i}>
                <div className="flex justify-between items-center mb-2">
                  <Skeleton className="h-3 w-28" />
                  <Skeleton className="h-4 w-8" />
                </div>
                <Skeleton className="h-2 w-full rounded-full" />
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* Insights Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {[...Array(4)].map((_, i) => (
          <Card key={i} className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm p-4">
            <Skeleton className="h-4 w-28 mb-3" />
            <div className="space-y-2">
              <Skeleton className="h-3 w-5/6" />
              <Skeleton className="h-3 w-3/4" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </Card>
        ))}
      </div>

      {/* Markdown summary skeleton */}
      <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
        <CardHeader className="pb-3">
          <Skeleton className="h-4 w-24" />
        </CardHeader>
        <CardContent className="space-y-3">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <Skeleton className="h-4 w-2/3" />
        </CardContent>
      </Card>
    </div>
  );
}
