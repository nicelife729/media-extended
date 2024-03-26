import { Notice } from "obsidian";
import type { App, Editor } from "obsidian";
import { isFileMediaInfo } from "@/info/media-info";
import type { MediaInfo } from "@/info/media-info";
import { checkMediaType } from "@/info/media-type";
import { insertBeforeCursor, insertToCursor } from "@/lib/cursor";
import { formatDuration, toTempFragString } from "@/lib/hash/format";
import type { TempFragment } from "@/lib/hash/temporal-frag";
import type { PlayerComponent } from "@/media-view/base";
import type { MxSettings } from "@/settings/def";
import type { MediaSourceFieldType } from "../note-index/def";
import { mediaTitle } from "../title";

export function insertTimestamp(
  { timestamp, screenshot }: { timestamp: string; screenshot?: string },
  {
    template,
    editor,
    insertBefore,
  }: { template: string; editor: Editor; insertBefore?: boolean },
) {
  console.debug("insert timestamp", { timestamp, screenshot, template });
  let toInsert = template.replace("{{TIMESTAMP}}", timestamp);
  if (screenshot) {
    toInsert = toInsert.replace("{{SCREENSHOT}}", screenshot);
  }
  console.debug("content to insert", toInsert);

  try {
    console.debug(
      `inserting timestamp ${insertBefore ? "before" : "after"} cursor`,
    );
    if (insertBefore) {
      insertBeforeCursor(toInsert, editor);
    } else {
      insertToCursor(toInsert, editor);
    }
  } catch (error) {
    new Notice("Failed to insert timestamp, see console for details");
    console.error("Failed to insert timestamp", error);
  }
}
export function openOrCreateMediaNote(
  mediaInfo: MediaInfo,
  playerComponent: PlayerComponent,
) {
  const { metadataCache } = playerComponent.plugin.app;
  const player = playerComponent.store.getState().player;
  if (!player) {
    throw new Error("Player not initialized");
  }
  const title = mediaTitle(mediaInfo, { state: player.state });
  if (isFileMediaInfo(mediaInfo)) {
    const mediaType = checkMediaType(mediaInfo.file.extension)!;
    const file = mediaInfo.file;
    return playerComponent.plugin.leafOpener.openNote(mediaInfo, {
      title,
      fm: (newNotePath) => ({
        [mediaType]: `[[${metadataCache.fileToLinktext(file, newNotePath)}]]`,
      }),
      sourcePath: file.path,
    });
  } else {
    const type: MediaSourceFieldType = mediaInfo.inferredType ?? "media";
    return playerComponent.plugin.leafOpener.openNote(mediaInfo, {
      title,
      fm: () => ({ [type]: mediaInfo.jsonState.source }),
    });
  }
}

/**
 * @param time in seconds
 */
export function timestampGenerator(
  time: number,
  mediaInfo: MediaInfo,
  {
    app: { fileManager },
    settings: { timestampOffset },
    duration = +Infinity,
  }: { app: App; settings: MxSettings; duration?: number },
): (newNotePath: string) => string {
  time += timestampOffset;
  if (time < 0) time = 0;
  else if (time > duration) time = duration;

  const timeInDuration = formatDuration(time);
  const frag =
    time > 0 ? ({ start: time, end: -1 } satisfies TempFragment) : undefined;
  const hash = frag ? `#${toTempFragString(frag)!}` : "";

  if (isFileMediaInfo(mediaInfo)) {
    const { file } = mediaInfo;
    return (newNotePath: string) =>
      fileManager
        .generateMarkdownLink(file, newNotePath, hash, timeInDuration)
        .replace(/^!/, "").replace("[]", "[" + timeInDuration + "]");
  } else {
    const sourceUrl = mediaInfo.print(frag);
    return () => `[${timeInDuration}](${sourceUrl}${hash})`;
  }
}
