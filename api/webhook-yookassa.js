// api/webhook-yookassa.js
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  let body;
  try {
    body = req.body;
  } catch (e) {
    return res.status(400).json({ error: 'Invalid JSON' });
  }

  const event = body.event;
  const payment = body.object;
  const paymentKey = payment.metadata?.payment_key;

  if (!paymentKey) {
    return res.status(200).end(); // игнорируем, если нет ключа
  }

  let status = 'failed';
  if (event === 'payment.succeeded') {
    status = 'succeeded';
  } else if (event === 'payment.canceled') {
    status = 'canceled';
  } else {
    return res.status(200).end(); // игнорируем другие события
  }

  try {
    await fetch('https://api.creatium.io/integration-payment/third-party-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_key: paymentKey, status }),
    });
    console.log(`Creatium уведомлён: ${paymentKey} → ${status}`);
  } catch (e) {
    console.error('Ошибка уведомления Creatium:', e.message);
    // ❗ Не возвращаем ошибку клиенту — ЮKassa может повторить вебхук
  }

  res.status(200).json({ success: true });
}
