"use client";

import { Search, Lightbulb, BarChart3, Image, Code } from "lucide-react";

interface FeatureButtonProps {
  icon: React.ReactNode;
  label: string;
}

function FeatureButton({ icon, label }: FeatureButtonProps) {
  return (
    <button className="feature-button">
      <div className="h-10 w-10 flex items-center justify-center rounded-full bg-secondary">
        {icon}
      </div>
      <span className="text-sm">{label}</span>
    </button>
  );
}

export function FeatureButtons() {
  return (
    <div className="flex justify-center gap-4 mt-6">
      <FeatureButton
        icon={<Search className="h-5 w-5" />}
        label="Research"
      />
      <FeatureButton
        icon={<Lightbulb className="h-5 w-5" />}
        label="How to"
      />
      <FeatureButton
        icon={<BarChart3 className="h-5 w-5" />}
        label="Analyze"
      />
      <FeatureButton
        icon={<Image className="h-5 w-5" />}
        label="Create images"
      />
      <FeatureButton
        icon={<Code className="h-5 w-5" />}
        label="Code"
      />
    </div>
  );
}
