// api/payment-gateway.js
import { v4 as uuidv4 } from 'uuid';
import fetch from 'node-fetch';

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const {
    payment_key,
    amount,
    currency = 'RUB',
    description = 'Оплата заказа',
    customer_email,
  } = req.body;

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    return res.status(500).json({
      error: { message: 'Не заданы ключи ЮKassa' }
    });
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
        amount: { value: amount.toFixed(2), currency },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: 'https://dlvd.ru/',
        },
        description,
        meta {
          payment_key,
        },
        ...(customer_email && {
          receipt: {
            customer: { email: customer_email },
            items: [
              {
                description,
                quantity: 1,
                amount: { value: amount.toFixed(2), currency },
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
      return res.status(500).json({
        error: { message: 'Не удалось получить ссылку на оплату' }
      });
    }

  } catch (error) {
    console.error('Ошибка:', error);
    return res.status(500).json({
      error: { message: 'Ошибка при создании платежа' }
    });
  }
}
