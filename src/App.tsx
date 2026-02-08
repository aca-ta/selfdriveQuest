import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
import { useMaze } from './hooks/useMaze';
import { useTraining } from './hooks/useTraining';
import { GridEditor } from './components/GridEditor';
import { MazeListPanel, MiniGrid } from './components/MazeListPanel';
import { ControlPanel } from './components/ControlPanel';
import { EpisodeChart } from './components/EpisodeChart';
import { TestView } from './components/TestView';
import { ScoreDisplay } from './components/ScoreDisplay';
import { AgentLog } from './components/AgentLog';
import { HyperParamsPanel, DEFAULT_HYPER_PARAMS } from './components/HyperParamsPanel';
import { ModelSlotPanel } from './components/ModelSlotPanel';
import { TrainActions } from './components/TrainActions';
import type { HyperParams } from './types';
import './App.css';

function App() {
  const maze = useMaze();
  const training = useTraining();

  const isEditing = training.phase === 'edit';
  const isPlayground = training.phase === 'play';
  const [selectedTestIdx, setSelectedTestIdx] = useState<number | null>(null);
  const [hyperParams, setHyperParams] = useState<HyperParams>(DEFAULT_HYPER_PARAMS);
  const [showResultPopup, setShowResultPopup] = useState(true);
  const [playRunning, setPlayRunning] = useState(false);
  const [playgroundMazeAdded, setPlaygroundMazeAdded] = useState(false);

  // 初回マウント時にスロット一覧を取得
  useEffect(() => {
    training.refreshSlots();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // スロット一覧取得後、デフォルトスロットに保存済みモデルがあれば自動読み込み
  const initialLoadDone = useRef(false);
  useEffect(() => {
    if (!initialLoadDone.current && training.savedSlots.length > 0 && training.activeSlot != null) {
      if (training.savedSlots.some(s => s.slot === training.activeSlot)) {
        training.loadModel(training.activeSlot);
      }
      initialLoadDone.current = true;
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training.savedSlots]);

  // 学習完了・テスト完了時にスロットが選択されていたら自動保存
  const prevPhaseRef = useRef(training.phase);
  useEffect(() => {
    const prev = prevPhaseRef.current;
    prevPhaseRef.current = training.phase;
    if (training.activeSlot == null) return;

    if (prev === 'train' && training.phase === 'trained') {
      const configs = maze.getMazeConfigs();
      const name = training.modelName ?? '';
      training.saveModel(training.activeSlot, {
        name: name || undefined,
        mazes: configs.length > 0 ? configs : undefined,
        hyperParams,
        episodes: training.episodes.length > 0 ? training.episodes : undefined,
      });
    }

    if (prev === 'test' && training.phase === 'result') {
      const configs = maze.getMazeConfigs();
      const name = training.modelName ?? '';
      const testSummary = training.testResults.length > 0
        ? { success: training.testResults.filter(r => r.reached_goal).length, total: training.testResults.length }
        : undefined;
      training.saveModel(training.activeSlot, {
        name: name || undefined,
        mazes: configs.length > 0 ? configs : undefined,
        hyperParams,
        episodes: training.episodes.length > 0 ? training.episodes : undefined,
        score: training.score,
        testSummary,
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [training.phase]);

  // 選択中のテスト結果
  const selectedTest = useMemo(() => {
    if (selectedTestIdx == null) return null;
    return training.testResults.find(r => r.test_index === selectedTestIdx) ?? null;
  }, [selectedTestIdx, training.testResults]);

  // Compute path cells for display
  const pathCells = useMemo(() => {
    const set = new Set<string>();
    if (training.phase === 'trained' && training.finalPaths[maze.activeMazeIdx]) {
      for (const [r, c] of training.finalPaths[maze.activeMazeIdx]) {
        set.add(`${r},${c}`);
      }
    }
    // result フェーズで選択中のテスト結果のパスを表示
    if (training.phase === 'result' && selectedTest) {
      for (const [r, c] of selectedTest.path) {
        set.add(`${r},${c}`);
      }
    }
    // play フェーズでテスト結果のパスを表示
    if (training.phase === 'play' && training.testResults[0]?.path) {
      for (const [r, c] of training.testResults[0].path) {
        set.add(`${r},${c}`);
      }
    }
    return set;
  }, [training.phase, training.finalPaths, maze.activeMazeIdx, selectedTest, training.testResults]);

  // 表示するstart/goalを決定
  const displayStartGoal = useMemo((): { start: [number, number]; goal: [number, number] } => {
    if (training.phase === 'result' && selectedTest) {
      return { start: selectedTest.start, goal: selectedTest.goal };
    }
    if ((training.phase === 'test' || training.phase === 'result') && training.currentTestMaze) {
      return { start: training.currentTestMaze.start, goal: training.currentTestMaze.goal };
    }
    if (training.phase === 'train') {
      const m = maze.mazes[training.currentMazeIndex];
      if (m) return { start: m.start, goal: m.goal };
    }
    return { start: maze.activeMaze.start, goal: maze.activeMaze.goal };
  }, [training.phase, training.currentTestMaze, training.currentMazeIndex, maze.mazes, maze.activeMaze, selectedTest]);

  // play フェーズ: 結果が出たら or エラー時に走行中フラグを下ろす
  const playHasResult = isPlayground && training.testResults.length > 0;
  if ((playHasResult || training.error) && playRunning) {
    setPlayRunning(false);
  }

  // 表示するコースの道路を決定
  const displayRoads = useMemo(() => {
    // result フェーズで選択したテスト結果を表示
    const testData = (training.phase === 'result' && selectedTest)
      ? selectedTest
      : (training.phase === 'test' || training.phase === 'result') && training.currentTestMaze
        ? training.currentTestMaze
        : null;

    if (testData) {
      const { start, goal } = displayStartGoal;
      const wallSet = new Set(testData.walls.map(([r, c]: [number, number]) => `${r},${c}`));
      const roads = new Set<string>();
      for (let r = 0; r < maze.gridSize.rows; r++) {
        for (let c = 0; c < maze.gridSize.cols; c++) {
          if (r === start[0] && c === start[1]) continue;
          if (r === goal[0] && c === goal[1]) continue;
          if (!wallSet.has(`${r},${c}`)) {
            roads.add(`${r},${c}`);
          }
        }
      }
      return roads;
    }
    // 学習中は currentMazeIndex のコースを表示
    if (training.phase === 'train') {
      const m = maze.mazes[training.currentMazeIndex];
      return m ? m.roads : maze.activeMaze.roads;
    }
    return maze.activeMaze.roads;
  }, [training.phase, training.currentTestMaze, training.currentMazeIndex, maze.mazes, maze.activeMaze.roads, maze.gridSize, selectedTest, displayStartGoal]);

  const handleTrain = useCallback(() => {
    const configs = maze.getMazeConfigs();
    training.startTraining(configs, hyperParams);
  }, [maze, training, hyperParams]);

  const handleFreshTrain = useCallback(() => {
    const configs = maze.getMazeConfigs();
    training.startTraining(configs, hyperParams, true);
  }, [maze, training, hyperParams]);

  const handleBackToEdit = useCallback(() => {
    if (playgroundMazeAdded) {
      maze.removeLastMaze();
      setPlaygroundMazeAdded(false);
    }
    setSelectedTestIdx(null);
    training.backToEdit();
  }, [training, playgroundMazeAdded, maze]);

  const handleStartTest = useCallback(() => {
    if (playgroundMazeAdded) {
      maze.removeLastMaze();
      setPlaygroundMazeAdded(false);
    }
    setSelectedTestIdx(null);
    setShowResultPopup(true);
    training.startTest(maze.gridSize.rows, maze.gridSize.cols);
  }, [training, playgroundMazeAdded, maze]);

  const handleSelectTest = useCallback((idx: number) => {
    setSelectedTestIdx(idx);
    setShowResultPopup(false);
  }, []);

  const handleEnterPlayground = useCallback(() => {
    setSelectedTestIdx(null);
    setPlayRunning(false);
    training.enterPlayground();
    maze.addEmptyMaze();
    setPlaygroundMazeAdded(true);
  }, [training, maze]);

  const handlePlayClearRoads = useCallback(() => {
    maze.clearRoads();
    setPlayRunning(false);
    training.enterPlayground();
  }, [maze, training]);

  const handleRunPlayground = useCallback(() => {
    const configs = maze.getMazeConfigs();
    const activeConfig = configs[maze.activeMazeIdx];
    if (!activeConfig) return;
    setPlayRunning(true);
    training.startPlayground(activeConfig);
  }, [maze, training]);

  const canSaveModel = training.phase === 'trained' || training.phase === 'result' || training.phase === 'play'
    || (training.phase === 'edit' && (training.episodes.length > 0 || training.activeSlot != null));

  const handleSaveModel = useCallback((slot: number, name: string) => {
    const configs = maze.getMazeConfigs();
    const testSummary = training.testResults.length > 0
      ? { success: training.testResults.filter(r => r.reached_goal).length, total: training.testResults.length }
      : undefined;
    training.saveModel(slot, {
      name: name || undefined,
      mazes: configs.length > 0 ? configs : undefined,
      hyperParams,
      episodes: training.episodes.length > 0 ? training.episodes : undefined,
      score: training.score,
      testSummary,
    });
  }, [training, maze, hyperParams]);

  const handleSelectSlot = useCallback((slot: number) => {
    training.setActiveSlot(slot);
    training.setModelReady(false);
  }, [training]);

  const handleLoadModel = useCallback((slot: number) => {
    training.loadModel(slot);
  }, [training]);

  const handleDeleteModel = useCallback((slot: number) => {
    training.deleteModel(slot);
  }, [training]);

  const handleAddFailedCourses = useCallback(() => {
    const failed = training.testResults.filter(r => !r.reached_goal);
    for (const r of failed) {
      maze.addMazeFromWalls(r.walls, r.start, r.goal);
    }
    setSelectedTestIdx(null);
    training.backToEdit();
  }, [training, maze]);

  return (
    <div className="app">
      <div className="header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
          <div>
            <h1 className="title">SelfdriveQuest</h1>
            <p className="subtitle">道路をたくさん走らせて、賢い自動運転を作ろう！</p>
          </div>
          {isEditing && (
            <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.6)', lineHeight: 1.8, marginLeft: 'auto' }}>
              ① コースを作る → ②「学習する」→ ③「実力を試す」
            </div>
          )}
        </div>
      </div>

      <div className="main-area">
        <ControlPanel
          phase={training.phase}
          currentEpisode={training.currentEpisode}
          error={training.error}
          modelName={training.modelName}
          onStop={training.stopTraining}
          onStopTest={training.stopTest}
          onReset={training.reset}
          onClearRoads={isPlayground ? handlePlayClearRoads : maze.clearRoads}
          onRegenerate={maze.regenerateActiveMaze}
          onBackToEdit={handleBackToEdit}
          onTest={handleStartTest}
          onAddFailedCourses={handleAddFailedCourses}
          onShowScore={() => setShowResultPopup(true)}
          onRunPlayground={handleRunPlayground}
          onEnterPlayground={handleEnterPlayground}
          playRunning={playRunning}
          failedCount={training.testResults.filter(r => !r.reached_goal).length}
        />

        <ModelSlotPanel
          slots={training.savedSlots}
          canSave={canSaveModel}
          activeSlot={training.activeSlot}
          modelName={training.modelName}
          onModelNameChange={isEditing ? training.setModelName : undefined}
          onSave={handleSaveModel}
          onLoad={handleLoadModel}
          onSelect={isEditing ? handleSelectSlot : undefined}
          onDelete={handleDeleteModel}
        />

        <div style={{ display: 'flex', gap: 12, alignItems: 'stretch' }}>
          <div className="card" style={{ display: 'flex', gap: 16, padding: 20, alignItems: 'flex-start', flexShrink: 0 }}>
            {isEditing && (
              <MazeListPanel
                mazes={maze.mazes}
                activeMazeIdx={maze.activeMazeIdx}
                rows={maze.gridSize.rows}
                cols={maze.gridSize.cols}
                disabled={!isEditing}
                onSelect={maze.setActiveMazeIdx}
                onAdd={maze.addMaze}
                onRemove={maze.removeMaze}
              />
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0, width: isEditing ? undefined : 500, maxWidth: 560 }}>
              {isEditing && (
                <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
                  {([[5, '初級'], [10, '中級'], [15, '上級']] as const).map(([s, label]) => (
                    <button
                      key={s}
                      onClick={() => maze.changeGridSize(s, s)}
                      className={`btn-chip${maze.gridSize.rows === s ? ' active' : ''}`}
                      style={{ padding: '3px 10px', fontSize: 12 }}
                    >
                      {label}({s}x{s})
                    </button>
                  ))}
                  <span style={{ color: 'var(--color-border)', margin: '0 2px' }}>|</span>
                  <button className="btn btn-accent btn-sm" onClick={maze.regenerateActiveMaze}>
                    コースを変える
                  </button>
                  <button className="btn btn-ghost btn-sm" onClick={maze.clearRoads}>
                    道路リセット
                  </button>
                </div>
              )}
              <GridEditor
                rows={maze.gridSize.rows}
                cols={maze.gridSize.cols}
                roads={displayRoads}
                start={displayStartGoal.start}
                goal={displayStartGoal.goal}
                agentPosition={selectedTest ? null : (training.agentPosition ?? displayStartGoal.start)}
                pathCells={pathCells}
                disabled={!isEditing && !(isPlayground && !playRunning)}
                showDecorations={training.phase !== 'edit' && !(isPlayground && (!playRunning || !!training.error) && !playHasResult)}
                onToggleRoad={maze.toggleRoad}
                onSetRoad={maze.setRoad}
                onSetStart={maze.setStart}
                onSetGoal={maze.setGoal}
              />
              {isEditing && (
                <span style={{ fontSize: 11, color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                  {maze.mazes.length === 0 && 'シンプルな一本道から始めるのがおすすめ！'}
                  {maze.mazes.length === 1 && '2〜3コースあると色んなパターンを覚えられるよ'}
                  {maze.mazes.length >= 2 && maze.mazes.length <= 3 && training.episodes.length === 0 && 'クリックで道路を編集。準備ができたら「学習する」へ'}
                  {maze.mazes.length >= 2 && maze.mazes.length <= 3 && training.episodes.length > 0 && '形の違うコースを混ぜると初見にも対応できるよ'}
                  {maze.mazes.length >= 4 && 'コースが多いと練習が分散するので注意'}
                </span>
              )}
            </div>
          </div>

          {isEditing && (
            <div className="card" style={{ display: 'flex', flexDirection: 'column', flex: 1, minWidth: 200, padding: 24 }}>
              <HyperParamsPanel
                value={hyperParams}
                onChange={setHyperParams}
                disabled={false}
              />
              <TrainActions
                modelReady={training.modelReady}
                disabled={maze.mazes.length === 0 || (training.activeSlot != null && !training.modelName?.trim())}
                onContinueTrain={handleTrain}
                onFreshTrain={handleFreshTrain}
              />
              <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                <button className="btn btn-accent" style={{ flex: 1, fontSize: 12 }} onClick={handleStartTest} disabled={!training.modelReady}>
                  実力を試す
                </button>
                <button className="btn btn-info" style={{ flex: 1, fontSize: 12 }} onClick={handleEnterPlayground} disabled={!training.modelReady}>
                  自分のコースで走らせる
                </button>
              </div>
            </div>
          )}

          {!isEditing && (() => {
            const selectedLog = (training.phase === 'result' && selectedTestIdx != null)
              ? training.testLogs.get(selectedTestIdx) ?? null
              : null;
            const lines = selectedLog ?? training.log;
            return lines.length > 0 ? (
              <div style={{ flex: 1, minWidth: 0 }}>
                <AgentLog lines={lines} />
              </div>
            ) : null;
          })()}
        </div>
      </div>

      {(training.phase === 'train' || training.phase === 'trained') && (
        <EpisodeChart episodes={training.episodes} />
      )}

      {training.phase === 'test' && (
        <TestView
          results={training.testResults}
          rows={maze.gridSize.rows}
          cols={maze.gridSize.cols}
        />
      )}

      {training.phase === 'result' && !showResultPopup && (
        <>
          <TestView
            results={training.testResults}
            rows={maze.gridSize.rows}
            cols={maze.gridSize.cols}
            activeIndex={selectedTestIdx ?? undefined}
            onSelect={handleSelectTest}
          />
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start' }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <EpisodeChart episodes={training.episodes} />
            </div>
            <div className="card" style={{ minWidth: 200, padding: 16, fontSize: 13 }}>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>学習コース</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
                {maze.mazes.map(m => (
                  <MiniGrid key={m.id} roads={m.roads} start={m.start} goal={m.goal} rows={maze.gridSize.rows} cols={maze.gridSize.cols} isActive={false} />
                ))}
              </div>
              <div style={{ fontWeight: 700, marginBottom: 8, color: 'var(--color-text)' }}>学習パラメータ</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 4, color: 'var(--color-text-secondary)' }}>
                <div>練習回数: {hyperParams.maxEpisodes}回</div>
                <div>学習のコツ: {hyperParams.lr.toFixed(4)}</div>
                <div>先のことを考える力: {hyperParams.gamma.toFixed(3)}</div>
                <div>チャレンジ精神: {(hyperParams.epsilonEnd * 100).toFixed(0)}%</div>
                <div>新しい道を探す力: {hyperParams.revisitPenalty.toFixed(2)}</div>
              </div>
            </div>
          </div>
        </>
      )}

      {training.phase === 'result' && showResultPopup && (
        <div className="modal-overlay">
          <div className="modal-content">
            <ScoreDisplay score={training.score} />
            <div style={{ marginTop: 16 }}>
              <TestView
                results={training.testResults}
                rows={maze.gridSize.rows}
                cols={maze.gridSize.cols}
                activeIndex={selectedTestIdx ?? undefined}
              />
            </div>
            <div style={{ margin: '16px auto', maxWidth: 340 }}>
              <ModelSlotPanel
                slots={training.savedSlots}
                canSave={canSaveModel}
                activeSlot={training.activeSlot}
                modelName={training.modelName}
                onModelNameChange={training.setModelName}
                onSave={handleSaveModel}
                onLoad={handleLoadModel}
                onSelect={handleSelectSlot}
                onDelete={handleDeleteModel}
              />
            </div>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'center', marginTop: 24, flexWrap: 'wrap' }}>
              <button className="btn btn-accent" onClick={() => setShowResultPopup(false)}>
                結果をくわしく見る
              </button>
              {training.testResults.some(r => !r.reached_goal) && (
                <button className="btn btn-danger" onClick={handleAddFailedCourses}>
                  失敗コースを追加して再学習（{training.testResults.filter(r => !r.reached_goal).length}件）
                </button>
              )}
              <button className="btn btn-info" onClick={handleEnterPlayground}>
                自分のコースで走らせる
              </button>
              <button className="btn btn-secondary" onClick={handleBackToEdit}>
                モデルを学習する
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral)', textAlign: 'center', marginTop: 12, lineHeight: 1.7 }}>
              <b>自分のコースで走らせる</b>: 好きなコースを作って、学習した車に挑戦させよう<br />
              <b>失敗コースを追加</b>: 苦手なコースだけ追加して弱点を補強できる
            </div>
          </div>
        </div>
      )}

      {isPlayground && playHasResult && (
        <div className="card" style={{ padding: '12px 16px', textAlign: 'center' }}>
          {training.testResults[0]?.reached_goal ? (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-success)' }}>
              ゴール！ {training.testResults[0].steps}km
              {training.testResults[0].bfs_shortest != null && (
                <span style={{ fontSize: 13, fontWeight: 400, color: 'var(--color-text-secondary)' }}>
                  {' '}(最短 {training.testResults[0].bfs_shortest}km)
                </span>
              )}
            </div>
          ) : (
            <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--color-danger)' }}>
              たどり着けなかった… ({training.testResults[0]?.steps ?? 0}km)
            </div>
          )}
        </div>
      )}

      {training.phase === 'trained' && (
        <div className="modal-overlay">
          <div className="modal-content modal-content-sm">
            <div style={{ fontSize: 40, marginBottom: 8 }}>🎓</div>
            <div style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: 'var(--color-text)' }}>
              学習完了！
            </div>
            <div style={{ fontSize: 14, color: 'var(--color-text-secondary)', marginBottom: 16, lineHeight: 1.8 }}>
              テスト走行で実力を試す？<br />
              それともコースを編集してもっと鍛える？
            </div>
            <div style={{ marginBottom: 16 }}>
              <ModelSlotPanel
                slots={training.savedSlots}
                canSave={canSaveModel}
                activeSlot={training.activeSlot}
                modelName={training.modelName}
                onModelNameChange={training.setModelName}
                onSave={handleSaveModel}
                onLoad={handleLoadModel}
                onSelect={handleSelectSlot}
                onDelete={handleDeleteModel}
              />
            </div>
            <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
              <button className="btn btn-accent btn-lg" onClick={handleStartTest}>
                実力を試す
              </button>
              <button className="btn btn-info btn-lg" onClick={handleEnterPlayground}>
                自分のコースで走らせる
              </button>
              <button className="btn btn-secondary btn-lg" onClick={handleBackToEdit}>
                モデルを学習する
              </button>
            </div>
            <div style={{ fontSize: 11, color: 'var(--color-neutral)', textAlign: 'center', marginTop: 12, lineHeight: 1.7 }}>
              <b>モデルを学習する</b>: コースやパラメータを変えて追加トレーニング。別のスロットで新規モデルも作れます
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
