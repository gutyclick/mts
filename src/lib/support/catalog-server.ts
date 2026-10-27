import "server-only";
import { getDestinations, getPublishedPlans } from "../catalog-server";
import { findChatDestination, selectChatPlans } from "./chat-catalog";
export async function supportCatalog(texts: string[], topic: string) {
  if (
    topic !== "plans" &&
    !/plan|paquet|compr|buy|recommend|recom|precio|price|\bgb\b/i.test(
      texts.slice(-3).join(" "),
    )
  )
    return null;
  const destinations = await getDestinations();
  const destination = findChatDestination(texts, destinations);
  if (!destination) return null;
  const plans = selectChatPlans(
    await getPublishedPlans(destination),
    texts.slice(-3).join("\n"),
  );
  return { destination, plans };
}
