// api/payment-gateway.js
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // ✅ Разрешаем запросы с Creatium (dlvd.ru)
  res.setHeader('Access-Control-Allow-Origin', 'https://dlvd.ru');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  // ✅ Обрабатываем предварительный запрос (preflight)
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { payment_key, amount, customer_email } = req.body;

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    return res.status(500).json({ error: { message: 'Не заданы ключи ЮKassa' } });
  }

  try {
    const response = await fetch('https://api.yookassa.ru/v3/payments', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
        'Idempotency-Key': uuidv4(),
      },
      body: JSON.stringify({
        amount: { value: amount.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: 'https://dlvd.ru/payment-success',
        },
        description: 'Оплата заказа',
        meta { payment_key },
        ...(customer_email && {
          receipt: {
            customer: { email: customer_email },
            items: [
              {
                description: 'Заказ',
                quantity: 1,
                amount: { value: amount.toFixed(2), currency: 'RUB' },
                vat_code: 1,
                payment_mode: 'full_payment',
                payment_subject: 'commodity',
              },
            ],
          },
        }),
      }),
    });

    const payment = await response.json();

    if (payment.confirmation && payment.confirmation.confirmation_url) {
      return res.status(200).json({
        confirmation_url: payment.confirmation.confirmation_url,
      });
    } else {
      return res.status(500).json({ error: { message: 'Не удалось получить ссылку' } });
    }
  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({ error: { message: 'Ошибка при создании платежа' } });
  }
}
