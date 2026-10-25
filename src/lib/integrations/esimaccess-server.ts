import "server-only";
import {
  createEsimAccessAPI,
  esimAccessConfig,
  EsimAccessError,
} from "./esimaccess-api";

export function esimAccess() {
  const config = esimAccessConfig(process.env);
  if (!config) throw new EsimAccessError("configuration");
  return createEsimAccessAPI(config);
}
