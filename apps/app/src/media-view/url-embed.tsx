import { MarkdownRenderChild } from "obsidian";
import ReactDOM from "react-dom/client";
import { MediaViewContext, createMediaViewStore } from "@/components/context";
import { Player } from "@/components/player";
import type { MediaViewType } from "@/media-note/note-index";
import type MxPlugin from "@/mx-main";
import { type PlayerComponent } from "./base";

export class MediaRenderChild
  extends MarkdownRenderChild
  implements PlayerComponent
{
  store;
  root: ReactDOM.Root | null = null;

  constructor(public containerEl: HTMLElement, public plugin: MxPlugin) {
    super(containerEl);
    this.store = createMediaViewStore();
    containerEl.addClasses(["mx", "custom", "mx-media-embed"]);
  }

  update({
    hash,
    source,
  }: Partial<{
    hash: string;
    source: { src: string; original: string; viewType: MediaViewType };
  }>): void {
    const hashFacet = hash ? { hash } : {};
    const srcFacet = source ? { source } : {};
    this.store.setState({ ...hashFacet, ...srcFacet });
  }

  onload(): void {
    this.root?.unmount();
    this.root = ReactDOM.createRoot(this.containerEl);
    this.root.render(
      <MediaViewContext.Provider
        value={{
          plugin: this.plugin,
          store: this.store,
          embed: true,
        }}
      >
        <Player />
      </MediaViewContext.Provider>,
    );
  }

  onunload() {
    // unmount before detach from DOM
    this.root?.unmount();
    this.root = null;
    super.onunload();
  }
}