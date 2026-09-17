export type ResidualMeta = {
  greenhubCcSplit?: string;
};

const RESIDUAL_META_PATTERN = /\n?\[portal_residual_meta:({[\s\S]*?})\]\s*$/;

export function readResidualMeta(notes: string | null | undefined): ResidualMeta & { cleanNotes: string } {
  const source = notes ?? "";
  const match = source.match(RESIDUAL_META_PATTERN);

  if (!match) return { cleanNotes: source };

  try {
    const parsed = JSON.parse(match[1]) as ResidualMeta;
    return {
      cleanNotes: source.replace(RESIDUAL_META_PATTERN, "").trimEnd(),
      greenhubCcSplit:
        parsed.greenhubCcSplit === undefined || parsed.greenhubCcSplit === null
          ? undefined
          : String(parsed.greenhubCcSplit),
    };
  } catch {
    return {
      cleanNotes: source.replace(RESIDUAL_META_PATTERN, "").trimEnd(),
    };
  }
}

export function writeResidualMeta(notes: string | null | undefined, meta: ResidualMeta) {
  const cleanNotes = (notes ?? "").replace(RESIDUAL_META_PATTERN, "").trimEnd();
  const payload: ResidualMeta = {};

  if (meta.greenhubCcSplit !== undefined && String(meta.greenhubCcSplit).trim()) {
    payload.greenhubCcSplit = String(meta.greenhubCcSplit).trim();
  }

  if (!Object.keys(payload).length) return cleanNotes;

  return `${cleanNotes}${cleanNotes ? "\n\n" : ""}[portal_residual_meta:${JSON.stringify(payload)}]`;
}
