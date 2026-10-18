import type { Ref } from 'react'

/** Shared reading canvas; layout and motion are owned by its host. */
export function PromptSurface({ blocks, trackRef, mirrored = false, emptyText = 'Waiting for the script…' }: {
  blocks: readonly { id: string; text: string }[]; trackRef: Ref<HTMLDivElement>; mirrored?: boolean; emptyText?: string
}) {
  return <>
    <div className="reading-window">
      <div className="script-track" ref={trackRef}>
        <div className={mirrored ? 'script-content is-mirrored' : 'script-content'}>
          {blocks.length ? blocks.map((block) => <p key={block.id} data-block-id={block.id}>{block.text}</p>)
            : emptyText && <p className="waiting-copy">{emptyText}</p>}
        </div>
      </div>
    </div>
    <div className="focus-band" aria-hidden="true"><span /></div>
    <div className="display-vignette" aria-hidden="true" />
  </>
}
