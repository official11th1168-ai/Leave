// Cloudflare Pages Function: /notify
// เก็บ secret ฝั่ง server เท่านั้น ห้ามใส่ token ตรงๆ ในไฟล์นี้
// ตั้งค่าใน Cloudflare Pages > Settings > Environment variables:
//   LINE_CHANNEL_ACCESS_TOKEN = channel access token ของ LINE OA ที่สร้างแยกสำหรับระบบใบลา
//   LINE_ADMIN_USER_IDS       = user id ของแอดมิน 3 คน คั่นด้วย comma เช่น "U111...,U222...,U333..."

export async function onRequestPost(context) {
  const { request, env } = context;

  let body;
  try {
    body = await request.json();
  } catch (e) {
    return new Response(JSON.stringify({ error: "invalid json" }), { status: 400 });
  }

  const message = (body.message || "").toString().slice(0, 1900);
  if (!message) {
    return new Response(JSON.stringify({ error: "message required" }), { status: 400 });
  }

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const userIds = (env.LINE_ADMIN_USER_IDS || "").split(",").map(s => s.trim()).filter(Boolean);

  if (!token || userIds.length === 0) {
    return new Response(JSON.stringify({ error: "LINE not configured" }), { status: 500 });
  }

  const results = await Promise.all(userIds.map(async (to) => {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        to,
        messages: [{ type: "text", text: message }]
      })
    });
    return { to, ok: res.ok, status: res.status };
  }));

  return new Response(JSON.stringify({ results }), {
    status: 200,
    headers: { "Content-Type": "application/json" }
  });
}
