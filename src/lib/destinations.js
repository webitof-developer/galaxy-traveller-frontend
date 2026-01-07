import { fetchJSON } from "./api";

export async function getAllDestinations() {
  return fetchJSON("/site_destinationslist", {
    cache: "force-cache", // Cache on server
    next: { revalidate: 60 }, // Revalidate every 60 seconds
  });
}

export async function getDestination(slug) {
  return fetchJSON(`/destinations/${slug}`, {
    cache: "no-store", // Always fresh
  });
}
