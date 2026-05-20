import { describe, expect, it } from 'vitest'
import { File, FileCode, FileImage } from 'lucide-react'
import {
  SiCss,
  SiDocker,
  SiEslint,
  SiGit,
  SiHtml5,
  SiJson,
  SiMarkdown,
  SiNpm,
  SiPnpm,
  SiPrettier,
  SiSass,
  SiTailwindcss,
  SiTypescript,
  SiVite,
  SiYaml,
  SiJavascript,
  SiReact,
  SiRust,
  SiGo,
  SiPython
} from 'react-icons/si'
import { getFileIconSpec, isTestFile } from './file-type-icons'

describe('getFileIconSpec — language extensions', () => {
  it('returns TypeScript mark for .ts', () => {
    const spec = getFileIconSpec('src/foo.ts')
    expect(spec.Icon).toBe(SiTypescript)
    expect(spec.isTest).toBe(false)
  })

  it('returns TypeScript mark for .tsx', () => {
    expect(getFileIconSpec('src/foo.tsx').Icon).toBe(SiTypescript)
  })

  it('returns TypeScript mark for .mts and .cts', () => {
    expect(getFileIconSpec('foo.mts').Icon).toBe(SiTypescript)
    expect(getFileIconSpec('foo.cts').Icon).toBe(SiTypescript)
  })

  it('returns JavaScript mark for .js / .mjs / .cjs', () => {
    expect(getFileIconSpec('foo.js').Icon).toBe(SiJavascript)
    expect(getFileIconSpec('foo.mjs').Icon).toBe(SiJavascript)
    expect(getFileIconSpec('foo.cjs').Icon).toBe(SiJavascript)
  })

  it('returns React mark for .jsx', () => {
    expect(getFileIconSpec('foo.jsx').Icon).toBe(SiReact)
  })

  it('returns Rust mark for .rs', () => {
    expect(getFileIconSpec('foo.rs').Icon).toBe(SiRust)
  })

  it('returns Go mark for .go', () => {
    expect(getFileIconSpec('foo.go').Icon).toBe(SiGo)
  })

  it('returns Python mark for .py', () => {
    expect(getFileIconSpec('foo.py').Icon).toBe(SiPython)
  })
})

describe('getFileIconSpec — non-brand extensions', () => {
  it('uses FileImage for .png', () => {
    expect(getFileIconSpec('foo.png').Icon).toBe(FileImage)
  })

  it('uses SiJson for .json', () => {
    expect(getFileIconSpec('foo.json').Icon).toBe(SiJson)
  })

  it('uses SiMarkdown for .md', () => {
    expect(getFileIconSpec('readme.md').Icon).toBe(SiMarkdown)
  })

  it('uses FileCode for unmapped code extensions (e.g. .hs)', () => {
    expect(getFileIconSpec('foo.hs').Icon).toBe(FileCode)
  })

  it('falls back to File for unknown extensions', () => {
    expect(getFileIconSpec('foo.xyz123').Icon).toBe(File)
  })

  it('falls back to File for files with no extension', () => {
    // .gitignore is in the by-name table, but a random no-extension filename should hit File.
    expect(getFileIconSpec('UNRELATED').Icon).toBe(File)
  })
})

describe('isTestFile', () => {
  it('detects JS/TS .test.* patterns', () => {
    expect(isTestFile('foo.test.ts')).toBe(true)
    expect(isTestFile('foo.test.tsx')).toBe(true)
    expect(isTestFile('foo.test.js')).toBe(true)
    expect(isTestFile('foo.test.jsx')).toBe(true)
    expect(isTestFile('foo.test.mjs')).toBe(true)
    expect(isTestFile('foo.test.cjs')).toBe(true)
    expect(isTestFile('foo.test.mts')).toBe(true)
    expect(isTestFile('foo.test.cts')).toBe(true)
  })

  it('detects JS/TS .spec.* patterns', () => {
    expect(isTestFile('foo.spec.ts')).toBe(true)
    expect(isTestFile('foo.spec.tsx')).toBe(true)
    expect(isTestFile('foo.spec.js')).toBe(true)
  })

  it('detects Go _test.go', () => {
    expect(isTestFile('handler_test.go')).toBe(true)
    expect(isTestFile('handler.go')).toBe(false)
  })

  it('detects Rust _test.rs', () => {
    expect(isTestFile('foo_test.rs')).toBe(true)
    expect(isTestFile('foo.rs')).toBe(false)
  })

  it('detects Python test_*.py and *_test.py', () => {
    expect(isTestFile('test_handler.py')).toBe(true)
    expect(isTestFile('handler_test.py')).toBe(true)
    expect(isTestFile('handler.py')).toBe(false)
  })

  it('detects Ruby _test.rb and _spec.rb', () => {
    expect(isTestFile('handler_test.rb')).toBe(true)
    expect(isTestFile('handler_spec.rb')).toBe(true)
    expect(isTestFile('handler.rb')).toBe(false)
  })

  it('detects Java *Test.java / *Tests.java / *TestCase.java', () => {
    expect(isTestFile('HandlerTest.java')).toBe(true)
    expect(isTestFile('HandlerTests.java')).toBe(true)
    expect(isTestFile('HandlerTestCase.java')).toBe(true)
    expect(isTestFile('Handler.java')).toBe(false)
  })

  it('is case-insensitive on path components', () => {
    expect(isTestFile('Foo.TEST.ts')).toBe(true)
    expect(isTestFile('Handler_TEST.go')).toBe(true)
  })

  it('returns false for non-test names', () => {
    expect(isTestFile('foo.ts')).toBe(false)
    expect(isTestFile('foo.rs')).toBe(false)
    expect(isTestFile('foo.go')).toBe(false)
  })
})

describe('getFileIconSpec — test files', () => {
  it('flags isTest=true for *.test.ts while keeping the TypeScript icon', () => {
    const spec = getFileIconSpec('foo.test.ts')
    expect(spec.Icon).toBe(SiTypescript)
    expect(spec.isTest).toBe(true)
  })

  it('flags isTest=true for *_test.go while keeping the Go icon', () => {
    const spec = getFileIconSpec('handler_test.go')
    expect(spec.Icon).toBe(SiGo)
    expect(spec.isTest).toBe(true)
  })

  it('flags isTest=true for *_test.py while keeping the Python icon', () => {
    const spec = getFileIconSpec('handler_test.py')
    expect(spec.Icon).toBe(SiPython)
    expect(spec.isTest).toBe(true)
  })
})

describe('getFileIconSpec — dev/config files by name', () => {
  it('uses SiGit for .gitignore / .gitattributes', () => {
    expect(getFileIconSpec('.gitignore').Icon).toBe(SiGit)
    expect(getFileIconSpec('.gitattributes').Icon).toBe(SiGit)
  })

  it('uses SiNpm for package.json / package-lock.json', () => {
    expect(getFileIconSpec('package.json').Icon).toBe(SiNpm)
    expect(getFileIconSpec('package-lock.json').Icon).toBe(SiNpm)
  })

  it('uses SiPnpm for pnpm-lock.yaml', () => {
    expect(getFileIconSpec('pnpm-lock.yaml').Icon).toBe(SiPnpm)
  })

  it('uses SiTypescript for tsconfig.json', () => {
    expect(getFileIconSpec('tsconfig.json').Icon).toBe(SiTypescript)
  })

  it('uses SiEslint for .eslintrc.json', () => {
    expect(getFileIconSpec('.eslintrc.json').Icon).toBe(SiEslint)
  })

  it('uses SiPrettier for .prettierrc', () => {
    expect(getFileIconSpec('.prettierrc').Icon).toBe(SiPrettier)
  })

  it('uses SiTailwindcss for tailwind.config.ts', () => {
    expect(getFileIconSpec('tailwind.config.ts').Icon).toBe(SiTailwindcss)
  })

  it('uses SiVite for vite.config.ts', () => {
    expect(getFileIconSpec('vite.config.ts').Icon).toBe(SiVite)
  })

  it('uses SiDocker for Dockerfile and .dockerignore', () => {
    expect(getFileIconSpec('Dockerfile').Icon).toBe(SiDocker)
    expect(getFileIconSpec('.dockerignore').Icon).toBe(SiDocker)
  })

  it('uses SiDocker for dockerfile variants (case insensitive, dockerfile.dev)', () => {
    expect(getFileIconSpec('dockerfile.dev').Icon).toBe(SiDocker)
  })
})

describe('getFileIconSpec — dev/config files by extension', () => {
  it('uses SiMarkdown for .md / .mdx', () => {
    expect(getFileIconSpec('readme.md').Icon).toBe(SiMarkdown)
    expect(getFileIconSpec('guide.mdx').Icon).toBe(SiMarkdown)
  })

  it('uses SiJson for .json / .json5 / .jsonc', () => {
    expect(getFileIconSpec('data.json').Icon).toBe(SiJson)
    expect(getFileIconSpec('foo.json5').Icon).toBe(SiJson)
    expect(getFileIconSpec('foo.jsonc').Icon).toBe(SiJson)
  })

  it('uses SiYaml for .yaml / .yml', () => {
    expect(getFileIconSpec('foo.yaml').Icon).toBe(SiYaml)
    expect(getFileIconSpec('foo.yml').Icon).toBe(SiYaml)
  })

  it('uses SiHtml5 for .html / .htm', () => {
    expect(getFileIconSpec('index.html').Icon).toBe(SiHtml5)
    expect(getFileIconSpec('legacy.htm').Icon).toBe(SiHtml5)
  })

  it('uses SiCss for .css', () => {
    expect(getFileIconSpec('foo.css').Icon).toBe(SiCss)
  })

  it('uses SiSass for .scss / .sass', () => {
    expect(getFileIconSpec('foo.scss').Icon).toBe(SiSass)
    expect(getFileIconSpec('foo.sass').Icon).toBe(SiSass)
  })
})

describe('getFileIconSpec — isBrand flag', () => {
  it('flags isBrand=true for language extension matches', () => {
    expect(getFileIconSpec('foo.ts').isBrand).toBe(true)
    expect(getFileIconSpec('foo.rs').isBrand).toBe(true)
    expect(getFileIconSpec('foo.go').isBrand).toBe(true)
  })

  it('flags isBrand=true for brand-mark name matches', () => {
    expect(getFileIconSpec('.gitignore').isBrand).toBe(true)
    expect(getFileIconSpec('package.json').isBrand).toBe(true)
    expect(getFileIconSpec('tsconfig.json').isBrand).toBe(true)
  })

  it('flags isBrand=true for brand-mark extension matches', () => {
    expect(getFileIconSpec('readme.md').isBrand).toBe(true)
    expect(getFileIconSpec('foo.json').isBrand).toBe(true)
    expect(getFileIconSpec('foo.html').isBrand).toBe(true)
  })

  it('flags isBrand=true for Dockerfile (promoted special-case)', () => {
    expect(getFileIconSpec('Dockerfile').isBrand).toBe(true)
    expect(getFileIconSpec('.dockerignore').isBrand).toBe(true)
  })

  it('flags isBrand=false for Lucide-only matches', () => {
    expect(getFileIconSpec('foo.png').isBrand).toBe(false)
    expect(getFileIconSpec('foo.zip').isBrand).toBe(false)
    expect(getFileIconSpec('LICENSE').isBrand).toBe(false)
    expect(getFileIconSpec('makefile').isBrand).toBe(false)
    expect(getFileIconSpec('.env').isBrand).toBe(false)
  })

  it('flags isBrand=false for unknown extensions falling back to File', () => {
    expect(getFileIconSpec('foo.xyz123').isBrand).toBe(false)
    expect(getFileIconSpec('UNRELATED').isBrand).toBe(false)
  })
})
