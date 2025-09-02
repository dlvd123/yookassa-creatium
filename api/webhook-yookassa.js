// api/webhook-yookassa.js
import fetch from 'node-fetch';

// URL вашего Google Apps Script
const GOOGLE_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbx3hOL4W3whosrE1qkOV7G3zjhFzEMekVM1_BdRBNykdsMZyPuClabc35wmNNzx70vg/exec?gid=0';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const body = req.body;
  const event = body.event;
  const payment = body.object;

  const paymentKey = payment.metadata?.payment_key;
  const amount = payment.amount?.value;
  const customerEmail = payment.receipt?.customer?.email || payment.metadata?.customer_email;

  if (!paymentKey) {
    return res.status(200).end();
  }

  let status = 'failed';
  if (event === 'payment.succeeded') {
    status = 'succeeded';
  } else if (event === 'payment.canceled') {
    status = 'canceled';
  } else {
    return res.status(200).end();
  }

  // 1. Отправляем в Creatium
  try {
    await fetch('https://api.creatium.io/integration-payment/third-party-payment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ payment_key: paymentKey, status }),
    });
    console.log(`✅ Creatium уведомлён: ${paymentKey} → ${status}`);
  } catch (e) {
    console.error('❌ Ошибка уведомления Creatium:', e.message);
  }

  // 2. Отправляем в Google Таблицу
  try {
    await fetch(GOOGLE_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        payment_key: paymentKey,
        amount: amount,
        customer_email: customerEmail,
        status: status,
        created_at: new Date().toISOString(),
      }),
    });
    console.log(`✅ Данные отправлены в Google Таблицу: ${paymentKey}`);
  } catch (e) {
    console.error('❌ Ошибка отправки в Google Таблицу:', e.message);
  }

  res.status(200).json({ success: true });
}

export const config = {
  api: {
    bodyParser: true,
  },
};
