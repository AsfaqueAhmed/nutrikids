import { ApiException, toProblem } from './errors';

export function unwrap<T>(res: { response: Response; data?: unknown; error?: unknown }): T {
  if (!res.response.ok) throw new ApiException(toProblem(res.response, res.error));
  return res.data as T;
}
