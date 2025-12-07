import { Card } from "@/components/ui/card";
import { Clock } from "lucide-react";
import { HistoryItem } from "../../shared/Actions";

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore: (id: string) => void;
}

const HistoryPanel = ({ history, onRestore }: HistoryPanelProps) => {
  const formatTime = (timestamp: number) => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) return "just now";
    if (diffMins < 60) return `${diffMins}m ago`;
    if (diffHours < 24) return `${diffHours}h ago`;
    if (diffDays < 7) return `${diffDays}d ago`;
    
    return date.toLocaleDateString();
  };

  if (history.length === 0) {
    return (
      <Card className="p-4 bg-slate-50">
        <h2 className="text-lg font-semibold mb-3 text-slate-900 flex items-center gap-2">
          <Clock size={20} />
          History
        </h2>
        <div className="text-center py-8 text-slate-500">
          <p>No drawings in history yet.</p>
          <p className="text-sm mt-1">Clear the canvas to save it to history.</p>
        </div>
      </Card>
    );
  }

  return (
    <Card className="p-4 bg-slate-50">
      <h2 className="text-lg font-semibold mb-3 text-slate-900 flex items-center gap-2">
        <Clock size={20} />
        History ({history.length})
      </h2>
      <div className="space-y-2 max-h-[600px] overflow-y-auto">
        {history.map((item) => (
          <button
            key={item.id}
            onClick={() => onRestore(item.id)}
            className="w-full text-left transition-all hover:scale-[1.02] active:scale-[0.98]"
          >
            <Card className="p-2 hover:shadow-md hover:border-blue-300">
              <img
                src={`data:image/png;base64,${item.image}`}
                alt={`Drawing from ${formatTime(item.timestamp)}`}
                className="w-full h-auto rounded border border-slate-200"
                style={{ imageRendering: "pixelated" }}
              />
              <div className="mt-1 text-xs text-slate-600 flex items-center gap-1">
                <Clock size={12} />
                {formatTime(item.timestamp)}
              </div>
            </Card>
          </button>
        ))}
      </div>
    </Card>
  );
};

export default HistoryPanel;
