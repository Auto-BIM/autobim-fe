// 작업 상태 따라가기(폴링) — 변환은 서버에서 따로 돌기 때문에, 끝날 때까지 주기적으로 물어본다.
//
//   queued ─▶ running ─▶ succeeded
//                    └─▶ failed
// 보충 입력을 보내면 다시 queued가 되고 revision이 1 오른다. 그동안에도 job.plan·files는
// "마지막 성공 결과"(result_revision)를 그대로 갖고 있어서, 화면은 이전 결과를 계속 보여줄 수 있다.
import { useCallback, useEffect, useRef, useState } from "react";
import { ApiError, getJob, type Job } from "./api";

const busy = (j: Job | null) => j?.status === "queued" || j?.status === "running";

export function useJob(id: string | null) {
  const [job, setJob] = useState<Job | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const timer = useRef<number | undefined>(undefined);
  const tries = useRef(0);

  const stop = () => window.clearTimeout(timer.current);

  const poll = useCallback(async (jobId: string) => {
    stop();
    try {
      const j = await getJob(jobId);
      setJob(j);
      setError(null);
      if (busy(j)) {
        // 처음엔 자주(0.8초), 오래 걸리면 덜 자주(최대 3초) — 서버 부담 줄이기
        tries.current += 1;
        timer.current = window.setTimeout(() => poll(jobId), Math.min(3000, 800 + tries.current * 100));
      } else {
        tries.current = 0;
      }
    } catch (e) {
      const err = e instanceof ApiError ? e : new ApiError("network", "서버에 연결하지 못했어요.");
      setError(err);
      // 연결이 잠깐 끊긴 거면 조금 뒤 다시 시도, 작업이 없으면(404) 멈춘다
      if (err.code === "network") timer.current = window.setTimeout(() => poll(jobId), 3000);
    }
  }, []);

  useEffect(() => {
    setJob(null);
    setError(null);
    tries.current = 0;
    if (id) poll(id);
    return stop;
  }, [id, poll]);

  /** 업로드·보충 입력의 202 응답을 바로 반영하고 다시 따라가기 시작 */
  const track = useCallback(
    (j: Job) => {
      setJob(j);
      tries.current = 0;
      if (busy(j)) timer.current = window.setTimeout(() => poll(j.id), 600);
    },
    [poll],
  );

  return { job, error, busy: busy(job), track, refresh: () => id && poll(id) };
}
