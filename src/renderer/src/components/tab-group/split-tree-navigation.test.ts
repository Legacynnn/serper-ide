import { describe, it, expect } from 'vitest'
import type { TabGroupLayoutNode } from '../../../../shared/types'
import {
  findGroupByOffset,
  findSpatialNeighbor,
  flattenLayoutGroupIds
} from './split-tree-navigation'

const leaf = (id: string): TabGroupLayoutNode => ({ type: 'leaf', groupId: id })
const hsplit = (
  a: TabGroupLayoutNode,
  b: TabGroupLayoutNode,
  ratio?: number
): TabGroupLayoutNode => ({ type: 'split', direction: 'horizontal', first: a, second: b, ratio })
const vsplit = (
  a: TabGroupLayoutNode,
  b: TabGroupLayoutNode,
  ratio?: number
): TabGroupLayoutNode => ({ type: 'split', direction: 'vertical', first: a, second: b, ratio })

describe('flattenLayoutGroupIds', () => {
  it('returns single id for a leaf', () => {
    expect(flattenLayoutGroupIds(leaf('a'))).toEqual(['a'])
  })

  it('walks splits in first-then-second (document) order', () => {
    // Layout:  [ a | b ]  →  ['a', 'b']
    expect(flattenLayoutGroupIds(hsplit(leaf('a'), leaf('b')))).toEqual(['a', 'b'])
  })

  it('flattens nested splits correctly', () => {
    // Layout:  [ a | [ b / c ] ]  →  ['a', 'b', 'c']
    expect(flattenLayoutGroupIds(hsplit(leaf('a'), vsplit(leaf('b'), leaf('c'))))).toEqual([
      'a',
      'b',
      'c'
    ])
  })
})

describe('findGroupByOffset', () => {
  it('returns null for a single-leaf layout', () => {
    expect(findGroupByOffset(leaf('a'), 'a', 1)).toBeNull()
    expect(findGroupByOffset(leaf('a'), 'a', -1)).toBeNull()
  })

  it('returns null when group is not in tree', () => {
    expect(findGroupByOffset(hsplit(leaf('a'), leaf('b')), 'z', 1)).toBeNull()
  })

  it('cycles forward and wraps at the end', () => {
    const layout = hsplit(leaf('a'), vsplit(leaf('b'), leaf('c')))
    expect(findGroupByOffset(layout, 'a', 1)).toBe('b')
    expect(findGroupByOffset(layout, 'b', 1)).toBe('c')
    expect(findGroupByOffset(layout, 'c', 1)).toBe('a')
  })

  it('cycles backward and wraps at the start', () => {
    const layout = hsplit(leaf('a'), vsplit(leaf('b'), leaf('c')))
    expect(findGroupByOffset(layout, 'a', -1)).toBe('c')
    expect(findGroupByOffset(layout, 'c', -1)).toBe('b')
    expect(findGroupByOffset(layout, 'b', -1)).toBe('a')
  })
})

describe('findSpatialNeighbor', () => {
  it('returns null for a single-leaf layout', () => {
    const layout = leaf('a')
    expect(findSpatialNeighbor(layout, 'a', 'left')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'up')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'down')).toBeNull()
  })

  it('returns null when group is not in tree', () => {
    expect(findSpatialNeighbor(hsplit(leaf('a'), leaf('b')), 'z', 'left')).toBeNull()
  })

  it('navigates a single horizontal split', () => {
    // [ a | b ]
    const layout = hsplit(leaf('a'), leaf('b'))
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBe('b')
    expect(findSpatialNeighbor(layout, 'b', 'left')).toBe('a')
    // No vertical neighbors
    expect(findSpatialNeighbor(layout, 'a', 'up')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'down')).toBeNull()
    // No further horizontal neighbors at the edges
    expect(findSpatialNeighbor(layout, 'a', 'left')).toBeNull()
    expect(findSpatialNeighbor(layout, 'b', 'right')).toBeNull()
  })

  it('navigates a single vertical split', () => {
    // [ a / b ]   (top / bottom)
    const layout = vsplit(leaf('a'), leaf('b'))
    expect(findSpatialNeighbor(layout, 'a', 'down')).toBe('b')
    expect(findSpatialNeighbor(layout, 'b', 'up')).toBe('a')
    expect(findSpatialNeighbor(layout, 'a', 'left')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBeNull()
    expect(findSpatialNeighbor(layout, 'a', 'up')).toBeNull()
    expect(findSpatialNeighbor(layout, 'b', 'down')).toBeNull()
  })

  it('walks past a perpendicular split to find the horizontal neighbor', () => {
    // [ a | [ b / c ] ]   moving right from a lands on b (top of right column)
    const layout = hsplit(leaf('a'), vsplit(leaf('b'), leaf('c')))
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBe('b')
    // Moving left from either b or c lands back on a
    expect(findSpatialNeighbor(layout, 'b', 'left')).toBe('a')
    expect(findSpatialNeighbor(layout, 'c', 'left')).toBe('a')
    // Vertical motion still works inside the right column
    expect(findSpatialNeighbor(layout, 'b', 'down')).toBe('c')
    expect(findSpatialNeighbor(layout, 'c', 'up')).toBe('b')
    // No down from c, no up from b
    expect(findSpatialNeighbor(layout, 'b', 'up')).toBeNull()
    expect(findSpatialNeighbor(layout, 'c', 'down')).toBeNull()
  })

  it('descends into the closest leaf when sibling subtree has the matching split', () => {
    // [ [ a | b ] | c ]   moving right from a lands on b, not c.
    // From b, moving right lands on c.
    const layout = hsplit(hsplit(leaf('a'), leaf('b')), leaf('c'))
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBe('b')
    expect(findSpatialNeighbor(layout, 'b', 'right')).toBe('c')
    expect(findSpatialNeighbor(layout, 'c', 'left')).toBe('b')
    expect(findSpatialNeighbor(layout, 'b', 'left')).toBe('a')
  })

  it('handles deeply nested mixed splits', () => {
    // Layout:
    //   left column:   a (top)
    //                  b (bottom)
    //   right column:  c (top)
    //                  d (bottom-left) | e (bottom-right)
    //
    // = hsplit(
    //     vsplit(a, b),
    //     vsplit(c, hsplit(d, e))
    //   )
    const layout = hsplit(
      vsplit(leaf('a'), leaf('b')),
      vsplit(leaf('c'), hsplit(leaf('d'), leaf('e')))
    )
    // Moving right from a: lands on top-left of right column = c
    expect(findSpatialNeighbor(layout, 'a', 'right')).toBe('c')
    // Moving right from b: should also land on c (top of right column —
    // perpendicular vertical split descends into `first`)
    expect(findSpatialNeighbor(layout, 'b', 'right')).toBe('c')
    // Moving left from c: descends into left column. Left column is vertical
    // (a top / b bottom). For a perpendicular split, descendToClosestLeaf
    // picks `first` by convention → a.
    expect(findSpatialNeighbor(layout, 'c', 'left')).toBe('a')
    // Moving down from c: lands on d (top-left of the bottom-right hsplit)
    expect(findSpatialNeighbor(layout, 'c', 'down')).toBe('d')
    // Moving right from d: e
    expect(findSpatialNeighbor(layout, 'd', 'right')).toBe('e')
    // Moving up from d: lands on c (parent vsplit, second branch = bottom row)
    expect(findSpatialNeighbor(layout, 'd', 'up')).toBe('c')
    // Moving up from e: also c
    expect(findSpatialNeighbor(layout, 'e', 'up')).toBe('c')
    // Moving left from d: walks up past the inner hsplit (d is `first`, wrong
    // branch for 'left'), then past the vsplit (different axis), then up to
    // root horizontal where this subtree is `second` → descends into left
    // column = a (vsplit, first child).
    expect(findSpatialNeighbor(layout, 'd', 'left')).toBe('a')
  })
})
