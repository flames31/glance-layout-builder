/**
 * dnd-kit identifies droppables by string. A widget list is uniquely addressed
 * by its page, column and (for container widgets) parent widget.
 */
export type ListId = { pageId: string; columnId: string; parentId: string | null };

export function encodeListId({ pageId, columnId, parentId }: ListId): string {
  return `list|${pageId}|${columnId}|${parentId ?? ''}`;
}

export function decodeListId(id: string): ListId | null {
  const parts = id.split('|');
  if (parts[0] !== 'list' || parts.length !== 4) return null;
  return { pageId: parts[1]!, columnId: parts[2]!, parentId: parts[3] === '' ? null : parts[3]! };
}

/** Palette entries drag as "new widget of type X". */
export function encodeNewId(widgetType: string): string {
  return `new|${widgetType}`;
}

export function decodeNewId(id: string): string | null {
  return id.startsWith('new|') ? id.slice(4) : null;
}
