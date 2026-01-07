const BASE_URL = `${process.env.NEXT_PUBLIC_BASE_API}/api`;

export async function fetchJSON(endpoint, { cache = "no-store", next } = {}) {
  const res = await fetch(`${BASE_URL}${endpoint}`, {
    cache,
    next,
  });

  if (!res.ok) {
    throw new Error(`API Error: ${endpoint} → ${res.status}`);
  }

  return res.json();
}
