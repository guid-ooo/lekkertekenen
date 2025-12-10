interface InitAction {
  type: "init";
  image: string;
  historyId?: string; // Optional ID when restoring from history
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

interface SaveToHistoryAction {
  type: "save-to-history";
  id?: string; // If provided, update existing; otherwise create new
}

interface WaveAction {
  type: "wave";
}

export interface User {
  id: string;
}

interface PresenceUpdateAction {
  type: "presence-update";
  users: User[];
}

export type CanvasAction = 
  | InitAction 
  | DrawAction 
  | FillAction 
  | ClearAction 
  | GetHistoryAction 
  | HistoryUpdateAction 
  | RestoreAction
  | DeleteHistoryAction
  | SaveToHistoryAction
  | PresenceUpdateAction
  | WaveAction;
