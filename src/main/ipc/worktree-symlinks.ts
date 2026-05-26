import { symlink, mkdir, stat, lstat, unlink, readdir } from 'fs/promises'
import { dirname, isAbsolute, resolve } from 'path'

/** Create filesystem symlinks from the primary checkout into a freshly-created
 *  worktree for each configured path. Failures on individual paths are logged
 *  and skipped so a missing/stale entry never blocks worktree creation.
 *
 *  Each entry is interpreted relative to `primaryPath` and placed at the same
 *  relative location inside `worktreePath`. Nested paths (e.g.
 *  `apps/web/.env`) are supported — parent directories are created lazily. */
export async function createWorktreeSymlinks(
  primaryPath: string,
  worktreePath: string,
  paths: readonly string[]
): Promise<void> {
  for (const rawPath of paths) {
    // Why: strip leading separators (both `/` and `\`) before the guard so
    // Windows-style input like `\foo` is normalized the same way POSIX `/foo`
    // is, and the traversal check below sees the already-relative form.
    const rel = rawPath.trim().replace(/^[\\/]+/, '')
    // Why: split on both separators so a Windows-authored `..\escape` is
    // rejected the same way POSIX `../escape` is. `path.isAbsolute` catches
    // drive-letter absolutes (`C:\...`); the split catches relative
    // backslash traversal that `.split('/')` would otherwise miss.
    if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
      // Users can only configure paths relative to the repo root; absolute
      // paths and `..` traversal are not supported.
      console.warn(`[worktree-symlinks] Skipping unsafe path "${rawPath}"`)
      continue
    }

    const source = resolve(primaryPath, rel)
    const target = resolve(worktreePath, rel)

    let sourceIsDirectory = false
    try {
      const s = await stat(source)
      sourceIsDirectory = s.isDirectory()
    } catch {
      // Source doesn't exist in primary checkout — nothing to link to. This is
      // a common case for fresh clones where `node_modules` hasn't been
      // installed yet; silently skip rather than leaving a dangling symlink.
      continue
    }

    try {
      // Why: if a file/dir already exists at the target location (e.g.
      // git-tracked sibling with the same name), leave it alone rather than
      // clobber something the user didn't mean to replace. Use `lstat` so a
      // pre-existing symlink (including a broken one whose source has moved)
      // is detected and skipped, rather than falling through to `symlink()`
      // and failing with EEXIST.
      const targetStat = await lstat(target)

      // Why: a git-tracked directory may contain gitignored children (e.g.
      // `data/` is tracked but `data/cache/` is in .gitignore). `git worktree
      // add` creates the tracked directory but not its ignored contents. When
      // the target is a real directory (not a symlink), drill into it and
      // symlink individual children that exist in primary but not the worktree.
      if (sourceIsDirectory && targetStat.isDirectory() && !targetStat.isSymbolicLink()) {
        await symlinkMissingChildren(source, target)
      }
      continue
    } catch {
      // Target does not exist — proceed with symlink creation.
    }

    try {
      await mkdir(dirname(target), { recursive: true })
      // Why: Windows requires an explicit `type` ('dir' vs 'file' vs
      // 'junction') for `fs.symlink`. On POSIX the argument is ignored, so
      // passing it unconditionally is safe and removes a Windows-only
      // failure mode when Node can't auto-detect from the source.
      await symlink(source, target, sourceIsDirectory ? 'dir' : 'file')
    } catch (error) {
      console.error(
        `[worktree-symlinks] Failed to symlink "${rel}" (${source} -> ${target}):`,
        error
      )
    }
  }
}

/** Symlink direct children of `sourceDir` that are missing from `targetDir`. */
async function symlinkMissingChildren(sourceDir: string, targetDir: string): Promise<void> {
  let children: string[]
  try {
    children = await readdir(sourceDir)
  } catch {
    return
  }
  for (const child of children) {
    const childSource = resolve(sourceDir, child)
    const childTarget = resolve(targetDir, child)
    try {
      await lstat(childTarget)
      continue
    } catch {
      // Child doesn't exist in worktree — symlink it.
    }
    try {
      const s = await stat(childSource)
      await symlink(childSource, childTarget, s.isDirectory() ? 'dir' : 'file')
    } catch (error) {
      console.error(
        `[worktree-symlinks] Failed to symlink child "${child}" (${childSource} -> ${childTarget}):`,
        error
      )
    }
  }
}

/** Remove symlinks that are direct children of `dir`. */
async function unlinkChildSymlinks(dir: string): Promise<void> {
  let children: string[]
  try {
    children = await readdir(dir)
  } catch {
    return
  }
  for (const child of children) {
    const childPath = resolve(dir, child)
    try {
      const s = await lstat(childPath)
      if (s.isSymbolicLink()) {
        await unlink(childPath)
      }
    } catch {
      // Missing or inaccessible — skip.
    }
  }
}

/** Remove previously-created symlinks from a worktree before deletion.
 *
 *  Why: `git worktree remove` refuses to delete a worktree that has modified
 *  or untracked files. A symlink pointing at the primary's `node_modules`
 *  looks "untracked" to git, so users would hit "It has changed files. Use
 *  Force Delete" on every deletion once they've configured this feature.
 *  Unlink the known symlinks up front so the non-force path keeps working.
 *
 *  Safety: only removes entries that are actually symbolic links. A regular
 *  file or directory at the same path is left alone — we never want to clobber
 *  something the user created that happens to share a name with a configured
 *  entry. Missing entries (ENOENT) are silently ignored. */
export async function removeWorktreeSymlinks(
  worktreePath: string,
  paths: readonly string[]
): Promise<void> {
  for (const rawPath of paths) {
    const rel = rawPath.trim().replace(/^[\\/]+/, '')
    if (!rel || isAbsolute(rel) || rel.split(/[\\/]/).includes('..')) {
      continue
    }
    const target = resolve(worktreePath, rel)
    try {
      const s = await lstat(target)
      if (s.isSymbolicLink()) {
        await unlink(target)
      } else if (s.isDirectory()) {
        // Why: a git-tracked directory won't be a symlink itself, but we may
        // have created child-level symlinks inside it for gitignored contents.
        await unlinkChildSymlinks(target)
      }
    } catch {
      continue
    }
  }
}
