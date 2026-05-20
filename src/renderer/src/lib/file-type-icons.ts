/* eslint-disable max-lines -- Why: this module is intentionally a compact filename/extension icon table. */
import {
  Database,
  File,
  FileArchive,
  FileAxis3D,
  FileBox,
  FileBraces,
  FileChartColumn,
  FileCode,
  FileCog,
  FileDiff,
  FileImage,
  FileKey,
  FileLock,
  FileMusic,
  FileSliders,
  FileSpreadsheet,
  FileTerminal,
  FileText,
  FileType,
  FileVideo,
  type LucideIcon
} from 'lucide-react'
import {
  SiAstro,
  SiBabel,
  SiBun,
  SiC,
  SiComposer,
  SiCplusplus,
  SiCss,
  SiDart,
  SiDocker,
  SiDotnet,
  SiEditorconfig,
  SiEslint,
  SiGit,
  SiGo,
  SiHtml5,
  SiJavascript,
  SiJson,
  SiKotlin,
  SiLua,
  SiMarkdown,
  SiNpm,
  SiOpenjdk,
  SiPhp,
  SiPnpm,
  SiPostcss,
  SiPrettier,
  SiPython,
  SiReact,
  SiRuby,
  SiRubygems,
  SiRust,
  SiSass,
  SiSvelte,
  SiSwift,
  SiTailwindcss,
  SiToml,
  SiTypescript,
  SiVite,
  SiVitest,
  SiVuedotjs,
  SiYaml,
  SiYarn
} from 'react-icons/si'
import type { IconType } from 'react-icons'

const FILE_ICON_BY_NAME: Record<string, LucideIcon> = {
  '.npmrc': FileSliders,
  'agents.md': FileText,
  authors: FileText,
  changelog: FileText,
  'changelog.md': FileText,
  'cmakelists.txt': FileCog,
  codeowners: FileKey,
  'components.json': FileSliders,
  contributing: FileText,
  'contributing.md': FileText,
  copying: FileKey,
  license: FileKey,
  makefile: FileTerminal,
  'meson.build': FileCog,
  notice: FileKey,
  'pom.xml': FileBox,
  readme: FileText,
  'readme.md': FileText,
  security: FileLock,
  'security.md': FileLock,
  'settings.gradle': FileCog,
  'settings.gradle.kts': FileCog,
  todo: FileText
}

const FILE_ICON_BY_EXTENSION: Record<string, LucideIcon> = {
  '7z': FileArchive,
  aac: FileMusic,
  adoc: FileText,
  ai: FileImage,
  asc: FileKey,
  astro: FileCode,
  avi: FileVideo,
  avif: FileImage,
  bash: FileTerminal,
  bat: FileTerminal,
  blend: FileAxis3D,
  bmp: FileImage,
  br: FileArchive,
  bz2: FileArchive,
  c: FileCode,
  cc: FileCode,
  cer: FileKey,
  cfg: FileSliders,
  cjs: FileCode,
  clj: FileCode,
  cmd: FileTerminal,
  conf: FileSliders,
  cpp: FileCode,
  crt: FileKey,
  cs: FileCode,
  csv: FileSpreadsheet,
  cts: FileCode,
  cxx: FileCode,
  dart: FileCode,
  db: Database,
  diff: FileDiff,
  dmg: FileArchive,
  doc: FileText,
  docx: FileText,
  duckdb: Database,
  eot: FileType,
  eps: FileImage,
  erl: FileCode,
  ex: FileCode,
  exs: FileCode,
  fbx: FileAxis3D,
  fish: FileTerminal,
  flac: FileMusic,
  fs: FileCode,
  fsx: FileCode,
  gif: FileImage,
  glb: FileAxis3D,
  gltf: FileAxis3D,
  go: FileCode,
  gpg: FileKey,
  gql: FileBraces,
  gradle: FileCog,
  graphql: FileBraces,
  gz: FileArchive,
  h: FileCode,
  hcl: FileSliders,
  heic: FileImage,
  hpp: FileCode,
  hrl: FileCode,
  hs: FileCode,
  ico: FileImage,
  ini: FileSliders,
  ipynb: FileChartColumn,
  iso: FileArchive,
  java: FileCode,
  jpeg: FileImage,
  jpg: FileImage,
  js: FileCode,
  jsx: FileCode,
  key: FileKey,
  kt: FileCode,
  kts: FileCode,
  less: FileType,
  lock: FileLock,
  log: FileText,
  lua: FileCode,
  m4a: FileMusic,
  m4v: FileVideo,
  mjs: FileCode,
  mkv: FileVideo,
  mmd: FileChartColumn,
  mov: FileVideo,
  mp3: FileMusic,
  mp4: FileVideo,
  mpeg: FileVideo,
  mpg: FileVideo,
  mts: FileCode,
  nim: FileCode,
  nu: FileTerminal,
  obj: FileAxis3D,
  ods: FileSpreadsheet,
  ogg: FileMusic,
  opus: FileMusic,
  otf: FileType,
  p12: FileLock,
  patch: FileDiff,
  pdf: FileText,
  pem: FileKey,
  pfx: FileLock,
  php: FileCode,
  pl: FileCode,
  pm: FileCode,
  png: FileImage,
  ppt: FileChartColumn,
  pptx: FileChartColumn,
  prisma: Database,
  properties: FileSliders,
  proto: FileBraces,
  ps1: FileTerminal,
  psd: FileImage,
  pub: FileKey,
  py: FileCode,
  r: FileCode,
  rar: FileArchive,
  rb: FileCode,
  rst: FileText,
  rs: FileCode,
  rtf: FileText,
  scala: FileCode,
  sh: FileTerminal,
  sol: FileCode,
  sqlite: Database,
  sqlite3: Database,
  sql: Database,
  stl: FileAxis3D,
  svelte: FileCode,
  svg: FileImage,
  swift: FileCode,
  tar: FileArchive,
  'tar.bz2': FileArchive,
  'tar.gz': FileArchive,
  'tar.xz': FileArchive,
  tbz2: FileArchive,
  tex: FileText,
  tf: FileSliders,
  tfvars: FileSliders,
  tgz: FileArchive,
  tif: FileImage,
  tiff: FileImage,
  ts: FileCode,
  tsx: FileCode,
  tsv: FileSpreadsheet,
  ttf: FileType,
  txt: FileText,
  txz: FileArchive,
  vb: FileCode,
  vue: FileCode,
  wav: FileMusic,
  webm: FileVideo,
  webp: FileImage,
  woff: FileType,
  woff2: FileType,
  xml: FileCode,
  xls: FileSpreadsheet,
  xlsx: FileSpreadsheet,
  xz: FileArchive,
  zig: FileCode,
  zip: FileArchive,
  zsh: FileTerminal
}

/**
 * Both Lucide and react-icons components accept `className` + render with
 * `currentColor` by default, so callers can style them identically.
 */
export type FileIconComponent = LucideIcon | IconType

export type FileIconSpec = {
  Icon: FileIconComponent
  isTest: boolean
  isBrand: boolean
}

// Brand-mark icons keyed by exact lowercase filename.
// Why: many dev/config files have no meaningful extension — matching on the
// full name is more precise than extension-based heuristics for these cases.
const LANGUAGE_ICON_BY_NAME: Record<string, FileIconComponent> = {
  '.babelrc': SiBabel,
  '.dockerignore': SiDocker,
  '.editorconfig': SiEditorconfig,
  '.eslintrc': SiEslint,
  '.eslintrc.cjs': SiEslint,
  '.eslintrc.js': SiEslint,
  '.eslintrc.json': SiEslint,
  '.eslintrc.yaml': SiEslint,
  '.eslintrc.yml': SiEslint,
  '.gitattributes': SiGit,
  '.gitignore': SiGit,
  '.prettierrc': SiPrettier,
  '.prettierrc.json': SiPrettier,
  '.prettierrc.yaml': SiPrettier,
  '.prettierrc.yml': SiPrettier,
  'bun.lock': SiBun,
  'bun.lockb': SiBun,
  'cargo.lock': SiRust,
  'cargo.toml': SiRust,
  'composer.json': SiComposer,
  'composer.lock': SiComposer,
  gemfile: SiRubygems,
  'go.mod': SiGo,
  'go.sum': SiGo,
  'package-lock.json': SiNpm,
  'package.json': SiNpm,
  pipfile: SiPython,
  'pnpm-lock.yaml': SiPnpm,
  'pnpm-workspace.yaml': SiPnpm,
  'poetry.lock': SiPython,
  'postcss.config.cjs': SiPostcss,
  'postcss.config.js': SiPostcss,
  'postcss.config.mjs': SiPostcss,
  'postcss.config.ts': SiPostcss,
  'pyproject.toml': SiPython,
  'requirements-dev.txt': SiPython,
  'requirements.txt': SiPython,
  'tailwind.config.cjs': SiTailwindcss,
  'tailwind.config.js': SiTailwindcss,
  'tailwind.config.mjs': SiTailwindcss,
  'tailwind.config.ts': SiTailwindcss,
  'tsconfig.json': SiTypescript,
  'vite.config.js': SiVite,
  'vite.config.mjs': SiVite,
  'vite.config.ts': SiVite,
  'vitest.config.js': SiVitest,
  'vitest.config.mjs': SiVitest,
  'vitest.config.ts': SiVitest,
  'yarn.lock': SiYarn
}

const LANGUAGE_ICON_BY_EXTENSION: Record<string, FileIconComponent> = {
  astro: SiAstro,
  c: SiC,
  cc: SiCplusplus,
  cjs: SiJavascript,
  cpp: SiCplusplus,
  cs: SiDotnet,
  css: SiCss,
  cts: SiTypescript,
  cxx: SiCplusplus,
  dart: SiDart,
  go: SiGo,
  h: SiC,
  hpp: SiCplusplus,
  htm: SiHtml5,
  html: SiHtml5,
  hxx: SiCplusplus,
  java: SiOpenjdk,
  js: SiJavascript,
  json: SiJson,
  json5: SiJson,
  jsonc: SiJson,
  jsx: SiReact,
  kt: SiKotlin,
  kts: SiKotlin,
  lua: SiLua,
  md: SiMarkdown,
  mdx: SiMarkdown,
  mjs: SiJavascript,
  mts: SiTypescript,
  php: SiPhp,
  py: SiPython,
  rb: SiRuby,
  rs: SiRust,
  sass: SiSass,
  scss: SiSass,
  svelte: SiSvelte,
  swift: SiSwift,
  toml: SiToml,
  ts: SiTypescript,
  tsx: SiTypescript,
  vue: SiVuedotjs,
  xhtml: SiHtml5,
  yaml: SiYaml,
  yml: SiYaml
}

const COMPOUND_EXTENSIONS = ['tar.bz2', 'tar.gz', 'tar.xz']

function getFilename(filePath: string): string {
  const lastSlash = Math.max(filePath.lastIndexOf('/'), filePath.lastIndexOf('\\'))
  return lastSlash >= 0 ? filePath.slice(lastSlash + 1) : filePath
}

const TEST_PATTERNS: RegExp[] = [
  // JS/TS: foo.test.ts, foo.spec.tsx, etc.
  /\.(test|spec)\.(?:js|jsx|ts|tsx|mjs|cjs|mts|cts)$/i,
  // Go: handler_test.go
  /_test\.go$/i,
  // Rust: foo_test.rs
  /_test\.rs$/i,
  // Python: test_foo.py or foo_test.py
  /(?:^|\/|\\)test_[^/\\]+\.py$/i,
  /_test\.py$/i,
  // Ruby: foo_test.rb or foo_spec.rb
  /_(?:test|spec)\.rb$/i,
  // Java: HandlerTest.java / HandlerTests.java / HandlerTestCase.java
  /(?:Test|Tests|TestCase)\.java$/
]

export function isTestFile(filePath: string): boolean {
  const filename = getFilename(filePath)
  return TEST_PATTERNS.some((pattern) => pattern.test(filename))
}

function getExtension(filename: string): string {
  const lowerName = filename.toLowerCase()
  const compoundExtension = COMPOUND_EXTENSIONS.find((ext) => lowerName.endsWith(`.${ext}`))
  if (compoundExtension) {
    return compoundExtension
  }

  const lastDot = filename.lastIndexOf('.')
  if (lastDot <= 0 || lastDot === filename.length - 1) {
    return ''
  }

  return filename.slice(lastDot + 1).toLowerCase()
}

function resolveIconComponent(filePath: string): { Icon: FileIconComponent; isBrand: boolean } {
  const filename = getFilename(filePath)
  const lowerName = filename.toLowerCase()

  // Brand name table wins over everything for exact filename matches.
  const brandName = LANGUAGE_ICON_BY_NAME[lowerName]
  if (brandName) {
    return { Icon: brandName, isBrand: true }
  }

  if (lowerName === '.env' || lowerName.startsWith('.env.')) {
    return { Icon: FileLock, isBrand: false }
  }

  if (lowerName === 'dockerfile' || lowerName.startsWith('dockerfile.')) {
    return { Icon: SiDocker, isBrand: true }
  }

  if (lowerName === 'makefile' || lowerName.startsWith('makefile.')) {
    return { Icon: FileTerminal, isBrand: false }
  }

  const extension = getExtension(filename)

  // Brand extension table beats the Lucide name and extension tables.
  // Why: a brand mark (e.g. SiMarkdown for .md) is more informative than a
  // generic Lucide icon even when the Lucide name table has a specific entry.
  const brandExt = LANGUAGE_ICON_BY_EXTENSION[extension]
  if (brandExt) {
    return { Icon: brandExt, isBrand: true }
  }

  const exactName = FILE_ICON_BY_NAME[lowerName]
  if (exactName) {
    return { Icon: exactName, isBrand: false }
  }

  const lucideExt = FILE_ICON_BY_EXTENSION[extension]
  if (lucideExt) {
    return { Icon: lucideExt, isBrand: false }
  }
  // Why: filename/extension matching keeps icons deterministic for SSH worktrees
  // where OS-native file associations are not available.
  return { Icon: File, isBrand: false }
}

export function getFileIconSpec(filePath: string): FileIconSpec {
  const { Icon, isBrand } = resolveIconComponent(filePath)
  return {
    Icon,
    isTest: isTestFile(filePath),
    isBrand
  }
}

/**
 * Returns just the icon component for callers that don't need the test-file
 * flag. New code should prefer getFileIconSpec.
 */
export function getFileTypeIcon(filePath: string): FileIconComponent {
  return resolveIconComponent(filePath).Icon
}
