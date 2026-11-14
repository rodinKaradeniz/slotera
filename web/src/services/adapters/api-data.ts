/** API builds carry no fixtures and fail explicitly if a mock path is reached. */
import { NotImplementedError } from "../_errors";
export function mockData<T>(name: string): T {
  throw new NotImplementedError(`mock fixture: ${name}`);
}
