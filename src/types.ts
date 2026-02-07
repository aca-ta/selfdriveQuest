export type CellType = 'terrain' | 'road' | 'start' | 'goal';

export interface MazeConfig {
  num_rows: number;
  num_cols: number;
  walls: [number, number][];
  start: [number, number];
  goal: [number, number];
}

export type GamePhase = 'edit' | 'train' | 'trained' | 'test' | 'result' | 'play';

// WebSocket messages from server
export interface WsStepMessage {
  type: 'step';
  episode: number;
  maze_index: number;
  step: number;
  position: [number, number];
  action: number;
  reward: number;
}

export interface WsEpisodeEndMessage {
  type: 'episode_end';
  episode: number;
  maze_index: number;
  total_steps: number;
  reached_goal: boolean;
  epsilon: number;
  avg_loss: number;
}

export interface WsTrainingDoneMessage {
  type: 'training_done';
  total_episodes: number;
  final_paths: [number, number][][];
  converged: boolean;
}

export interface WsTestMazeMessage {
  type: 'test_maze';
  test_index: number;
  walls: [number, number][];
  start: [number, number];
  goal: [number, number];
  bfs_shortest: number | null;
}

export interface WsTestStepMessage {
  type: 'test_step';
  test_index: number;
  step: number;
  position: [number, number];
  action: number;
  action_name: string;
  q_values: Record<string, number>;
}

export interface WsTestResultMessage {
  type: 'test_result';
  test_index: number;
  reached_goal: boolean;
  steps: number;
  path: [number, number][];
}

export interface WsTestDoneMessage {
  type: 'test_done';
  results: WsTestResultMessage[];
  success_rate: number;
  avg_efficiency: number;
  total_score: number;
}

export interface WsErrorMessage {
  type: 'error';
  message: string;
}

export type WsServerMessage =
  | WsStepMessage
  | WsEpisodeEndMessage
  | WsTrainingDoneMessage
  | WsTestMazeMessage
  | WsTestStepMessage
  | WsTestResultMessage
  | WsTestDoneMessage
  | WsErrorMessage;

export interface EpisodeResult {
  episode: number;
  steps: number;
  reached_goal: boolean;
}

export interface MazeData {
  id: number;
  roads: Set<string>; // "row,col" format — cells where the car can drive
  start: [number, number];
  goal: [number, number];
}

export interface TestResultData {
  test_index: number;
  walls: [number, number][];
  start: [number, number];
  goal: [number, number];
  reached_goal: boolean;
  steps: number;
  path: [number, number][];
  bfs_shortest: number | null;
}

export interface HyperParams {
  maxEpisodes: number;
  lr: number;
  gamma: number;
  epsilonEnd: number;
  epsilonDecayEpisodes: number;
  revisitPenalty: number;
}

export interface ScoreData {
  success_rate: number;
  avg_efficiency: number;
  total_score: number;
}
