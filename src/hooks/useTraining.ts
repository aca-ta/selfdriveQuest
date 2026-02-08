import { useState, useCallback, useRef, useEffect } from 'react';
import type {
  GamePhase,
  MazeConfig,
  HyperParams,
  EpisodeResult,
  WsServerMessage,
  TestResultData,
  ScoreData,
  SaveSlotInfo,
} from '../types';
import { validateMaze } from '../engine/solver';

// テスト中のメッセージをキューに溜めてゆっくり再生する間隔 (ms)
const TEST_STEP_INTERVAL = 100;

export function useTraining() {
  const [phase, setPhase] = useState<GamePhase>('edit');
  const [agentPosition, setAgentPosition] = useState<[number, number] | null>(null);
  const [currentEpisode, setCurrentEpisode] = useState(0);
  const [currentMazeIndex, setCurrentMazeIndex] = useState(0);
  const [episodes, setEpisodes] = useState<EpisodeResult[]>([]);
  const [finalPaths, setFinalPaths] = useState<[number, number][][]>([]);
  const [testResults, setTestResults] = useState<TestResultData[]>([]);
  const [currentTestMaze, setCurrentTestMaze] = useState<{
    walls: [number, number][];
    start: [number, number];
    goal: [number, number];
    bfs_shortest: number | null;
  } | null>(null);
  const [score, setScore] = useState<ScoreData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [testLogs, setTestLogs] = useState<Map<number, string[]>>(new Map());
  const [savedSlots, setSavedSlots] = useState<SaveSlotInfo[]>([]);
  const [modelName, setModelName] = useState<string | null>('モデル 1');
  const [activeSlot, setActiveSlot] = useState<number | null>(0);
  const [modelReady, setModelReady] = useState(false);

  const mazeConfigsRef = useRef<MazeConfig[]>([]);

  // Web Worker (エージェントと学習ループを別スレッドで実行)
  const workerRef = useRef<Worker | null>(null);

  // テストメッセージのキュー再生用
  const testQueueRef = useRef<WsServerMessage[]>([]);
  const testTimerRef = useRef<number | null>(null);
  const currentTestMazeRef = useRef<{
    walls: [number, number][];
    start: [number, number];
    goal: [number, number];
    bfs_shortest: number | null;
  } | null>(null);

  // テストログ蓄積用 ref（processTestQueue 内で更新）
  const currentTestIdxRef = useRef<number>(0);
  const testLogsRef = useRef<Map<number, string[]>>(new Map());

  // 現在のフェーズを ref で保持（コールバック内で参照するため）
  const phaseRef = useRef<GamePhase>(phase);
  phaseRef.current = phase;

  const activeSlotRef = useRef<number | null>(activeSlot);
  activeSlotRef.current = activeSlot;

  // キューからメッセージを1つずつ処理
  const processTestQueue = useCallback(() => {
    const queue = testQueueRef.current;
    if (queue.length === 0) {
      testTimerRef.current = null;
      return;
    }

    const msg = queue.shift()!;
    switch (msg.type) {
      case 'test_maze': {
        const testMaze = {
          walls: msg.walls,
          start: msg.start,
          goal: msg.goal,
          bfs_shortest: msg.bfs_shortest,
        };
        currentTestMazeRef.current = testMaze;
        currentTestIdxRef.current = msg.test_index;
        setCurrentTestMaze(testMaze);
        setAgentPosition(msg.start);
        const header = `--- テスト ${msg.test_index + 1} 開始 ---`;
        testLogsRef.current.set(msg.test_index, [header]);
        setLog([header]);
        break;
      }
      case 'test_step': {
        setAgentPosition(msg.position);
        const qEntries = Object.entries(msg.q_values)
          .map(([dir, val]) => `${dir}${dir === msg.action_name ? '*' : ' '}${val >= 0 ? '+' : ''}${val.toFixed(2)}`)
          .join('  ');
        const stepLine = `#${msg.step} (${msg.position[0]},${msg.position[1]}) ${msg.action_name}を選択  Q[${qEntries}]`;
        testLogsRef.current.get(msg.test_index)?.push(stepLine);
        setLog(prev => [...prev, stepLine]);
        break;
      }
      case 'test_result': {
        const tm = currentTestMazeRef.current;
        setTestResults(prev => [...prev, {
          test_index: msg.test_index,
          walls: tm?.walls ?? [],
          start: tm?.start ?? [0, 0],
          goal: tm?.goal ?? [0, 0],
          reached_goal: msg.reached_goal,
          steps: msg.steps,
          path: msg.path,
          bfs_shortest: tm?.bfs_shortest ?? null,
        }]);
        const resultText = msg.reached_goal
          ? `→ ゴール！ ${msg.steps}km (最短${tm?.bfs_shortest ?? '?'})`
          : `→ たどり着けなかった… (${msg.steps}km)`;
        testLogsRef.current.get(msg.test_index)?.push(resultText);
        setLog(prev => [...prev, resultText]);
        break;
      }
      case 'test_done':
        setScore({
          success_rate: msg.success_rate,
          avg_efficiency: msg.avg_efficiency,
          total_score: msg.total_score,
        });
        setTestLogs(new Map(testLogsRef.current));
        setAgentPosition(null);
        // play フェーズならそのまま維持（result に遷移しない）
        if (phaseRef.current !== 'play') {
          setPhase('result');
        }
        break;
    }

    testTimerRef.current = window.setTimeout(processTestQueue, TEST_STEP_INTERVAL);
  }, []);

  const handleMessage = useCallback((msg: WsServerMessage) => {
    switch (msg.type) {
      case 'step':
        setAgentPosition(msg.position);
        setCurrentMazeIndex(msg.maze_index);
        break;
      case 'episode_end': {
        setCurrentEpisode(msg.episode);
        setEpisodes(prev => [...prev, {
          episode: msg.episode,
          steps: msg.total_steps,
          reached_goal: msg.reached_goal,
        }]);
        const icon = msg.reached_goal ? 'o' : 'x';
        const eps = (msg.epsilon * 100).toFixed(0);
        setLog(prev => [...prev,
          `[EP ${msg.episode}] ${icon} ${msg.total_steps}km  ε=${eps}%  loss=${msg.avg_loss.toFixed(4)}`,
        ]);
        break;
      }
      case 'training_done':
        setFinalPaths(msg.final_paths);
        setAgentPosition(null);
        setModelReady(true);
        setPhase('trained');
        setLog(prev => [...prev,
          `--- 学習完了 (${msg.total_episodes}エピソード${msg.converged ? ', 収束' : ''}) ---`,
        ]);
        break;
      // テスト系メッセージはすべてキューに入れる
      case 'test_maze':
      case 'test_step':
      case 'test_result':
      case 'test_done':
        testQueueRef.current.push(msg);
        if (testTimerRef.current === null) {
          processTestQueue();
        }
        break;
      case 'model_saved': {
        setSavedSlots(prev => {
          const filtered = prev.filter(s => s.slot !== msg.slotInfo.slot);
          return [...filtered, msg.slotInfo].sort((a, b) => a.slot - b.slot);
        });
        setActiveSlot(msg.slotInfo.slot);
        break;
      }
      case 'model_loaded': {
        const logData = msg.log;
        if (logData?.episodes) {
          setEpisodes(logData.episodes);
        }
        if (logData?.score) {
          setScore(logData.score);
        }
        const loadedName = logData?.name ?? null;
        setModelName(loadedName);
        setActiveSlot(msg.slot);
        setModelReady(true);
        const nameLabel = loadedName ? ` "${loadedName}"` : '';
        setLog([`--- スロット${msg.slot + 1}${nameLabel}からモデルを読み込みました ---`]);
        break;
      }
      case 'model_deleted': {
        setSavedSlots(prev => prev.filter(s => s.slot !== msg.slot));
        if (activeSlotRef.current === msg.slot) {
          setActiveSlot(null);
          setModelName(null);
        }
        break;
      }
      case 'model_list':
        setSavedSlots(msg.slots.sort((a, b) => a.slot - b.slot));
        break;
      case 'error':
        setError(msg.message);
        break;
    }
  }, [processTestQueue]);

  /** Worker を取得（遅延初期化、再利用） */
  const getWorker = useCallback(() => {
    if (!workerRef.current) {
      const w = new Worker(
        new URL('../engine/engine.worker.ts', import.meta.url),
        { type: 'module' },
      );
      w.onmessage = (e: MessageEvent<WsServerMessage>) => {
        handleMessage(e.data);
      };
      workerRef.current = w;
    }
    return workerRef.current;
  }, [handleMessage]);

  // クリーンアップ
  useEffect(() => {
    return () => {
      if (testTimerRef.current !== null) clearTimeout(testTimerRef.current);
      workerRef.current?.terminate();
      workerRef.current = null;
    };
  }, []);

  const startTraining = useCallback((mazeConfigs: MazeConfig[], hp: HyperParams) => {
    setError(null);

    // バリデーション (メインスレッドで即座に実行 — BFS は軽量)
    for (let i = 0; i < mazeConfigs.length; i++) {
      const result = validateMaze(mazeConfigs[i]);
      if (!result.valid) {
        setError(`迷路${i + 1}: ${result.message}`);
        return;
      }
    }

    mazeConfigsRef.current = mazeConfigs;
    setPhase('train');
    setEpisodes([]);
    setCurrentEpisode(0);
    setCurrentMazeIndex(0);
    setAgentPosition(null);
    setLog([`--- 学習開始 (${mazeConfigs.length}コース) ---`]);

    // Worker に学習コマンドを送信
    getWorker().postMessage({
      type: 'start_train',
      mazes: mazeConfigs,
      hp,
    });
  }, [getWorker]);

  const clearTestQueue = useCallback(() => {
    testQueueRef.current = [];
    if (testTimerRef.current !== null) {
      clearTimeout(testTimerRef.current);
      testTimerRef.current = null;
    }
    currentTestMazeRef.current = null;
  }, []);

  const startTest = useCallback((numRows: number, numCols: number) => {
    clearTestQueue();
    testLogsRef.current.clear();
    setPhase('test');
    setTestResults([]);
    setTestLogs(new Map());
    setCurrentTestMaze(null);
    setScore(null);

    getWorker().postMessage({
      type: 'start_test',
      numRows,
      numCols,
      numTests: 10,
    });
  }, [getWorker, clearTestQueue]);

  const startPlayground = useCallback((mazeConfig: MazeConfig) => {
    const result = validateMaze(mazeConfig);
    if (!result.valid) {
      setError(result.message);
      return;
    }

    clearTestQueue();
    setError(null);
    setTestResults([]);
    setCurrentTestMaze(null);
    setScore(null);
    setLog([`--- コースに挑戦 ---`]);

    getWorker().postMessage({
      type: 'play',
      maze: mazeConfig,
    });
  }, [getWorker, clearTestQueue]);

  const stopTraining = useCallback(() => {
    workerRef.current?.postMessage({ type: 'stop' });
    setPhase('edit');
    setAgentPosition(null);
  }, []);

  // テストを中断してtrained画面へ（行き先をユーザーに選ばせる）
  const stopTest = useCallback(() => {
    clearTestQueue();
    workerRef.current?.postMessage({ type: 'stop' });
    setPhase('trained');
    setAgentPosition(null);
    setTestResults([]);
    setCurrentTestMaze(null);
    setScore(null);
    setError(null);
  }, [clearTestQueue]);

  // モデルを保持したまま編集画面に戻る（追加学習用）
  const backToEdit = useCallback(() => {
    clearTestQueue();
    workerRef.current?.postMessage({ type: 'stop' });
    setPhase('edit');
    setAgentPosition(null);
    setTestResults([]);
    setCurrentTestMaze(null);
    setScore(null);
    setError(null);
    // episodes, finalPaths, log は保持（学習履歴として参照できる）
    // Worker 内の agent も保持される（追加学習用）
  }, [clearTestQueue]);

  // プレイグラウンドモードへ移行
  const enterPlayground = useCallback(() => {
    clearTestQueue();
    workerRef.current?.postMessage({ type: 'stop' });
    setPhase('play');
    setAgentPosition(null);
    setTestResults([]);
    setCurrentTestMaze(null);
    setScore(null);
    setError(null);
    setLog([]);
  }, [clearTestQueue]);

  // モデル保存
  const saveModel = useCallback((slot: number, log?: {
    name?: string;
    mazes?: MazeConfig[];
    hyperParams?: HyperParams;
    episodes?: EpisodeResult[];
    score?: ScoreData | null;
    testSummary?: { success: number; total: number };
  }) => {
    if (log?.name) setModelName(log.name);
    getWorker().postMessage({ type: 'save_model', slot, log });
  }, [getWorker]);

  // モデル読み込み
  const loadModel = useCallback((slot: number) => {
    setError(null);
    getWorker().postMessage({ type: 'load_model', slot });
  }, [getWorker]);

  // モデル削除
  const deleteModel = useCallback((slot: number) => {
    getWorker().postMessage({ type: 'delete_model', slot });
  }, [getWorker]);

  // スロット一覧を取得
  const refreshSlots = useCallback(() => {
    getWorker().postMessage({ type: 'list_models' });
  }, [getWorker]);

  // 完全リセット（モデルも破棄）
  const reset = useCallback(() => {
    clearTestQueue();
    workerRef.current?.postMessage({ type: 'reset' });
    setPhase('edit');
    setAgentPosition(null);
    setEpisodes([]);
    setFinalPaths([]);
    setTestResults([]);
    setCurrentTestMaze(null);
    setScore(null);
    setError(null);
    setLog([]);
    setModelName(null);
    setActiveSlot(null);
    setModelReady(false);
  }, [clearTestQueue]);

  return {
    phase,
    agentPosition,
    currentEpisode,
    currentMazeIndex,
    episodes,
    finalPaths,
    testResults,
    currentTestMaze,
    score,
    error,
    log,
    testLogs,
    savedSlots,
    modelName,
    setModelName,
    activeSlot,
    setActiveSlot,
    modelReady,
    setModelReady,
    startTraining,
    startTest,
    startPlayground,
    enterPlayground,
    stopTraining,
    stopTest,
    backToEdit,
    reset,
    saveModel,
    loadModel,
    deleteModel,
    refreshSlots,
  };
}
