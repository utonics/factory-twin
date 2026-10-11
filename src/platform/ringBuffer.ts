/** 고정 크기 시계열 버퍼. 가득 차면 가장 오래된 값을 덮어쓴다. */
export class RingBuffer {
  private readonly ts: Float64Array
  private readonly vs: Float64Array
  private start = 0
  size = 0

  constructor(readonly capacity: number) {
    this.ts = new Float64Array(capacity)
    this.vs = new Float64Array(capacity)
  }

  push(t: number, v: number): void {
    const index = (this.start + this.size) % this.capacity
    this.ts[index] = t
    this.vs[index] = v
    if (this.size < this.capacity) this.size++
    else this.start = (this.start + 1) % this.capacity
  }

  /** since 이후의 [시각, 값] 목록(오래된 순) */
  toArray(since = -Infinity): [number, number][] {
    const out: [number, number][] = []
    for (let i = 0; i < this.size; i++) {
      const index = (this.start + i) % this.capacity
      if (this.ts[index] >= since) out.push([this.ts[index], this.vs[index]])
    }
    return out
  }
}
