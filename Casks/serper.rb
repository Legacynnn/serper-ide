cask "serper" do
  arch arm: "arm64", intel: "x64"

  version "1.3.24"
  sha256 arm:   "fc707f290ff3b631b7b7947bf339885b61a43d2e89475997c125b61268ed4966",
         intel: "5f677c13a08f7a5740442e29d388285a86488c8c1f7aa5f10a8721a2c6ede8e4"

  url "https://github.com/Legacynnn/serper/releases/download/v#{version}/serper-macos-#{arch}.dmg",
      verified: "github.com/Legacynnn/serper/"
  name "Serper"
  desc "IDE for orchestrating AI coding agents across terminals and worktrees"
  homepage "https://onserper.dev/"

  livecheck do
    url :url
    strategy :github_latest
  end

  # Why: electron-updater (src/main/updater.ts) handles in-place updates by
  # writing a new Serper.app into /Applications. Marking the cask auto_updates
  # tells Homebrew not to compete with the in-app updater — `brew upgrade`
  # becomes a no-op unless the user passes --greedy, and brew's version
  # metadata stays aligned with whatever the app has swapped itself to.
  auto_updates true
  depends_on macos: ">= :big_sur"

  app "Serper.app"

  # Why: Serper writes user data under ~/.serper (worktrees, agent state) and
  # Electron's standard userData directories. Zap removes everything the app
  # creates during normal use so `brew uninstall --zap` is a clean slate.
  zap trash: [
    "~/.serper",
    "~/Library/Application Support/Serper",
    "~/Library/Caches/com.legacynnn.serper",
    "~/Library/Caches/com.legacynnn.serper.ShipIt",
    "~/Library/HTTPStorages/com.legacynnn.serper",
    "~/Library/Preferences/com.legacynnn.serper.plist",
    "~/Library/Saved Application State/com.legacynnn.serper.savedState",
  ]
end
