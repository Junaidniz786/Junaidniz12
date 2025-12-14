const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= CONFIG =================

// 🔐 BOT TOKEN (STRING MEIN!)
const BOT_TOKEN = '7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58';

// Channels user must join
const REQUIRED_CHANNELS = [
  '@Jndtech1',
  '@Jndtech1'
];

// APIs
const NUMBERS_API = 'https://www.junaidniz.pw/api/tempotps?type=numbers';
const SMS_API = 'https://www.junaidniz.pw/api/tempotps?type=sms';

// OTP GROUP (optional)
const OTP_GROUP_LINK = 'https://t.me/mrchandiootpgroup';

// ==========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot Started');

// userId -> { country, number }
const userSession = new Map();

// ================= CHANNEL CHECK =================
async function isJoined(userId) {
  try {
    for (const ch of REQUIRED_CHANNELS) {
      const m = await bot.getChatMember(ch, userId);
      if (!['member', 'administrator', 'creator'].includes(m.status)) {
        return false;
      }
    }
    return true;
  } catch {
    return false;
  }
}

// ================= /start =================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, '❌ Join required channels first:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Join Channel', url: 'https://t.me/mrchd112' }],
          [{ text: 'Join OTP Group', url: 'https://t.me/+Aqq6X6oRWCdhM2Q0' }],
          [{ text: '✅ Verify', callback_data: 'verify' }]
        ]
      }
    });
  }

  sendCountryList(chatId);
});

// ================= VERIFY =================
bot.on('callback_query', async (q) => {
  if (q.data === 'verify') {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, {
        text: '❌ Join channels first',
        show_alert: true
      });
    }

    sendCountryList(q.message.chat.id);
  }
});

// ================= COUNTRY LIST =================
async function sendCountryList(chatId) {
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const countryMap = {};

  for (const r of rows) {
    const country = r[1];
    if (!countryMap[country]) countryMap[country] = 0;
    countryMap[country]++;
  }

  const keyboard = Object.entries(countryMap).map(
    ([country, count]) => [
      {
        text: `🌍 ${country} (${count} numbers)`,
        callback_data: `country_${country}`
      }
    ]
  );

  bot.sendMessage(chatId, '🌍 *Select Country*', {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ================= SELECT COUNTRY =================
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('country_')) return;

  const country = q.data.replace('country_', '');
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const numbers = rows.filter(r => r[1] === country);
  if (!numbers.length) return;

  const pick = numbers[Math.floor(Math.random() * numbers.length)];
  const number = pick[0];

  userSession.set(userId, { country, number });

  bot.sendMessage(
    chatId,
    `🇺🇳 *Your Number (${country})*\n📞 \`${number}\`\n\n⏳ Waiting for OTP...`,
    {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🔁 Change Number', callback_data: 'change_number' }],
          [{ text: '🌍 Change Country', callback_data: 'change_country' }],
          [{ text: '🕘 View Past OTPs', callback_data: 'past_otp' }],
          [{ text: '📢 OTP Group', url: 'https://t.me/+Aqq6X6oRWCdhM2Q0' }]
        ]
      }
    }
  );
});

// ================= CHANGE BUTTONS =================
bot.on('callback_query', async (q) => {
  const userId = q.from.id;

  if (q.data === 'change_country') {
    userSession.delete(userId);
    return sendCountryList(q.message.chat.id);
  }

  if (q.data === 'change_number') {
    const session = userSession.get(userId);
    if (!session) return;
    q.data = `country_${session.country}`;
    return bot.emit('callback_query', q);
  }
});

// ================= OTP LOOP =================
setInterval(async () => {
  try {
    const { data } = await axios.get(SMS_API);
    const rows = data.aaData || [];

    for (const [uid, session] of userSession.entries()) {
      const found = rows.find(r => r[2] === session.number);
      if (found) {
        await bot.sendMessage(
          uid,
          `🔐 *OTP Received*\n\n📞 ${session.number}\n\n📩 ${found[4]}`,
          { parse_mode: 'Markdown' }
        );
        userSession.delete(uid);
      }
    }
  } catch {}
}, 3000);
