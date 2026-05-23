export const SERPER_EDITOR_SAVE_DIRTY_FILES_EVENT = 'serper:editor-save-dirty-files'

export type EditorSaveDirtyFilesDetail = {
  claim: () => void
  resolve: () => void
  reject: (message: string) => void
}
