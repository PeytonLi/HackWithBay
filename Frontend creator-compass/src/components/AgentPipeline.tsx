import { motion } from "framer-motion";
import { Check, Loader2 } from "lucide-react";
import { AgentStep } from "@/types/creator";

interface AgentPipelineProps {
  steps: AgentStep[];
}

export function AgentPipeline({ steps }: AgentPipelineProps) {
  return (
    <div className="space-y-4">
      {steps.map((step, index) => (
        <motion.div
          key={step.id}
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: index * 0.1, duration: 0.4 }}
          className={`flex items-center gap-4 rounded-lg border p-4 transition-all duration-500 ${
            step.status === "active"
              ? "border-primary/50 bg-primary/5 glow-primary"
              : step.status === "done"
              ? "border-primary/20 bg-muted/30"
              : "border-border/50 bg-muted/10 opacity-40"
          }`}
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted text-lg">
            {step.icon}
          </div>
          <div className="flex-1">
            <p className={`text-sm font-medium ${
              step.status === "active" ? "text-primary" : step.status === "done" ? "text-foreground" : "text-muted-foreground"
            }`}>
              {step.label}
            </p>
          </div>
          <div className="shrink-0">
            {step.status === "active" && (
              <Loader2 className="h-5 w-5 animate-spin text-primary" />
            )}
            {step.status === "done" && (
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                className="flex h-6 w-6 items-center justify-center rounded-full bg-primary"
              >
                <Check className="h-3.5 w-3.5 text-primary-foreground" />
              </motion.div>
            )}
          </div>
        </motion.div>
      ))}
    </div>
  );
}
