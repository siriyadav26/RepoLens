"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Server, Compass, Database, Key } from "lucide-react";

interface ArchitectureOverviewProps {
  framework: string;
  renderingStrategy: string;
  databaseLayer: string;
  authentication: string;
  architecture: string;
}

export function ArchitectureOverview({
  framework,
  renderingStrategy,
  databaseLayer,
  authentication,
  architecture,
}: ArchitectureOverviewProps) {
  return (
    <Card className="border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold text-slate-800 dark:text-slate-100">
          Architecture & Strategy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Server className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Framework
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {framework || "Not detected"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Compass className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Strategy
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {renderingStrategy || "Not detected"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Database className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Database/ORM
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {databaseLayer || "Not detected"}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800">
            <Key className="h-5 w-5 text-teal-600 dark:text-teal-400" />
            <div>
              <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider">
                Authentication
              </div>
              <div className="text-sm font-semibold text-slate-700 dark:text-slate-200">
                {authentication || "Not detected"}
              </div>
            </div>
          </div>
        </div>

        {architecture && (
          <div className="p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-100 dark:border-slate-800 mt-2">
            <div className="text-[11px] text-slate-400 font-bold uppercase tracking-wider mb-1">
              High-level Pattern
            </div>
            <p className="text-sm text-slate-600 dark:text-slate-300">
              {architecture}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
