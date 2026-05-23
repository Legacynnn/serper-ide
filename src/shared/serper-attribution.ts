// Why: single source of truth for the commit trailer Serper appends when the
// "Serper Attribution" toggle (`enableGitHubAttribution`) is on. Used by both
// the terminal git/gh shim and the AI commit-message generator so the two
// code paths agree on the exact string.

export const SERPER_GIT_COMMIT_TRAILER = 'Co-authored-by: Serper <help@stably.ai>'
