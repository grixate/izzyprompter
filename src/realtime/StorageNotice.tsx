export function StorageNotice({ onRetry, onDownload }: { onRetry: () => void; onDownload: () => void }) {
  return <aside className="storage-notice" aria-label="Local save warning">
    <p role="alert">LOCAL SAVE UNAVAILABLE · Keep this tab open. Download your script before refreshing or closing.</p>
    <div><button onClick={onRetry}>RETRY LOCAL SAVE</button><button onClick={onDownload}>DOWNLOAD SCRIPT</button></div>
  </aside>
}
