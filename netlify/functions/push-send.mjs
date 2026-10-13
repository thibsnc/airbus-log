// Runs every 5 minutes: sends the flight reminders that are due (see push.mjs). A reminder more than
// 30 minutes late is dropped rather than sent; a subscription the push service no longer knows is deleted.
import { getStore } from "@netlify/blobs";
import { vapidKeys, sendPush } from "../lib/webpush.mjs";

export default async () => {
  const store = getStore("push");
  const jwk = await vapidKeys(store);
  const now = Date.now();
  const { blobs } = await store.list({ prefix: "dev-" });
  for (const { key } of blobs) {
    const rec = await store.get(key, { type: "json" });
    if (!rec || !rec.sub) continue;
    const due = (rec.items || []).filter((x) => x.at <= now && x.at > now - 30 * 6e4 && !(rec.sent || []).includes(x.tag));
    if (!due.length) continue;
    let gone = false;
    for (const x of due) {
      const status = await sendPush(rec.sub, { title: x.title, body: x.body, tag: x.tag }, jwk).catch(() => 0);
      if (status === 404 || status === 410) { gone = true; break; }
      if (status >= 200 && status < 300) rec.sent = [...(rec.sent || []), x.tag];
    }
    if (gone) await store.delete(key);
    else { rec.items = rec.items.filter((x) => x.at > now - 864e5); await store.setJSON(key, rec); }
  }
};

export const config = { schedule: "*/5 * * * *" };
