/** 与后端 `lkmlAnchorFragmentId` 一致，用于补丁卡片 id 与摘要锚点 */
export function lkmlAnchorId(articleId: string): string {
  return `lkml-${articleId.replace(/[^a-zA-Z0-9_-]/g, '_')}`
}
