const API_BASE_URL = (import.meta.env.VITE_API_URL as string | undefined)?.replace(/\/$/, '') ?? '/api';

const apiUrl = (path: string) => `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;

export type RegisterAccountInput = {
  email: string;
  password: string;
  username: string;
  avatarId: number;
};

export const registerAccount = async (input: RegisterAccountInput) => {
  const response = await fetch(apiUrl('/auth/register'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(input),
  });

  const data = await response.json() as {
    success: boolean;
    error?: string;
  };

  if (!response.ok || !data.success) {
    throw new Error(data.error || 'Failed to register account.');
  }

  return data;
};
