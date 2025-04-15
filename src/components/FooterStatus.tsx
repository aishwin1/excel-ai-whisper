
import { CircleCheck, Database, FileSpreadsheet, Zap } from "lucide-react";

export const FooterStatus = () => {
  return (
    <div className="px-4 py-2 border-t border-apple-gray-200 flex items-center justify-between text-xs text-apple-gray-500">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <CircleCheck size={12} className="text-apple-green" />
          <span>Ready</span>
        </div>
        <div className="flex items-center gap-1">
          <FileSpreadsheet size={12} />
          <span>1 sheet</span>
        </div>
        <div className="flex items-center gap-1">
          <Database size={12} />
          <span>30 rows</span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <Zap size={12} className="text-apple-blue" />
        <span>AI Powered</span>
      </div>
    </div>
  );
};
