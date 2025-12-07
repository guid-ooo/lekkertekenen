import { Card } from "@/components/ui/card";
import { Clock, Trash2, Download } from "lucide-react";
import { HistoryItem } from "../../shared/Actions";

interface HistoryPanelProps {
  history: HistoryItem[];
  onRestore: (id: string) => void;
  onDelete: (id: string) => void;
}

const HistoryPanel = ({ history, onRestore, onDelete }: HistoryPanelProps) => {
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

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Prevent triggering restore
    if (confirm('Delete this drawing from history?')) {
      onDelete(id);
    }
  };

  const handleDownload = (e: React.MouseEvent, item: HistoryItem) => {
    e.stopPropagation(); // Prevent triggering restore
    
    // Convert base64 to blob and download
    const byteCharacters = atob(item.image);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: 'image/png' });
    
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `drawing-${new Date(item.timestamp).toISOString().slice(0, 10)}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
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
    <Card className="p-4 bg-slate-50 flex flex-col self-stretch h-full">
      <h2 className="text-lg font-semibold mb-3 text-slate-900 flex items-center gap-2 flex-shrink-0">
        <Clock size={20} />
        History ({history.length})
      </h2>
      <div className="space-y-2 flex-1 min-h-0 overflow-y-auto overflow-x-hidden pr-1">
        {history.map((item) => (
          <div
            key={item.id}
            className="relative group"
          >
            <button
              onClick={() => onRestore(item.id)}
              className="w-full text-left transition-all active:scale-[0.98]"
            >
              <Card className="p-2 hover:shadow-md hover:border-blue-300 transition-all">
                <img
                  src={`data:image/png;base64,${item.image}`}
                  alt={`Drawing from ${formatTime(item.timestamp)}`}
                  className="w-full h-auto rounded border border-slate-200"
                  style={{ imageRendering: "pixelated" }}
                />
                <div className="mt-1 text-xs text-slate-600 flex items-center justify-between gap-1">
                  <div className="flex items-center gap-1">
                    <Clock size={12} />
                    {formatTime(item.timestamp)}
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={(e) => handleDownload(e, item)}
                      className="p-1 bg-blue-500 text-white rounded hover:bg-blue-600 transition-colors"
                      title="Download image"
                    >
                      <Download size={12} />
                    </button>
                    <button
                      onClick={(e) => handleDelete(e, item.id)}
                      className="p-1 bg-red-500 text-white rounded hover:bg-red-600 transition-colors"
                      title="Delete from history"
                    >
                      <Trash2 size={12} />
                    </button>
                  </div>
                </div>
              </Card>
            </button>
          </div>
        ))}
      </div>
    </Card>
  );
};

export default HistoryPanel;
