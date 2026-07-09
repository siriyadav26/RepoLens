"use client";

import type { Hotspot, DirectoryActivity, ContributorActivity, CommitPattern } from "@/lib/health/types";

interface HotspotsSectionProps {
  hotspots: Hotspot[];
  directoryActivity: DirectoryActivity[];
  contributorActivity: ContributorActivity[];
}

export function HotspotsSection({ hotspots, directoryActivity, contributorActivity }: HotspotsSectionProps) {
  return (
    <div className="health-sections-grid">
      {/* Hotspots */}
      <div className="health-section">
        <h3 className="health-section-title">Code Hotspots</h3>
        <p className="health-section-desc">Most frequently changed areas of the codebase</p>
        <div className="health-hotspot-list">
          {hotspots.length === 0 ? (
            <div className="health-empty-mini">No hotspot data</div>
          ) : (
            hotspots.map((h, i) => (
              <div key={h.path} className="health-hotspot-item">
                <div className="health-hotspot-rank">#{i + 1}</div>
                <div className="health-hotspot-info">
                  <div className="health-hotspot-path">{h.path}</div>
                  <div className="health-hotspot-stats">
                    <span>{h.changeCount} changes</span>
                    <span>+{h.totalAdditions}</span>
                    <span>-{h.totalDeletions}</span>
                    <span>{h.contributors} contributors</span>
                  </div>
                </div>
                <div className="health-hotspot-bar">
                  <div
                    className="health-hotspot-bar-fill"
                    style={{ width: `${Math.min(100, (h.changeCount / (hotspots[0]?.changeCount || 1)) * 100)}%` }}
                  />
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Directory Activity */}
      <div className="health-section">
        <h3 className="health-section-title">Directory Activity</h3>
        <p className="health-section-desc">Changes grouped by branch/directory</p>
        <div className="health-dir-list">
          {directoryActivity.length === 0 ? (
            <div className="health-empty-mini">No directory data</div>
          ) : (
            directoryActivity.slice(0, 8).map((d) => (
              <div key={d.path} className="health-dir-item">
                <span className="health-dir-path">{d.path}</span>
                <div className="health-dir-stats">
                  <span>{d.changeCount} commits</span>
                  <span>+{d.totalAdditions} / -{d.totalDeletions}</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Contributors */}
      <div className="health-section">
        <h3 className="health-section-title">Contributor Distribution</h3>
        <p className="health-section-desc">Commit share per contributor</p>
        <div className="health-contrib-list">
          {contributorActivity.length === 0 ? (
            <div className="health-empty-mini">No contributor data</div>
          ) : (
            contributorActivity.map((c) => (
              <div key={c.login} className="health-contrib-item">
                <div className="health-contrib-name">{c.name}</div>
                <div className="health-contrib-bar-wrap">
                  <div
                    className="health-contrib-bar-fill"
                    style={{ width: `${Math.min(100, c.percentage * 3)}%` }}
                  />
                </div>
                <div className="health-contrib-stats">
                  <span>{c.commitCount} commits</span>
                  <span>{c.percentage}%</span>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}

export function CommitPatternsSection({ patterns }: { patterns: CommitPattern[] }) {
  if (patterns.length === 0) return <div className="health-empty-mini">No commit pattern data</div>;

  const maxCount = Math.max(...patterns.map((p) => p.count), 1);

  return (
    <div className="health-section">
      <h3 className="health-section-title">Commit Frequency Trends</h3>
      <p className="health-section-desc">Weekly commit activity over time</p>
      <div className="health-pattern-bars">
        {patterns.slice(0, 12).map((p) => (
          <div key={p.week} className="health-pattern-item">
            <div className="health-pattern-bar-wrap">
              <div
                className="health-pattern-bar-fill"
                style={{ height: `${(p.count / maxCount) * 100}%` }}
                title={`${p.count} commits`}
              />
            </div>
            <div className="health-pattern-label">{p.week.slice(5)}</div>
          </div>
        ))}
      </div>
    </div>
  );
}