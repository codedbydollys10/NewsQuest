import { useEffect, useMemo, useState } from 'react';
import { ACTIVITY_UPDATED_EVENT, fetchActivityHeatmap, type ActivityDay } from '@/lib/activityApi';

type ActivityHeatmapProps = {
  userId?: string;
  cellSize?: number;
};

const toLocalDayKey = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const buildDateRange = (days: number) => {
  const items: string[] = [];
  const end = new Date();
  end.setHours(0, 0, 0, 0);

  for (let i = 0; i < days; i += 1) {
    const date = new Date(end);
    date.setDate(date.getDate() - i);
    items.push(toLocalDayKey(date));
  }

  return items;
};

const levelForCount = (count: number) => {
  if (count <= 0) return 0;
  if (count === 1) return 1;
  if (count <= 3) return 2;
  if (count <= 6) return 3;
  return 4;
};

export const ActivityHeatmap = ({ userId, cellSize = 10 }: ActivityHeatmapProps) => {
  const [days, setDays] = useState<ActivityDay[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) {
      setDays([]);
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    void fetchActivityHeatmap(userId)
      .then((rows) => {
        if (!cancelled) setDays(rows);
      })
      .catch(() => {
        if (!cancelled) setDays([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId || typeof window === 'undefined') return;

    const handleUpdate = (event: Event) => {
      const customEvent = event as CustomEvent<{
        userId?: string;
        type?: 'read' | 'quiz' | 'prediction' | 'battle';
        activityDate?: string;
      }>;

      if (!customEvent.detail || customEvent.detail.userId !== userId || !customEvent.detail.activityDate) {
        return;
      }

      setDays((current) => {
        const next = [...current];
        const index = next.findIndex((day) => day.activity_date === customEvent.detail.activityDate);
        const baseRow: ActivityDay = index >= 0
          ? next[index]
          : {
            user_id: userId,
            activity_date: customEvent.detail.activityDate,
            total_events: 0,
            article_reads: 0,
            quiz_answers: 0,
            prediction_locks: 0,
            battle_matches: 0,
          };

        const updatedRow: ActivityDay = {
          ...baseRow,
          total_events: baseRow.total_events + 1,
          article_reads: baseRow.article_reads + (customEvent.detail.type === 'read' ? 1 : 0),
          quiz_answers: baseRow.quiz_answers + (customEvent.detail.type === 'quiz' ? 1 : 0),
          prediction_locks: baseRow.prediction_locks + (customEvent.detail.type === 'prediction' ? 1 : 0),
          battle_matches: baseRow.battle_matches + (customEvent.detail.type === 'battle' ? 1 : 0),
        };

        if (index >= 0) {
          next[index] = updatedRow;
        } else {
          next.push(updatedRow);
        }

        return next;
      });
    };

    window.addEventListener(ACTIVITY_UPDATED_EVENT, handleUpdate);
    return () => window.removeEventListener(ACTIVITY_UPDATED_EVENT, handleUpdate);
  }, [userId]);

  const data = useMemo(() => {
    const dateRange = buildDateRange(364);
    const rowsByDate = new Map(days.map((day) => [day.activity_date, day] as const));

    return dateRange.map((date) => {
      const row = rowsByDate.get(date);
      const total = row?.total_events ?? 0;
      return {
        date,
        total,
        level: levelForCount(total),
        reads: row?.article_reads ?? 0,
        quizzes: row?.quiz_answers ?? 0,
        predictions: row?.prediction_locks ?? 0,
        battles: row?.battle_matches ?? 0,
        streak: row?.streak_count ?? 0,
      };
    });
  }, [days]);

  const columns = useMemo(() => {
    const result: typeof data[] = [];
    for (let i = 0; i < data.length; i += 7) {
      result.push(data.slice(i, i + 7));
    }
    return result;
  }, [data]);

  return (
    <div className="w-full overflow-hidden">
      {loading && (
        <p className="mb-3 text-[11px] text-nq-text-muted">Loading activity heatmap...</p>
      )}
      <div className="flex w-full gap-[4px] overflow-x-auto pb-1">
        {columns.map((week, weekIndex) => (
          <div key={weekIndex} className="grid grid-rows-7 gap-[4px]" style={{ minWidth: `${cellSize}px` }}>
            {week.map((v, i) => (
              <div
                key={`${weekIndex}-${i}`}
                className="rounded-[3px] transition-colors"
                style={{
                  width: `${cellSize}px`,
                  height: `${cellSize}px`,
                  backgroundColor: v.level === 0
                    ? 'hsl(224 29% 14%)'
                    : v.level === 1
                      ? 'hsl(187 100% 50% / 0.22)'
                      : v.level === 2
                        ? 'hsl(187 100% 50% / 0.42)'
                        : v.level === 3
                          ? 'hsl(187 100% 50% / 0.66)'
                          : 'hsl(187 100% 50% / 0.92)',
                }}
                title={`${v.date} · ${v.total} actions`}
              />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
};
