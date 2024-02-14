import type { TFile, Vault } from "obsidian";
import { Platform } from "obsidian";
import { addTempFrag, removeTempFrag } from "@/lib/hash/format";
import type { TempFragment } from "@/lib/hash/temporal-frag";
import { noHashUrl } from "@/lib/url";
import { checkMediaType, type MediaType } from "@/patch/media-type";
import type { MxSettings } from "@/settings/def";
import type { URLResolveResult, URLResolver } from "./base";
import { bilibiliDetecter, bilibiliResolver } from "./bilibili";
import { courseraDetecter, courseraResolver } from "./coursera";
import { genericResolver } from "./generic";
import { MediaHost } from "./supported";
import { viemoDetecter, viemoResolver } from "./viemo";
import { youtubeDetecter, youtubeResolver } from "./youtube";

const allowedProtocols = new Set(["https:", "http:", "file:"]);

export class MediaURL extends URL implements URLResolveResult {
  static create(url: string | URL): MediaURL | null {
    try {
      return new MediaURL(url);
    } catch {
      return null;
    }
  }

  get inferredType(): MediaType | null {
    const ext = this.pathname.split(".").pop();
    if (!ext) return null;
    return checkMediaType(ext);
  }

  get isFileUrl(): boolean {
    return this.protocol === "file:";
  }

  compare(other: MediaURL | null | undefined): boolean {
    return (
      !!other && noHashUrl(this.cleaned).href === noHashUrl(other.cleaned).href
    );
  }

  // get tempFrag(): TempFragment | null {
  //   return parseTempFrag(this.hash);
  // }
  // get isTimestamp(): boolean {
  //   return !!this.tempFrag && isTimestamp(this.tempFrag);
  // }

  // setHash(hash: string | ((hash: string) => string)): MediaURL {
  //   const prevHash = this.hash.replace(/^#+/, "");
  //   const newHash =
  //     typeof hash === "string" ? hash.replace(/^#+/, "") : hash(prevHash);
  //   if (newHash === prevHash) return this;
  //   const newURL = this.clone();
  //   newURL.hash = newHash;
  //   return newURL;
  // }
  setTempFrag(tempFrag: TempFragment | null): MediaURL {
    const newUrl = this.clone();
    const notf = removeTempFrag(this.hash);
    if (!tempFrag) {
      newUrl.hash = notf;
    } else {
      newUrl.hash = addTempFrag(notf, tempFrag);
    }
    return newUrl;
  }

  clone() {
    return new MediaURL(this);
  }

  #resolved: URLResolveResult;

  get source() {
    return this.#resolved.source;
  }
  get cleaned(): URL {
    return this.#resolved.cleaned;
  }
  get id(): string | undefined {
    return this.#resolved.id;
  }
  readonly type: MediaHost;
  constructor(original: string | URL) {
    super(original);
    if (!allowedProtocols.has(this.protocol))
      throw new Error("Unsupported protocol: " + this.protocol);
    this.type =
      detecters.reduce<MediaHost | null>(
        (prev, detect) => prev ?? detect(this),
        null,
      ) ?? MediaHost.Generic;
    this.#resolved = Resolver[this.type](this);
  }
}

const detecters = [
  bilibiliDetecter,
  youtubeDetecter,
  viemoDetecter,
  courseraDetecter,
];
// eslint-disable-next-line @typescript-eslint/naming-convention
const Resolver: Record<MediaHost, URLResolver> = {
  [MediaHost.Bilibili]: bilibiliResolver,
  [MediaHost.YouTube]: youtubeResolver,
  [MediaHost.Vimeo]: viemoResolver,
  [MediaHost.Coursera]: courseraResolver,
  [MediaHost.Generic]: genericResolver,
};

export function resolveUrl(url: MediaURL): URLResolveResult {
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    return genericResolver(url);
  }
  for (const resolve of [
    bilibiliResolver,
    youtubeResolver,
    viemoResolver,
    courseraResolver,
  ]) {
    const result = resolve(url);
    if (result) return result;
  }
  return genericResolver(url);
}

export function resolveMxProtocol(
  src: URL | null,
  { getUrlMapping }: MxSettings,
): URL | null {
  if (!src) return null;
  if (src.protocol !== "mx:") return src;

  // custom protocol take // as part of the pathname
  const [, , mxProtocol] = src.pathname.split("/");
  const replace = getUrlMapping(mxProtocol);
  if (!replace) return src;
  return MediaURL.create(
    src.href.replace(`mx://${mxProtocol}/`, replace.replace(/\/*$/, "/")),
  );
}

export function fromFile(file: TFile, vault: Vault): MediaURL {
  if (checkMediaType(file.extension) === null) {
    throw new Error(`Unknown media type ${file.extension}`);
  }
  const resouceUrl = vault.getResourcePath(file);
  return new MediaURL(
    "file:///" + resouceUrl.substring(Platform.resourcePathPrefix.length),
  );
}