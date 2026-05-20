import type { TabGroupLayoutNode, TabGroupSplitDirection } from '../../../../shared/types'

export type SpatialDirection = 'left' | 'right' | 'up' | 'down'

type ParentChainEntry = {
  parent: Extract<TabGroupLayoutNode, { type: 'split' }>
  branch: 'first' | 'second'
}

/**
 * Returns group IDs in document order (depth-first, first-before-second).
 * This is the order users see when reading top-to-bottom, left-to-right.
 */
export function flattenLayoutGroupIds(node: TabGroupLayoutNode): string[] {
  if (node.type === 'leaf') {
    return [node.groupId]
  }
  return [...flattenLayoutGroupIds(node.first), ...flattenLayoutGroupIds(node.second)]
}

/**
 * Returns the path of split ancestors from root down to the leaf with groupId.
 * Each entry records the split node and which branch ('first' / 'second') the
 * descendant lies in. Returns null if the group isn't in the tree.
 */
function findParentChain(
  node: TabGroupLayoutNode,
  groupId: string,
  chain: ParentChainEntry[] = []
): ParentChainEntry[] | null {
  if (node.type === 'leaf') {
    return node.groupId === groupId ? chain : null
  }
  const firstChain = findParentChain(node.first, groupId, [
    ...chain,
    { parent: node, branch: 'first' }
  ])
  if (firstChain) {
    return firstChain
  }
  return findParentChain(node.second, groupId, [...chain, { parent: node, branch: 'second' }])
}

/** Direction the user wants to move → split direction we need an ancestor in. */
function requiredSplitDirection(direction: SpatialDirection): TabGroupSplitDirection {
  return direction === 'left' || direction === 'right' ? 'horizontal' : 'vertical'
}

/**
 * For a given spatial direction, the branch the leaf must lie in so its
 * sibling is the target. E.g. to move 'left', the leaf must be the `second`
 * (right) child of a horizontal split — then its sibling on the left is `first`.
 */
function expectedBranchForDirection(direction: SpatialDirection): 'first' | 'second' {
  return direction === 'left' || direction === 'up' ? 'second' : 'first'
}

/**
 * When descending into the sibling subtree, pick the leaf that's spatially
 * closest to the moving direction. Moving 'right' → take the leftmost leaf of
 * the right sibling. Moving 'down' → take the topmost leaf of the bottom
 * sibling. For splits in the perpendicular direction (e.g. a vertical split
 * inside a horizontal one), preserve the first child by convention so the
 * focus lands on the top/left subpane.
 */
function descendToClosestLeaf(node: TabGroupLayoutNode, direction: SpatialDirection): string {
  let current = node
  while (current.type === 'split') {
    const matchesAxis = current.direction === requiredSplitDirection(direction)
    if (matchesAxis) {
      current = direction === 'left' || direction === 'up' ? current.second : current.first
    } else {
      current = current.first
    }
  }
  return current.groupId
}

/**
 * Finds the group ID of the panel adjacent to `groupId` in the given spatial
 * direction within the split tree. Returns null when nothing exists in that
 * direction (e.g. the group is already at the edge of the layout).
 */
export function findSpatialNeighbor(
  layout: TabGroupLayoutNode,
  groupId: string,
  direction: SpatialDirection
): string | null {
  const chain = findParentChain(layout, groupId)
  if (!chain || chain.length === 0) {
    return null
  }

  const needed = requiredSplitDirection(direction)
  const expectedBranch = expectedBranchForDirection(direction)

  for (let i = chain.length - 1; i >= 0; i--) {
    const { parent, branch } = chain[i]
    if (parent.direction === needed && branch === expectedBranch) {
      const siblingBranch = branch === 'first' ? 'second' : 'first'
      return descendToClosestLeaf(parent[siblingBranch], direction)
    }
  }
  return null
}

/**
 * Returns the next or previous group ID in document order, cycling at the
 * ends. Returns null if `groupId` isn't in the tree or the tree has a single
 * leaf.
 */
export function findGroupByOffset(
  layout: TabGroupLayoutNode,
  groupId: string,
  offset: 1 | -1
): string | null {
  const ids = flattenLayoutGroupIds(layout)
  if (ids.length <= 1) {
    return null
  }
  const index = ids.indexOf(groupId)
  if (index === -1) {
    return null
  }
  const next = (index + offset + ids.length) % ids.length
  return ids[next]
}
