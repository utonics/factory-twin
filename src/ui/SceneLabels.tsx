import { labelElements, SELECTION_LABEL_ID, ZONE_LABELS } from '../scene/sceneLabels'
import { useFactoryStore } from '../store/useFactoryStore'
import { selectionInfo } from './selectionInfo'

/** 라벨 id별 ref 콜백을 한 번만 만들어, 다시 그려도 등록이 풀렸다 붙었다 하지 않게 한다 */
const refCallbacks = new Map<string, (el: HTMLElement | null) => void>()
function register(id: string) {
  let callback = refCallbacks.get(id)
  if (!callback) {
    callback = (el) => {
      if (el) labelElements.set(id, el)
      else labelElements.delete(id)
    }
    refCallbacks.set(id, callback)
  }
  return callback
}

/** 선택 태그만 스냅샷을 구독(아무것도 선택하지 않으면 다시 그리지 않음) */
function SelectionTag({ id }: { id: string }) {
  const snapshot = useFactoryStore((s) => s.snapshot)
  const info = selectionInfo(snapshot, id)
  if (!info) return null
  return (
    <div ref={register(SELECTION_LABEL_ID)} className="scene-tag">
      <strong>{info.title}</strong>
      <span style={{ color: info.statusColor }}>{info.statusLabel}</span>
    </div>
  )
}

/** 장면 위 라벨(구역명, 선택 태그). 위치는 캔버스의 LabelProjector가 갱신한다. */
export function SceneLabels() {
  const selectedId = useFactoryStore((s) => s.selectedId)
  return (
    <div className="scene-labels">
      {ZONE_LABELS.map((label) => (
        <div key={label.id} ref={register(label.id)} className="zone-label">
          {label.text}
        </div>
      ))}
      {selectedId && <SelectionTag key={selectedId} id={selectedId} />}
    </div>
  )
}
