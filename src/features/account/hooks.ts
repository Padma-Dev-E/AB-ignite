'use client';
import { useMutation } from '@tanstack/react-query';
import { apiFetch } from '../../lib/api/client';
export function useChangePassword() {
  return useMutation({ mutationFn: (input: { currentPassword: string; newPassword: string }) => apiFetch<{ changed: boolean; sessionsRevoked: boolean }>('/api/account/password', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) }), retry: false });
}
