/**
 * Binary Min-Heap Priority Queue for Dijkstra and A* Path Planning.
 * Tracks peak frontier size for honest algorithm memory comparison.
 */
export class PriorityQueue {
  constructor() {
    this.heap = [];
    this.maxSizeReached = 0;
    this.insertOrder = 0;
  }

  get size() {
    return this.heap.length;
  }

  isEmpty() {
    return this.heap.length === 0;
  }

  enqueue(item, priority, tieBreaker = 0) {
    const node = {
      item,
      priority,
      tieBreaker,
      seq: this.insertOrder++,
    };
    this.heap.push(node);
    this._bubbleUp(this.heap.length - 1);
    if (this.heap.length > this.maxSizeReached) {
      this.maxSizeReached = this.heap.length;
    }
  }

  dequeue() {
    if (this.heap.length === 0) return null;
    const top = this.heap[0];
    const bottom = this.heap.pop();
    if (this.heap.length > 0) {
      this.heap[0] = bottom;
      this._sinkDown(0);
    }
    return top.item;
  }

  peek() {
    return this.heap.length > 0 ? this.heap[0].item : null;
  }

  _compare(a, b) {
    if (Math.abs(a.priority - b.priority) > 1e-9) {
      return a.priority - b.priority;
    }
    if (Math.abs(a.tieBreaker - b.tieBreaker) > 1e-9) {
      return a.tieBreaker - b.tieBreaker;
    }
    return a.seq - b.seq;
  }

  _bubbleUp(index) {
    const element = this.heap[index];
    while (index > 0) {
      const parentIndex = (index - 1) >> 1;
      const parent = this.heap[parentIndex];
      if (this._compare(element, parent) >= 0) break;
      this.heap[parentIndex] = element;
      this.heap[index] = parent;
      index = parentIndex;
    }
  }

  _sinkDown(index) {
    const length = this.heap.length;
    const element = this.heap[index];

    while (true) {
      const leftChildIdx = (index << 1) + 1;
      const rightChildIdx = leftChildIdx + 1;
      let swapIdx = null;

      if (leftChildIdx < length) {
        const leftChild = this.heap[leftChildIdx];
        if (this._compare(leftChild, element) < 0) {
          swapIdx = leftChildIdx;
        }
      }

      if (rightChildIdx < length) {
        const rightChild = this.heap[rightChildIdx];
        const compareTarget = swapIdx === null ? element : this.heap[swapIdx];
        if (this._compare(rightChild, compareTarget) < 0) {
          swapIdx = rightChildIdx;
        }
      }

      if (swapIdx === null) break;
      this.heap[index] = this.heap[swapIdx];
      this.heap[swapIdx] = element;
      index = swapIdx;
    }
  }
}
