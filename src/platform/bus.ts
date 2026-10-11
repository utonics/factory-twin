import type { PlantEvent } from '../domain/types'

// 설비 ↔ 데이터 플랫폼 사이의 메시지 형식.
// 토픽 체계는 MQTT를 본떠 두었다: f01/{라인|logistics}/{자산}/{telemetry|event}

export interface TelemetryMessage {
  kind: 'telemetry'
  topic: string
  ts: number
  assetId: string
  /** 설비가 가공 중인지(예지 보전 추세 계산 시 가동 구간만 사용) */
  running: boolean
  values: Record<string, number>
}

export interface EventMessage {
  kind: 'event'
  topic: string
  ts: number
  event: PlantEvent
}

export type PlantMessage = TelemetryMessage | EventMessage

type Handler = (message: PlantMessage) => void

/** 프로세스 내부 발행/구독 버스. 실서비스에서는 MQTT·WebSocket 클라이언트로 바꾸면 된다. */
export class MessageBus {
  private readonly handlers = new Set<Handler>()
  published = 0

  publish(message: PlantMessage): void {
    this.published++
    for (const handler of this.handlers) handler(message)
  }

  subscribe(handler: Handler): () => void {
    this.handlers.add(handler)
    return () => this.handlers.delete(handler)
  }
}
