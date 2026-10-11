import { useFrame } from '@react-three/fiber'
import { useMemo, useRef } from 'react'
import { Vector3 } from 'three'
import { useFactoryStore } from '../store/useFactoryStore'
import { labelElements, SELECTION_LABEL_ID, ZONE_LABELS } from './sceneLabels'
import { locateSelection, selectionFrame } from './selectionGeometry'

/** 3D 앵커를 화면 좌표로 투영해 DOM 라벨 위치를 갱신한다 */
export function LabelProjector() {
  const v = useMemo(() => new Vector3(), [])
  const frameCache = useRef<{ id: string; height: number } | null>(null)

  useFrame(({ camera, size }) => {
    const place = (id: string) => {
      const el = labelElements.get(id)
      if (!el) return
      v.project(camera)
      const visible = v.z < 1 && Math.abs(v.x) < 1.2 && Math.abs(v.y) < 1.2
      el.style.visibility = visible ? 'visible' : 'hidden'
      if (!visible) return
      const x = (v.x * 0.5 + 0.5) * size.width
      const y = (-v.y * 0.5 + 0.5) * size.height
      el.style.transform = `translate(-50%, -50%) translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`
    }

    for (const label of ZONE_LABELS) {
      v.set(...label.position)
      place(label.id)
    }

    const selectedId = useFactoryStore.getState().selectedId
    const loc = selectedId ? locateSelection(selectedId) : null
    if (selectedId && loc) {
      if (frameCache.current?.id !== selectedId) frameCache.current = { id: selectedId, height: selectionFrame(selectedId).h }
      v.set(loc.x, frameCache.current.height + 0.6, loc.z)
      place(SELECTION_LABEL_ID)
    }
  })

  return null
}
