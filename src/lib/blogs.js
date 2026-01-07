import client from "@/api/client";

export async function getAllBlogs() {
  const res = await client.get("/blog");
  return res?.data?.data?.items || res?.data?.items || [];
}

export async function getBlog(slug) {
  const res = await client.get(`/blog/${slug}`);
  return res?.data?.data;
}
