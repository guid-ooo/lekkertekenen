interface InitAction {
  type: "init";
  image: string;
}

export interface DrawAction {
  type: "draw";
  points: { x: number; y: number }[];
  color: string;
  brushSize: number;
}

export interface FillAction {
  type: "fill";
  x: number;
  y: number;
  color: string;
}

interface ClearAction {
  type: "clear";
}

interface GetHistoryAction {
  type: "get-history";
}

export interface HistoryItem {
  id: string;
  timestamp: number;
  image: string; // base64 PNG
}

interface HistoryUpdateAction {
  type: "history-update";
  history: HistoryItem[];
}

interface RestoreAction {
  type: "restore";
  id: string;
}

interface DeleteHistoryAction {
  type: "delete-history";
  id: string;
}

export type CanvasAction = 
  | InitAction 
  | DrawAction 
  | FillAction 
  | ClearAction 
  | GetHistoryAction 
  | HistoryUpdateAction 
  | RestoreAction
  | DeleteHistoryAction;
