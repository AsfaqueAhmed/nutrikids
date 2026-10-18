import { ApiException, toProblem } from './errors';

/**
 * Turns an openapi-fetch result into the response body, or throws ApiException
 * with the backend's { code, message } error. Needed because the contract does
 * not describe response bodies, so `data`/`error` are not typed.
 */
export function unwrap<T>(res: { response: Response; data?: unknown; error?: unknown }): T {
  if (!res.response.ok) throw new ApiException(toProblem(res.response, res.error));
  return res.data as T;
}
