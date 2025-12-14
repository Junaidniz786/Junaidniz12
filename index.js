const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= CONFIG =================

// 🔐 BOT TOKEN
const BOT_TOKEN = "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

// Required Channels
const REQUIRED_CHANNELS = [
  '@jndtech1',
  '@Jndtech1'
];

// APIs
const NUMBERS_API = 'https://www.junaidniz.pw/api/tempotps?type=numbers';
const SMS_API = 'https://www.junaidniz.pw/api/tempotps?type=sms';

// (Optional) OTP Group
// const OTP_GROUP_ID = -100xxxxxxxxxx;

// ==========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot Started');

const userSelectedNumber = new Map();

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
    return bot.sendMessage(chatId,
      '❌ *Join required channels first:*',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Join @mrchd112', url: 'https://t.me/jndtech1' }],
            [{ text: 'Join OTP Group', url: 'https://t.me/+Aqq6X6oRWCdhM2Q0' }],
            [{ text: '✅ Verify', callback_data: 'verify' }]
          ]
        }
      }
    );
  }

  showCountries(chatId);
});

// ================= VERIFY =================
bot.on('callback_query', async (q) => {
  if (q.data === 'verify') {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, {
        text: '❌ Join both channels first',
        show_alert: true
      });
    }
    showCountries(q.message.chat.id);
  }
});

// ================= SHOW COUNTRIES =================
async function showCountries(chatId) {
  try {
    const { data } = await axios.get(NUMBERS_API);
    const rows = data.aaData || [];

    const countries = {};
    for (const r of rows) {
      const country = r[1];
      countries[country] = (countries[country] || 0) + 1;
    }

    const keyboard = Object.keys(countries).map(c => [
      { text: `${c} (${countries[c]})`, callback_data: `country_${c}` }
    ]);

    bot.sendMessage(chatId,
      '🌍 *Select Country:*',
      {
        parse_mode: 'Markdown',
        reply_markup: { inline_keyboard: keyboard }
      }
    );
  } catch {
    bot.sendMessage(chatId, '❌ Failed to load countries');
  }
}

// ================= COUNTRY SELECT =================
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('country_')) return;

  const country = q.data.replace('country_', '');

  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData.filter(r => r[1] === country);

  const number = rows[Math.floor(Math.random() * rows.length)][2];
  userSelectedNumber.set(q.from.id, number);

  bot.sendMessage(q.from.id,
    `📞 *Your Number (${country}):*\n\n\`${number}\`\n\n⏳ Waiting for OTP...`,
    { parse_mode: 'Markdown' }
  );
});

// ================= OTP LISTENER =================
setInterval(async () => {
  try {
    const { data } = await axios.get(SMS_API);
    const rows = data.aaData || [];

    for (const r of rows) {
      const number = r[2];
      const message = r[4];

      for (const [uid, sel] of userSelectedNumber.entries()) {
        if (sel === number) {
          await bot.sendMessage(uid,
            `🔑 *OTP Received*\n\n📞 ${number}\n\n${message}`,
            { parse_mode: 'Markdown' }
          );
          userSelectedNumber.delete(uid);
        }
      }

      // OPTIONAL GROUP OTP
      // bot.sendMessage(OTP_GROUP_ID, `${number}\n${message}`);
    }
  } catch {}
}, 3000);
