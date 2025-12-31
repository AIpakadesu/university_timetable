import { useEffect, useRef } from "react";
import { useAppStore } from "./store";

/**
 * 입력/해결안(solutions)이 바뀌면 일정 시간 후 자동 저장합니다.
 * - 디바운스: 잦은 입력 중에는 저장을 미루고, 멈추면 저장
 * - 첫 로드 직후에는 저장하지 않음(불필요한 덮어쓰기 방지)
 */
export function useAutoSave(delayMs = 800) {
  const { loading, presetId, input, solutions, saveAll } = useAppStore();
  const firstRun = useRef(true);
  const timer = useRef<number | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!presetId) return;

    // 첫 렌더(로드 직후)에는 저장 방지
    if (firstRun.current) {
      firstRun.current = false;
      return;
    }

    if (timer.current) window.clearTimeout(timer.current);

    timer.current = window.setTimeout(() => {
      saveAll().catch((e) => console.error("autosave failed:", e));
    }, delayMs);

    return () => {
      if (timer.current) window.clearTimeout(timer.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, presetId, input, solutions]);
}
