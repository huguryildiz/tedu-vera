// src/admin/overview/TopProjectsCard.jsx
// Top Projects highlight card — shows highest-performing projects by average score.
// Only displays when >= 5 projects exist (minimum threshold for meaningful rankings).

import { TrendingUp } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

const RANK_BADGES = {
  1: { label: "1st", variant: "default", className: "bg-yellow-100 text-yellow-900 dark:bg-yellow-900 dark:text-yellow-100" },
  2: { label: "2nd", variant: "default", className: "bg-gray-100 text-gray-900 dark:bg-gray-700 dark:text-gray-100" },
  3: { label: "3rd", variant: "default", className: "bg-orange-100 text-orange-900 dark:bg-orange-900 dark:text-orange-100" },
};

export default function TopProjectsCard({ topProjects = [], onViewRankings }) {
  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <TrendingUp className="size-5 text-emerald-600" />
          <div>
            <CardTitle className="text-base font-semibold">Top Projects</CardTitle>
            <CardDescription>Highest-performing projects by average score</CardDescription>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {topProjects.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center">
            <p className="text-sm text-muted-foreground">
              Not enough projects to show rankings (minimum 5)
            </p>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              {topProjects.map((project) => {
                const badge = RANK_BADGES[project.rank] || { label: `#${project.rank}`, variant: "secondary" };
                return (
                  <div
                    key={project.id}
                    className="flex items-center justify-between gap-3 rounded-lg bg-muted/50 p-3"
                  >
                    <div className="flex items-center gap-3 flex-1">
                      <Badge className={badge.className}>{badge.label}</Badge>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{project.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {project.count || 0} evaluations
                        </p>
                      </div>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-semibold">
                        {project.totalAvg != null ? Number(project.totalAvg).toFixed(1) : "—"}
                      </p>
                      <p className="text-xs text-muted-foreground">avg</p>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="border-t pt-4">
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                onClick={() => onViewRankings?.()}
              >
                View Rankings
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}
