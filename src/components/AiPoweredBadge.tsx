
import { Sparkles } from "lucide-react";

export const AiPoweredBadge = () => {
  return (
    <div className="fixed bottom-6 right-6 z-10">
      <div className="flex items-center gap-1.5 bg-black/85 text-white px-3 py-1.5 rounded-full text-xs font-medium shadow-lg backdrop-blur-sm">
        <Sparkles size={12} className="text-apple-blue" />
        <span>AI Powered</span>
      </div>
    </div>
  );
};
