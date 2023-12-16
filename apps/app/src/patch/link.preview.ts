import type MediaExtended from "@/mx-main";
import { around } from "monkey-around";
import { Keymap, type PreviewEventHanlder } from "obsidian";
import { MarkdownPreviewRenderer } from "obsidian";
import { LinkEvent } from "./event";
import { getInstancePrototype } from "./utils";

export default function patchPreviewClick(
  plugin: MediaExtended,
  events: Partial<LinkEvent>
) {
  const unloadPatchHook = around(
    MarkdownPreviewRenderer as MDPreviewRendererCtor,
    {
      registerDomEvents: (next) =>
        function (this: MarkdownPreviewRenderer, _el, helper, ...args) {
          patchPreviewEventHanlder(helper, events, plugin);
          unloadPatchHook();
          console.debug("preview click patched");
          return next.call(this, _el, helper, ...args);
        },
    }
  );
  plugin.register(unloadPatchHook);
}

function patchPreviewEventHanlder(
  handler: PreviewEventHanlder,
  { onExternalLinkClick, onInternalLinkClick }: Partial<LinkEvent>,
  plugin: MediaExtended
) {
  plugin.register(
    around(getInstancePrototype(handler), {
      onExternalLinkClick: (next) =>
        function (this: PreviewEventHanlder, evt, target, link, ...args) {
          const fallback = () => next.call(this, evt, target, link, ...args);
          if (!onExternalLinkClick) return fallback();
          evt.preventDefault();
          const paneCreateType = Keymap.isModEvent(evt);
          onExternalLinkClick(link, paneCreateType !== false, fallback);
        },
      onInternalLinkClick: (next) =>
        function (this: PreviewEventHanlder, evt, target, linktext, ...args) {
          const fallback = () =>
            next.call(this, evt, target, linktext, ...args);
          if (!onInternalLinkClick) return fallback();
          evt.preventDefault();
          const paneCreateType = Keymap.isModEvent(evt);
          const sourcePath = this.info?.file?.path ?? "";
          onInternalLinkClick(
            linktext,
            sourcePath,
            paneCreateType !== false,
            fallback
          );
        },
    })
  );
}

import "obsidian";

declare module "obsidian" {
  class PreviewEventHanlder {
    app: App;
    onInternalLinkDrag(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string
    ): void;
    onInternalLinkClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string
    ): void;
    onInternalLinkRightClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      linktext: string
    ): void;
    onExternalLinkClick(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      href: string
    ): void;
    onInternalLinkMouseover(
      evt: MouseEvent,
      delegateTarget: HTMLElement,
      href: string
    ): void;
    onTagClick(evt: MouseEvent, delegateTarget: HTMLElement, tag: string): void;
    info?: MarkdownView | MarkdownFileInfo;
  }
}

type MDPreviewRendererCtor = typeof MarkdownPreviewRenderer & {
  registerDomEvents(
    el: HTMLElement,
    helper: PreviewEventHanlder,
    isBelongTo: (el: HTMLElement) => boolean
  ): void;
  belongsToMe(
    target: HTMLElement,
    el: HTMLElement,
    isBelongTo: (el: HTMLElement) => boolean
  ): boolean;
};