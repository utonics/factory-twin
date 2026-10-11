import { labelElements, SELECTION_LABEL_ID, ZONE_LABELS } from '../scene/sceneLabels'
import { useFactoryStore } from '../store/useFactoryStore'
import { selectionInfo } from './selectionInfo'

function register(id: string) {
  return (el: HTMLElement | null) => {
    if (el) labelElements.set(id, el)
    else labelElements.delete(id)
  }
}

/** 장면 위 라벨(구역명, 선택 태그). 위치는 캔버스의 LabelProjector가 갱신한다. */
export function SceneLabels() {
  const selectedId = useFactoryStore((s) => s.selectedId)
  const snapshot = useFactoryStore((s) => s.snapshot)
  const info = selectedId ? selectionInfo(snapshot, selectedId) : null

  return (
    <div className="scene-labels">
      {ZONE_LABELS.map((label) => (
        <div key={label.id} ref={register(label.id)} className="zone-label">
          {label.text}
        </div>
      ))}
      {info && (
        <div key={selectedId} ref={register(SELECTION_LABEL_ID)} className="scene-tag">
          <strong>{info.title}</strong>
          <span style={{ color: info.statusColor }}>{info.statusLabel}</span>
        </div>
      )}
    </div>
  )
}
