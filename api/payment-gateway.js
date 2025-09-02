// api/payment-gateway.js
import fetch from 'node-fetch';
import { v4 as uuidv4 } from 'uuid';

export default async function handler(req, res) {
  // CORS
  res.setHeader('Access-Control-Allow-Origin', 'https://dlvd.ru');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Парсинг тела запроса
  let body;
  if (req.headers['content-type']?.includes('application/json')) {
    body = req.body;
  } else if (req.headers['content-type']?.includes('application/x-www-form-urlencoded')) {
    const raw = await new Response(req).text();
    body = Object.fromEntries(new URLSearchParams(raw));
  } else {
    return res.status(400).json({ error: 'Unsupported Content-Type' });
  }

  const { payment_key, amount, customer_email } = body;

  // Валидация
  if (!payment_key || !amount) {
    console.error('❌ Отсутствуют обязательные поля:', { payment_key, amount });
    return res.status(400).json({
      error: { message: 'Отсутствуют обязательные поля: payment_key или amount' }
    });
  }

  const amountValue = parseFloat(amount);
  if (isNaN(amountValue) || amountValue <= 0) {
    console.error('❌ Неверная сумма:', amount);
    return res.status(400).json({
      error: { message: 'Сумма должна быть положительным числом' }
    });
  }

  const shopId = process.env.YOOKASSA_SHOP_ID;
  const secretKey = process.env.YOOKASSA_SECRET_KEY;

  if (!shopId || !secretKey) {
    console.error('❌ Не заданы ключи ЮKassa');
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
        'Idempotence-Key': uuidv4(),
      },
      body: JSON.stringify({
        amount: { value: amountValue.toFixed(2), currency: 'RUB' },
        capture: true,
        confirmation: {
          type: 'redirect',
          return_url: 'https://dlvd.ru/payment-success',
        },
        description: 'Оплата заказа',
        metadata: { payment_key },
        ...(customer_email && {
          receipt: {
            customer: { email: customer_email },
            items: [
              {
                description: 'Заказ',
                quantity: 1,
                amount: { value: amountValue.toFixed(2), currency: 'RUB' },
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

    if (response.ok && payment.confirmation?.confirmation_url) {
      return res.status(200).json({
        confirmation_url: payment.confirmation.confirmation_url,
      });
    } else {
      console.error('❌ Ошибка от ЮKassa:', payment);
      return res.status(500).json({
        error: {
          message: payment.error?.message || 'Не удалось создать платёж',
          code: payment.error?.code,
        }
      });
    }
  } catch (error) {
    console.error('❌ Ошибка при запросе к ЮKassa:', error);
    return res.status(500).json({
      error: { message: 'Ошибка при создании платежа' }
    });
  }
}

// Важно: отключаем встроенный парсер
export const config = {
  api: {
    bodyParser: false,
  },
};
