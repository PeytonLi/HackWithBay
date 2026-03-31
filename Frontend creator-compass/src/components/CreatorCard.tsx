import { motion } from "framer-motion";
import { Users, Eye, TrendingUp, Calendar, Award } from "lucide-react";
import { Creator } from "@/types/creator";

interface CreatorCardProps {
  creator: Creator;
  index: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(0) + "K";
  return n.toString();
}

function getScoreColor(score: number): string {
  if (score >= 0.9) return "text-primary";
  if (score >= 0.8) return "text-accent";
  return "text-muted-foreground";
}

function getTagStyle(tag: string): string {
  if (tag === "Hidden gem") return "bg-accent/15 text-accent border-accent/20";
  if (tag.includes("High engagement")) return "bg-primary/15 text-primary border-primary/20";
  if (tag === "Authentic") return "bg-emerald-500/15 text-emerald-400 border-emerald-500/20";
  return "bg-muted text-muted-foreground border-border";
}

export function CreatorCard({ creator, index }: CreatorCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.1, duration: 0.5, ease: "easeOut" }}
      className="group rounded-xl border border-border bg-card p-6 hover:border-primary/30 transition-all duration-300 hover:glow-primary"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-muted text-xl font-bold text-primary">
            {creator.name.charAt(0)}
          </div>
          <div>
            <h3 className="font-display text-lg font-semibold text-foreground">
              {creator.name}
            </h3>
            {creator.consistency && (
              <p className="text-xs text-muted-foreground">{creator.consistency} uploads</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          <Award className="h-4 w-4 text-accent" />
          <span className={`font-display text-xl font-bold ${getScoreColor(creator.score)}`}>
            {(creator.score * 100).toFixed(0)}
          </span>
        </div>
      </div>

      {/* Metrics */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <Users className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm font-semibold text-foreground">{formatNumber(creator.subscribers)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Subscribers</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <Eye className="h-4 w-4 text-muted-foreground mx-auto mb-1" />
          <p className="text-sm font-semibold text-foreground">{formatNumber(creator.avgViews)}</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Avg Views</p>
        </div>
        <div className="rounded-lg bg-muted/50 p-3 text-center">
          <TrendingUp className="h-4 w-4 text-primary mx-auto mb-1" />
          <p className="text-sm font-semibold text-primary">{(creator.engagementRate * 100).toFixed(1)}%</p>
          <p className="text-[10px] text-muted-foreground uppercase tracking-wider">Engagement</p>
        </div>
      </div>

      {/* Tags */}
      <div className="flex flex-wrap gap-1.5 mb-4">
        {creator.tags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${getTagStyle(tag)}`}
          >
            {tag}
          </span>
        ))}
      </div>

      {/* Explanation */}
      <div className="rounded-lg bg-muted/30 border border-border/50 p-3">
        <p className="text-xs font-medium text-muted-foreground mb-1 uppercase tracking-wider">Why recommended</p>
        <p className="text-sm text-secondary-foreground leading-relaxed">{creator.reason}</p>
      </div>
    </motion.div>
  );
}
