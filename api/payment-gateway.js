// api/payment-gateway.js
import axios from 'axios';
import { v4 as uuidv4 } from 'uuid';

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
    console.error('YOOKASSA_SHOP_ID или YOOKASSA_SECRET_KEY не заданы');
    return res.status(500).json({
      error: { message: 'Ошибка настройки платежной системы' }
    });
  }

  try {
    const response = await axios.post('https://api.yookassa.ru/v3/payments', {
      amount: { value: amount.toFixed(2), currency },
      capture: true,
      confirmation: {
        type: 'redirect',
        return_url: 'https://tvoi-sait.creatium.site/thanks', // ← Замени на свою страницу
      },
      description,
      metadata: {
        payment_key: payment_key,
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
    }, {
      headers: {
        'Authorization': `Basic ${Buffer.from(`${shopId}:${secretKey}`).toString('base64')}`,
        'Idempotency-Key': uuidv4(),
        'Content-Type': 'application/json',
      },
    });

    const payment = response.data;

    // ✅ Ключевое: возвращаем именно confirmation_url
    return res.status(200).json({
      confirmation_url: payment.confirmation.confirmation_url,
    });

  } catch (error) {
    console.error('Ошибка при создании платежа:', error.response?.data || error.message);
    return res.status(500).json({
      error: {
        message: error.response?.data?.error?.message || 'Не удалось создать платёж'
      }
    });
  }
}
