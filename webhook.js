// Cloudflare Pages Function: /webhook
// ใช้ครั้งเดียวตอนตั้งค่าระบบ เพื่อดึง userId ของแอดมินแต่ละคน
// พอแอดมินทักข้อความอะไรก็ได้เข้ามาที่ LINE OA บอทจะตอบ userId กลับไปทันที
//
// วิธีตั้งค่า:
// 1. ตั้งค่า env var เดียวกับ notify.js: LINE_CHANNEL_ACCESS_TOKEN
//    (และแนะนำให้ตั้ง LINE_CHANNEL_SECRET เพิ่ม เพื่อตรวจสอบว่า request มาจาก LINE จริง)
// 2. ไปที่ LINE Developers Console > Messaging API tab > Webhook URL
//    ใส่ https://YOUR-SITE.pages.dev/webhook แล้วกด Verify
// 3. เปิด "Use webhook" เป็น ON
// 4. ปิด "Auto-reply messages" และ "Greeting messages" ใน LINE Official Account Manager
//    (ไม่งั้นข้อความอัตโนมัติของ LINE จะขึ้นปนกับ userId ที่บอทตอบ)
// 5. ให้แอดมินแต่ละคนเพิ่มเพื่อน OA แล้วพิมพ์อะไรก็ได้ เช่น "สวัสดี"
//    บอทจะตอบกลับ userId มาให้ทันที คัดลอกไปใส่ LINE_ADMIN_USER_IDS
// 6. ทำครบ 3 คนแล้ว จะปิด webhook หรือปล่อยไว้ก็ได้ ไม่กระทบระบบแจ้งเตือนหลัก (/notify)

async function verifySignature(request, secret, bodyText) {
  if (!secret) return true; // ข้ามการตรวจถ้าไม่ได้ตั้ง secret ไว้
  const signature = request.headers.get("x-line-signature");
  if (!signature) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(bodyText));
  const computed = btoa(String.fromCharCode(...new Uint8Array(sigBuffer)));
  return computed === signature;
}

export async function onRequestPost(context) {
  const { request, env } = context;
  const bodyText = await request.text();

  const valid = await verifySignature(request, env.LINE_CHANNEL_SECRET, bodyText);
  if (!valid) {
    return new Response("invalid signature", { status: 401 });
  }

  let body;
  try {
    body = JSON.parse(bodyText);
  } catch (e) {
    return new Response("invalid json", { status: 400 });
  }

  const token = env.LINE_CHANNEL_ACCESS_TOKEN;
  const events = body.events || [];

  await Promise.all(events.map(async (event) => {
    if (event.type !== "message" || !event.replyToken) return;
    const userId = event.source && event.source.userId;
    if (!userId) return;

    await fetch("https://api.line.me/v2/bot/message/reply", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        replyToken: event.replyToken,
        messages: [{ type: "text", text: `userId ของคุณคือ:\n${userId}\n\nคัดลอกข้อความนี้ไปให้แอดมินระบบเพื่อตั้งค่า` }]
      })
    });
  }));

  return new Response("ok", { status: 200 });
}
