import { logError } from './errorLogger';
import { getAuthenticatedSupabase } from './userSupabase';

const getAccessTokenFromArgs = (args: unknown[]): string | null => {
  for (const arg of args) {
    if (arg instanceof FormData) {
      const token = arg.get('accessToken');
      if (typeof token === 'string' && token) return token;
    }
  }
  return null;
};

const getUserIdFromToken = async (accessToken?: string): Promise<string | null> => {
  if (!accessToken) return null;
  const authenticated = await getAuthenticatedSupabase(accessToken);
  return authenticated?.user.id ?? null;
};

export function wrapServerAction<
  TArgs extends unknown[],
  TResult extends { ok: boolean; message: string }
>(
  actionName: string,
  fn: (...args: TArgs) => Promise<TResult>
): (...args: TArgs) => Promise<TResult> {
  const wrapped = async (...args: TArgs): Promise<TResult> => {
    try {
      return await fn(...args);
    } catch (error) {
      const accessToken = getAccessTokenFromArgs(args);
      const userId = await getUserIdFromToken(accessToken ?? undefined);
      await logError({
        level: 'error',
        source: 'server_action',
        context: actionName,
        message: error instanceof Error ? error.message : 'Ukjent feil',
        stack: error instanceof Error ? error.stack : null,
        userId,
      });

      return {
        ok: false,
        message: 'Noe gikk galt. Prøv igjen.',
      } as TResult;
    }
  };
  return wrapped;
}
