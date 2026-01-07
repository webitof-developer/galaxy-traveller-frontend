const BASE = process.env.NEXT_PUBLIC_BASE_API.replace(/\/$/, "");

export async function getFlyers({ page = 1, limit = 12 } = {}) {
  const url = `${BASE}/api/flyers?page=${page}&limit=${limit}`;

  console.log(url);
  const res = await fetch(url, { cache: "no-store" });

  const data = res.json();

  if (res.status !== 200) {
    console.error("Flyer API error:", res.status);
    return null;
  }

  return data; // this returns parsed JSON
}
