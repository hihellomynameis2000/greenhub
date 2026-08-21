export type ResidualPlatformType = "cc" | "pob";

type PlatformLike = {
  name?: string | null;
  residualType?: string | null;
  residual_type?: string | null;
};

const pobPlatformMatchers = [
  "diamond payments",
  "ellacash",
  "ella cash",
  "greenway pob",
  "greenway pps",
  "mtxe",
  "tfi",
  "paynex",
];

export function normalizeResidualPlatformType(value: unknown): ResidualPlatformType {
  return String(value ?? "").toLowerCase() === "pob" ? "pob" : "cc";
}

export function normalizedPlatformName(value: string | null | undefined) {
  return String(value ?? "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

export function inferredResidualPlatformType(value: PlatformLike | string | null | undefined): ResidualPlatformType {
  if (typeof value === "object" && value) {
    if (value.residual_type || value.residualType) {
      return normalizeResidualPlatformType(value.residual_type ?? value.residualType);
    }
    value = value.name;
  }

  const normalized = normalizedPlatformName(value);
  return pobPlatformMatchers.some((matcher) => normalized.includes(matcher)) ? "pob" : "cc";
}

export function residualTypeLabel(type: ResidualPlatformType) {
  return type === "pob" ? "POB" : "CC";
}
