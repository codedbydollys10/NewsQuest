const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

type ResolvePredictionResponse = {
  success: boolean;
  resolvedIndex: number;
  resolvedOption: string;
  probabilities: number[];
  reason: string;
  resolvedAt: string;
  sourceCount: number;
  error?: string;
};

export const resolvePrediction = async (input: {
  headline: string;
  summary: string;
  question: string;
  options: string[];
  category: string;
}) => {
  const response = await fetch(apiUrl('/predictions/resolve'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });

  const data = await response.json() as ResolvePredictionResponse;
  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to resolve prediction.');
  }

  return data;
};
