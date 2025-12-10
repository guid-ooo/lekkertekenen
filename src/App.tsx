import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { PaintBucket, Download, History, X, ImagePlus, User as UserIcon, Save } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import HistoryPanel from "@/components/HistoryPanel";
import PxBrush from "../shared/PxBrush";
import { CanvasAction, HistoryItem, User } from "../shared/Actions";
import { fill, draw, colors, brushSizes } from "../shared/Utilities";

const createWave = (baseId: number = Date.now(), isSent: boolean = false) => ({
  id: baseId + Math.random(),
  offset: Math.random() * 60 - 30,
  scale: 1 - Math.random() * 0.4,
  isSent
});

const DrawingApp = () => {
  const [tool, setTool] = useState<keyof typeof brushSizes | "fill">("brush-medium");
  const [color, setColor] = useState(colors.black);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [showHistoryMobile, setShowHistoryMobile] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState<User[]>([]);
  const [currentHistoryId, setCurrentHistoryId] = useState<string | null>(null);
  const [waves, setWaves] = useState<Array<{ id: number; offset: number; scale: number; isSent: boolean }>>([]);
  const [isWaveDisabled, setIsWaveDisabled] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const isDrawingRef = useRef(false);
  const wsRef = useRef<WebSocket>(null);
  const currentLineRef = useRef<{ x: number; y: number }[]>([]);
  const brushRef = useRef<PxBrush>(null);
  const disconnectTimeoutRef = useRef<Timer>(undefined);
  const reconnectTimeoutRef = useRef<Timer>(undefined);
  const reconnectAttemptsRef = useRef(0);
  const wavePressesRef = useRef<number[]>([]);
  const MAX_RECONNECT_ATTEMPTS = 5;
  const INITIAL_RECONNECT_DELAY = 1000;

  const connectWebSocket = () => {
    if (wsRef.current && wsRef.current.readyState !== WebSocket.CLOSED) {
      return wsRef.current;
    }

    if (disconnectTimeoutRef.current) {
      clearTimeout(disconnectTimeoutRef.current);
    }

    disconnectTimeoutRef.current = setTimeout(() => {
      setIsDisconnected(true);
    }, 500);

    console.log("Connecting to WebSocket server...");

    const wsUrl = import.meta.env.VITE_WS_URL 
      ? `${import.meta.env.VITE_WS_URL}/ws`
      : `${window.location.protocol === "https:" ? "wss:" : "ws:"}//${window.location.host}/ws`;

    console.log("WebSocket URL:", wsUrl);

    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log("Connected to WebSocket server");
      clearTimeout(disconnectTimeoutRef.current);
      reconnectAttemptsRef.current = 0;
      setIsDisconnected(false);
      clearTimeout(reconnectTimeoutRef.current);
      
      setTimeout(() => {
        if (wsRef.current === ws) {
          requestHistory();
        }
      }, 100);
    };

    ws.onclose = () => {
      console.log("WebSocket connection closed");
      if (wsRef.current !== ws) return;
      wsRef.current = null;
      setIsDisconnected(true);

      if (reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS) {
        const delay = INITIAL_RECONNECT_DELAY * Math.pow(2, reconnectAttemptsRef.current);
        console.log(`Attempting to reconnect in ${delay}ms...`);

        reconnectTimeoutRef.current = setTimeout(() => {
          reconnectAttemptsRef.current++;
          connectWebSocket();
        }, delay);
      }
    };

    ws.onerror = (error) => {
      console.error("WebSocket error:", error);
    };

    wsRef.current = ws;
    return ws;
  };

  useEffect(() => {
    const canvas = canvasRef.current!;
    brushRef.current = new PxBrush(canvas);

    clearCanvas();

    const ws = connectWebSocket();

    return () => {
      clearTimeout(reconnectTimeoutRef.current);
      ws.close();
      wsRef.current = null;
    };
  }, []);

  const clearCanvas = () => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    context.fillStyle = colors.white;
    context.fillRect(0, 0, canvas.width, canvas.height);
  };

  const handleClear = () => {
    setShowClearConfirm(true);
  };

  const confirmClear = () => {
    clearCanvas();
    sendUpdate({
      type: "clear",
    });
    setCurrentHistoryId(null);
    setShowClearConfirm(false);
  };

  const sendUpdate = (updateData: CanvasAction) => {
    if (wsRef.current) {
      wsRef.current.send(JSON.stringify(updateData));
    }
  };

  const requestHistory = () => {
    sendUpdate({ type: "get-history" });
  };

  const restoreDrawing = (id: string) => {
    console.log("Restoring drawing with id:", id);
    sendUpdate({ type: "restore", id });
    setShowHistoryMobile(false);
  };

  const deleteHistoryItem = (id: string) => {
    console.log("Deleting history item with id:", id);
    sendUpdate({ type: "delete-history", id });
  };

  const saveToHistory = () => {
    console.log("Saving to history, current ID:", currentHistoryId);
    sendUpdate({ 
      type: "save-to-history", 
      id: currentHistoryId || undefined 
    });
  };

  const triggerWave = () => {
    if (isWaveDisabled) return;

    const now = Date.now();
    const oneMinuteAgo = now - 60000;
    
    wavePressesRef.current = wavePressesRef.current.filter(time => time > oneMinuteAgo);
    wavePressesRef.current.push(now);
    
    if (wavePressesRef.current.length > 20) {
      setIsWaveDisabled(true);
      
      setTimeout(() => {
        setIsWaveDisabled(false);
        wavePressesRef.current = [];
      }, 300000);
      
      return;
    }

    sendUpdate({ type: "wave" });
    // Add a new wave with random offset and scale - mark as sent
    const newWave = createWave(Date.now(), true);
    setWaves(prev => [...prev, newWave]);
    setTimeout(() => {
      setWaves(prev => prev.filter(w => w.id !== newWave.id));
    }, 3000);
  };

  const downloadCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    canvas.toBlob((blob) => {
      if (!blob) return;
      
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `drawing-${new Date().toISOString().slice(0, 10)}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 'image/png');
  };

  const getCoordinates = (e: React.MouseEvent | React.TouchEvent) => {
    let offsetX = 0,
      offsetY = 0;
    const target = e.target as HTMLCanvasElement;
    if (e.nativeEvent instanceof MouseEvent) {
      const rect = target.getBoundingClientRect();
      offsetX = e.nativeEvent.clientX - rect.left;
      offsetY = e.nativeEvent.clientY - rect.top;
    } else {
      const rect = target.getBoundingClientRect();
      offsetX = e.nativeEvent.touches[0].clientX - rect.left;
      offsetY = e.nativeEvent.touches[0].clientY - rect.top;
    }

    offsetX /= target.clientWidth / 800;
    offsetY /= target.clientHeight / 480;
    return {
      x: Math.round(offsetX),
      y: Math.round(offsetY),
    };
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!(e.nativeEvent instanceof MouseEvent)) {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 1) return;
    }
    isDrawingRef.current = true;
    const { x, y } = getCoordinates(e);
    currentLineRef.current = [{ x, y }];
  };

  const drawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawingRef.current) return;
    if (tool === "fill") return;
    if (!(e.nativeEvent instanceof MouseEvent)) {
      if (e.nativeEvent.touches && e.nativeEvent.touches.length > 1) return;
    }

    try {
      e.preventDefault();
    } catch {
      console.log('hmm');
      
    }

    const { x, y } = getCoordinates(e);

    brushRef.current?.draw({
      from: currentLineRef.current[currentLineRef.current.length - 1],
      to: { x, y },
      color: color,
      size: brushSizes[tool],
    });

    currentLineRef.current = [...currentLineRef.current, { x, y }];
  };

  const endDrawing = () => {
    if (!isDrawingRef.current) return;
    if (tool === "fill") return;
    isDrawingRef.current = false;

    if (currentLineRef.current.length > 0) {
      if (currentLineRef.current.length === 1) {
        brushRef.current?.draw({
          from: currentLineRef.current[0],
          to: currentLineRef.current[0],
          color: color,
          size: brushSizes[tool],
        });
      }
      sendUpdate({
        type: "draw",
        points: currentLineRef.current,
        color: color,
        brushSize: brushSizes[tool],
      });
    }

    currentLineRef.current = [];
  };

  const handleFill = (e: React.MouseEvent | React.TouchEvent) => {
    if (tool !== "fill") return;

    const { x, y } = getCoordinates(e);

    floodFill(x, y, color);

    sendUpdate({
      type: "fill",
      x,
      y,
      color: color,
    });
  };

  const floodFill = (startX: number, startY: number, fillColor: string) => {
    const canvas = canvasRef.current!;
    const context = canvas.getContext("2d")!;
    fill(context, canvas.width, canvas.height, startX, startY, fillColor);
  };

  const drawLine = (
    points: { x: number; y: number }[],
    color: string,
    brushSize: number
  ) => {
    draw(brushRef.current!, points, color, brushSize);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const handleDrawingUpdate = (
    data: CanvasAction,
    context: CanvasRenderingContext2D
  ) => {
    switch (data.type) {
      case "init": {
        const img = new Image();
        img.onload = () => {
          context.drawImage(img, 0, 0);
          if (currentLineRef.current.length > 0 && tool !== "fill") {
            drawLine(currentLineRef.current, color, brushSizes[tool]);
          }
        };
        img.src = `data:image/png;base64,${data.image}`;
        if (data.historyId) {
          setCurrentHistoryId(data.historyId);
        }
        break;
      }
      case "draw": {
        drawLine(data.points, data.color, data.brushSize);
        break;
      }
      case "fill":
        floodFill(data.x, data.y, data.color);
        break;
      case "clear":
        clearCanvas();
        break;
      case "history-update":
        setHistory(data.history);
        break;
      case "presence-update":
        setConnectedUsers(data.users);
        break;
      case "wave": {
        const newWave = createWave();
        setWaves(prev => [...prev, newWave]);
        setTimeout(() => {
          setWaves(prev => prev.filter(w => w.id !== newWave.id));
        }, 3000);
        break;
      }
    }
  };

  useEffect(() => {
    if (wsRef.current) {
      wsRef.current.onmessage = (event) => {
        const data = JSON.parse(event.data);
        const canvas = canvasRef.current!;
        const context = canvas.getContext("2d")!;
        handleDrawingUpdate(data, context);
      };
    }
  }, [handleDrawingUpdate]);

  return (
    <div className="mx-auto flex flex-col items-center p-2 sm:p-3 md:p-4 max-w-full h-screen overflow-hidden">
      <div className="flex gap-4 mb-2 md:mb-4 items-center w-full flex-wrap">
        <h1 className="hidden md:block text-2xl font-bold text-slate-900">
          🧑‍🎨 {"Lekker Krabbelen"}
        </h1>
        <div className="flex gap-4 items-center flex-wrap justify-end flex-grow">
          <div className="flex gap-2 items-center">
            {Object.entries(brushSizes).map(([toolType, toolSize]) => {
              return (
                <button
                  key={toolType}
                  className={`transition-colors w-8 h-8 rounded-full flex items-center justify-center ${tool === toolType
                    ? "bg-blue-500"
                    : "bg-slate-200 hover:bg-slate-300"
                    }`}
                  onClick={() => setTool(toolType as keyof typeof brushSizes)}
                >
                  <div
                    className="rounded-full bg-black"
                    style={{
                      width: `${toolSize}px`,
                      height: `${toolSize}px`,
                    }}
                  />
                </button>
              );
            })}
            <button
              className={`transition-colors w-8 h-8 rounded-full flex items-center justify-center ${tool === "fill"
                ? "bg-blue-500 text-white"
                : "bg-slate-200 hover:bg-slate-300"
                }`}
              onClick={() => setTool("fill")}
            >
              <PaintBucket size={16} />
            </button>
          </div>

          <div className="flex gap-2 items-center">
            {Object.entries(colors).map(([name, colorValue]) => (
              <button
                key={colorValue}
                aria-label={name}
                className={`transition-colors w-8 h-8 rounded-full border-4 ${color === colorValue
                  ? "border-blue-500"
                  : "border-slate-200 hover:border-slate-300"
                  }`}
                style={{ backgroundColor: colorValue }}
                onClick={() => setColor(colorValue)}
              />
            ))}
          </div>

          <div className="flex gap-2">
            {connectedUsers.length >= 2 && (
              <div className="relative">
                <Button 
                  variant="outline" 
                  onClick={triggerWave}
                  disabled={isWaveDisabled}
                  title={isWaveDisabled ? "Too many waves! Please wait..." : "Wave to everyone"}
                >
                  <UserIcon size={16} className="mr-1" />
                  {connectedUsers.length}
                </Button>
                {waves.map(wave => {
                  
                  return (
                    <span 
                      key={wave.id}
                      className="wave text-2xl absolute top-full mt-1"
                      style={{ 
                        [wave.isSent ? 'right' : 'left']: '75%',
                        [wave.isSent ? 'marginRight' : 'marginLeft']: `${Math.abs(wave.offset)}px`,
                        fontSize: `${wave.scale * 2}rem`
                      }}
                      title={wave.isSent ? "You waved!" : "Someone waved back!"}
                    >
                      {wave.isSent ? '👋' : '👋🏻'}
                    </span>
                  );
                })}
              </div>
            )}
            <Button variant="outline" onClick={downloadCanvas} title="Download">
              <Download size={16} />
            </Button>
            <Button variant="outline" onClick={saveToHistory} title="Save to history">
              <Save size={16} />
            </Button>
            <Button 
              variant="outline" 
              onClick={() => setShowHistoryMobile(!showHistoryMobile)}
            >
              <History size={16} className="mr-1" />
              <span className="hidden lg:inline">Geschiedenis ({history.length})</span>
            </Button>
            <Button variant="outline" onClick={handleClear}>
              <ImagePlus size={16} className="mr-1" />
              <span className="hidden lg:inline">Nieuw canvas</span>
            </Button>
          </div>
        </div>
      </div>
      
          <div className="w-full h-full flex items-center justify-center max-h-[80dvh] p-4 relative" style={{ aspectRatio: "800 / 480"}}>
              <canvas
                ref={canvasRef}
                width={800}
                height={480}
                style={{ 
                  imageRendering: "pixelated", 
                  aspectRatio: "800 / 480"
                }}
                className="cursor-crosshair touch-pinch-zoom max-h-full max-w-full h-auto w-auto object-contain outline-[1rem] outline outline-slate-400  rounded-xl"
              onMouseDown={(e) => {
                if (tool === "fill") {
                  handleFill(e);
                } else {
                  startDrawing(e);
                }
              }}
              onTouchStart={(e) => {
                if (tool === "fill") {
                  handleFill(e);
                } else {
                  startDrawing(e);
                }
              }}
              onMouseMove={drawing}
              onTouchMove={drawing}
              onMouseUp={endDrawing}
              onMouseOut={endDrawing}
              onTouchEnd={endDrawing}
              onTouchCancel={endDrawing}
            />
          </div>
        
        <div className={`
          fixed inset-0 z-50 bg-black/50
          ${showHistoryMobile ? 'block' : 'hidden'}
        `} onClick={() => setShowHistoryMobile(false)}>
          <div 
            className="absolute right-0 top-0 h-full w-4/5 max-w-sm bg-slate-50 shadow-xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <button 
              onClick={() => setShowHistoryMobile(false)}
              className="absolute top-4 right-4 text-slate-500 hover:text-slate-700 z-10"
            >
              <X size={20} />
            </button>
            <HistoryPanel history={history} onRestore={restoreDrawing} onDelete={deleteHistoryItem} />
          </div>
        </div>

      <Dialog
        open={isDisconnected}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Server Disconnected</DialogTitle>
            <DialogDescription>
              Lost connection to the drawing server.
              {reconnectAttemptsRef.current < MAX_RECONNECT_ATTEMPTS
                ? " Attempting to reconnect..."
                : " Maximum reconnection attempts reached."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              onClick={() => window.location.reload()}
            >
              Reload Page
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showClearConfirm} onOpenChange={setShowClearConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Nieuw canvas maken?</DialogTitle>
            <DialogDescription>
             De huidige tekening komt in de geschiedenis te staan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowClearConfirm(false)}
            >
              Annuleren
            </Button>
            <Button variant="destructive" onClick={confirmClear}>
              Bevestigen
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default DrawingApp;
