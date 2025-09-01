import axios from 'axios';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).end();
  }

  const body = req.body;
  const event = body.event;

  const payment = body.object;
  const paymentKey = payment.metadata?.payment_key;

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

  try {
    await axios.post('https://api.creatium.io/integration-payment/third-party-payment', {
      payment_key: paymentKey,
      status: status,
    });
    console.log(`Creatium уведомлён: ${paymentKey} → ${status}`);
  } catch (e) {
    console.error('Ошибка при уведомлении Creatium:', e.message);
  }

  res.status(200).json({ success: true });
}
