import React, { useState } from 'react';
import { RefreshCw, Download, X } from 'lucide-react';
import { useAppUpdate, getDesktopApi } from '../hooks/useAppUpdate';

// Quiet bottom-right notice: "restart to finish" once an update is downloaded,
// or a download link on builds that cannot install themselves (the deb).
const UpdateBanner = () => {
  const { phase, version, canInstall } = useAppUpdate();
  const [hidden, setHidden] = useState(false);
  const api = getDesktopApi();

  if (!api || hidden) return null;

  const ready = phase === 'ready';
  const downloadable = phase === 'available' && !canInstall;
  if (!ready && !downloadable) return null;

  const title = ready ? 'Update ready' : 'Update available';
  const body = version
    ? ready
      ? `Bickle ${version} has been downloaded. Restart to finish installing.`
      : `Bickle ${version} is ready to download.`
    : ready
      ? 'A new version has been downloaded. Restart to finish installing.'
      : 'A new version of Bickle is ready to download.';

  return (
    <div
      className="fixed bottom-4 right-4 z-[90] w-80 max-w-[calc(100vw-2rem)] rounded-2xl border border-border bg-card px-4 py-3 shadow-xl shadow-black/15"
      style={{ animation: 'updateBannerIn 0.2s ease-out' }}
      role="status"
    >
      <style>{`@keyframes updateBannerIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: none; } }`}</style>
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary/15 text-primary">
          {ready ? <RefreshCw className="h-4 w-4" /> : <Download className="h-4 w-4" />}
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-foreground">{title}</p>
          <p className="mt-0.5 text-xs leading-relaxed text-muted-foreground">{body}</p>
          <div className="mt-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => {
                if (ready) api.installUpdate();
                else api.openReleases();
              }}
              className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition hover:bg-primary/90"
            >
              {ready ? 'Restart now' : 'Download'}
            </button>
            <button
              type="button"
              onClick={() => setHidden(true)}
              className="rounded-lg px-3 py-1.5 text-xs font-medium text-muted-foreground transition hover:bg-accent hover:text-foreground"
            >
              {ready ? 'Later' : 'Dismiss'}
            </button>
          </div>
        </div>
        <button
          type="button"
          aria-label="Dismiss update notice"
          onClick={() => setHidden(true)}
          className="shrink-0 rounded p-1 text-muted-foreground transition hover:text-foreground"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>
    </div>
  );
};

export default UpdateBanner;
