import type * as monacoNs from 'monaco-editor'

export const VESPER_BLUR_MONACO_THEME = 'vesper-blur'

/**
 * Monaco editor theme that mirrors Zed's Vesper Blur — peach (#FFC799) for
 * functions/types/constants, mint (#99FFE4) for strings, transparent editor
 * background so the OS-level vibrancy/acrylic shows through the panel.
 */
export const VESPER_BLUR_MONACO_THEME_DATA: monacoNs.editor.IStandaloneThemeData = {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: 'comment', foreground: '8b8b8b', fontStyle: '' },
    { token: 'comment.doc', foreground: '8b8b8b' },
    { token: 'keyword', foreground: 'A0A0A0' },
    { token: 'keyword.control', foreground: 'A0A0A0' },
    { token: 'operator', foreground: 'A0A0A0' },
    { token: 'string', foreground: '99FFE4' },
    { token: 'string.escape', foreground: 'A0A0A0' },
    { token: 'string.regexp', foreground: 'A0A0A0' },
    { token: 'regexp', foreground: 'A0A0A0' },
    { token: 'number', foreground: 'FFC799' },
    { token: 'constant', foreground: 'FFC799' },
    { token: 'constant.numeric', foreground: 'FFC799' },
    { token: 'constant.language', foreground: 'FFC799' },
    { token: 'type', foreground: 'FFC799' },
    { token: 'type.identifier', foreground: 'FFC799' },
    { token: 'support.type', foreground: 'FFC799' },
    { token: 'support.class', foreground: 'FFC799' },
    { token: 'function', foreground: 'FFC799' },
    { token: 'entity.name.function', foreground: 'FFC799' },
    { token: 'tag', foreground: 'FFC799' },
    { token: 'entity.name.tag', foreground: 'FFC799' },
    { token: 'attribute.name', foreground: 'A0A0A0' },
    { token: 'attribute.value', foreground: '99FFE4' },
    { token: 'variable', foreground: 'FFFFFF' },
    { token: 'variable.parameter', foreground: 'FFFFFF' },
    { token: 'variable.language', foreground: 'A0A0A0' },
    { token: 'variable.predefined', foreground: 'A0A0A0' },
    { token: 'punctuation', foreground: 'A0A0A0' },
    { token: 'delimiter', foreground: 'A0A0A0' },
    { token: 'metatag', foreground: 'A0A0A0' }
  ],
  colors: {
    'editor.background': '#00000000',
    'editor.foreground': '#FFFFFF',
    'editor.lineHighlightBackground': '#FFFFFF10',
    'editor.lineHighlightBorder': '#00000000',
    'editorLineNumber.foreground': '#505050',
    'editorLineNumber.activeForeground': '#FFFFFF',
    'editorIndentGuide.background': '#282828',
    'editorIndentGuide.activeBackground': '#505050',
    'editor.selectionBackground': '#FFFFFF25',
    'editor.selectionHighlightBackground': '#FFFFFF15',
    'editor.wordHighlightBackground': '#FFFFFF15',
    'editor.wordHighlightStrongBackground': '#FFFFFF15',
    'editor.findMatchBackground': '#FFC79950',
    'editor.findMatchHighlightBackground': '#FFFFFF25',
    'editorCursor.foreground': '#FFC799',
    'editorWhitespace.foreground': '#282828',
    'editorGutter.background': '#00000000',
    'editorWidget.background': '#161616',
    'editorWidget.border': '#282828',
    'editorSuggestWidget.background': '#161616',
    'editorSuggestWidget.border': '#282828',
    'editorSuggestWidget.selectedBackground': '#282828',
    'editorHoverWidget.background': '#161616',
    'editorHoverWidget.border': '#282828'
  }
}
