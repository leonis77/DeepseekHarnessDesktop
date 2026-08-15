export default function TasksPanel() {
  return (
    <div className="panel-empty">
      <h4>任务</h4>
      <p>任务 / 目标状态保存在各会话的 session.jsonl.zstd（zstd 压缩）里，属于 Harness 运行时数据。</p>
      <p>
        此面板是「任务视图」的扩展位：后续可在此接入 Harness 的目标/待办查询接口（例如通过 Harness 的 API 或直接解压会话日志）。
      </p>
    </div>
  );
}
