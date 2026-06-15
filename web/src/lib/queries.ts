/* TanStack Query hooks + mutations over the Ocelli API. */
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, AuthError, type DayQuery } from "./api";
import { dayWindow } from "./datetime";

/* The signed-in user — the auth gate. retry:false so a 401 surfaces at once. */
export function useMe() {
  return useQuery({
    queryKey: ["me"],
    queryFn: api.me,
    retry: (count, err) => !(err instanceof AuthError) && count < 2,
    staleTime: 5 * 60_000,
  });
}

/* A day window (date/start/end) in the user's tz; `iso` optional for other days. */
export function useDayWindow(tz: string | undefined, iso?: string): DayQuery | null {
  return tz ? dayWindow(tz, iso) : null;
}

export function useItems() {
  return useQuery({ queryKey: ["items"], queryFn: api.items });
}

export function useTasks() {
  return useQuery({ queryKey: ["tasks"], queryFn: api.tasks });
}

export function useAgenda(win: DayQuery | null) {
  return useQuery({
    queryKey: ["agenda", win?.date],
    queryFn: () => api.agenda(win!),
    enabled: !!win,
  });
}

export function useBrief(win: DayQuery | null) {
  return useQuery({
    queryKey: ["brief", win?.date],
    queryFn: () => api.brief(win!),
    enabled: !!win,
  });
}

export function useAvailability(win: DayQuery | null) {
  return useQuery({
    queryKey: ["availability", win?.date],
    queryFn: () => api.availability(win!.start, win!.end),
    enabled: !!win,
  });
}

/* ── mutations ── */
export function useItemStatus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, action }: { id: string; action: "done" | "snooze" | "reopen" }) =>
      api.itemStatus(id, action),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["items"] });
      qc.invalidateQueries({ queryKey: ["brief"] });
    },
  });
}

export function useAddItem() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.addItem({ text }),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["items"] }),
  });
}

export function useAddTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (text: string) => api.addTask(text),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useUpdateTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, ...body }: { id: string; done?: boolean; deleted?: boolean }) =>
      api.updateTask(id, body),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["tasks"] }),
  });
}

export function useScheduleTask() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, start, end }: { id: string; start: string; end: string }) =>
      api.scheduleTask(id, start, end),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["tasks"] });
      qc.invalidateQueries({ queryKey: ["agenda"] });
    },
  });
}
