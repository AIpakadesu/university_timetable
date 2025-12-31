import { db, type Preset } from "./db";

function makeId(prefix = "p") {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

export async function ensureDefaultPreset(): Promise<Preset> {
  const existing = await db.presets.toArray();
  if (existing.length > 0) {
    // 가장 최근 updatedAt 프리셋을 active로
    const latest = existing.sort((a, b) => b.updatedAt - a.updatedAt)[0];
    await db.meta.put({ key: "ACTIVE_PRESET_ID", value: latest.id });
    return latest;
  }

  const now = Date.now();
  const preset: Preset = {
    id: makeId("preset"),
    name: "기본 프리셋",
    createdAt: now,
    updatedAt: now,
  };

  await db.presets.add(preset);
  await db.meta.put({ key: "ACTIVE_PRESET_ID", value: preset.id });
  return preset;
}

export async function getActivePresetId(): Promise<string> {
  const meta = await db.meta.get("ACTIVE_PRESET_ID");
  if (!meta?.value) {
    const preset = await ensureDefaultPreset();
    return preset.id;
  }
  return meta.value;
}

export async function setActivePresetId(presetId: string) {
  await db.meta.put({ key: "ACTIVE_PRESET_ID", value: presetId });
}