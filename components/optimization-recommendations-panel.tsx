import Link from "next/link";
import { OptimizationRecommendation } from "@/lib/types";

const priorityClass: Record<OptimizationRecommendation["priority"], string> = {
  high: "text-coral",
  medium: "text-teal",
  low: "text-ink/55",
};

export function OptimizationRecommendationsPanel({
  title,
  kicker = "Optimization Recommender",
  recommendations,
}: {
  title: string;
  kicker?: string;
  recommendations: OptimizationRecommendation[];
}) {
  return (
    <div className="mt-8 rounded-[1.75rem] border border-ink/8 bg-white/70 p-5">
      <p className="text-sm uppercase tracking-[0.3em] text-coral">{kicker}</p>
      <h3 className="mt-3 text-2xl font-semibold text-ink">{title}</h3>
      <div className="mt-4 space-y-4">
        {recommendations.map((item) => (
          <article key={item.id} className="rounded-[1.25rem] border border-ink/8 bg-white/80 p-4">
            <div className="flex items-center justify-between gap-3">
              <h4 className="text-base font-semibold text-ink">{item.title}</h4>
              <span className={`text-xs uppercase tracking-[0.2em] ${priorityClass[item.priority]}`}>
                {item.priority}
              </span>
            </div>
            <p className="mt-3 text-sm leading-6 text-ink/68">{item.rationale}</p>
            <div className="mt-4 rounded-[1rem] border border-dashed border-teal/20 bg-teal/5 px-4 py-3 text-sm leading-6 text-ink/72">
              {item.action}
            </div>
            {item.actionHref ? (
              <div className="mt-4">
                <Link
                  href={item.actionHref}
                  className="inline-flex rounded-full bg-ink px-4 py-2 text-sm font-medium text-parchment"
                >
                  {item.actionLabel || "Apply"}
                </Link>
              </div>
            ) : null}
          </article>
        ))}
      </div>
    </div>
  );
}
