const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= CONFIG =================
const BOT_TOKEN = '7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58';

const REQUIRED_CHANNELS = [
  '@Jndtech1',
  '@Jndtech1'
];

const NUMBERS_API = 'https://www.junaidniz.pw/api/tempotps?type=numbers';
const SMS_API = 'https://www.junaidniz.pw/api/tempotps?type=sms';

// =========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Chandio OTP Bot Started');

// user state
const userState = new Map(); 
// { country, number }

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
`❌ Join required channels first:`,
{
  reply_markup: {
    inline_keyboard: [
      [{ text: 'Join @mrchd112', url: 'https://t.me/jndtech1' }],
      [{ text: 'Join OTP Group', url: 'https://t.me/+c4VCxBCT3-QzZGFk' }],
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

  const keyboard = Object.entries(countryMap).map(([c, n]) => ([
    { text: `🌍 ${c} (${n} numbers)`, callback_data: `country_${c}` }
  ]));

  bot.sendMessage(chatId,
`🌍 *Select Country*\n⚡ Fast delivery\n🔐 Secure numbers\n♻️ Change anytime`,
{
  parse_mode: 'Markdown',
  reply_markup: { inline_keyboard: keyboard }
});
}

// ================= SELECT COUNTRY =================
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('country_')) return;

  const country = q.data.replace('country_', '');
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const numbers = rows.filter(r => r[1] === country);
  if (!numbers.length) return;

  const pick = numbers[Math.floor(Math.random() * numbers.length)];
  const number = pick[0];

  userState.set(q.from.id, { country, number });

  bot.sendMessage(q.message.chat.id,
`🇺🇳 *Your Number (${country})*\n📞 \`${number}\`\n\n⏳ Waiting for OTP...\n🔔 You’ll get notified instantly!`,
{
  parse_mode: 'Markdown',
  reply_markup: {
    inline_keyboard: [
      [{ text: '🔄 Change Number', callback_data: 'change_number' }],
      [{ text: '🌍 Change Country', callback_data: 'change_country' }],
      [{ text: '📢 OTP Group', url: 'https://t.me/+Aqq6X6oRWCdhM2Q0' }]
    ]
  }
});
});

// ================= CHANGE =================
bot.on('callback_query', async (q) => {
  if (q.data === 'change_country') {
    return sendCountryList(q.message.chat.id);
  }

  if (q.data === 'change_number') {
    const st = userState.get(q.from.id);
    if (!st) return;
    q.data = `country_${st.country}`;
    bot.emit('callback_query', q);
  }
});

// ================= OTP LOOP =================
setInterval(async () => {
  try {
    const { data } = await axios.get(SMS_API);
    const rows = data.aaData || [];

    for (const [uid, st] of userState.entries()) {
      for (const r of rows) {
        if (r[2] === st.number) {
          await bot.sendMessage(uid,
`🔑 *OTP Received*\n📞 ${st.number}\n\n${r[4]}`,
{ parse_mode: 'Markdown' });
          userState.delete(uid);
          break;
        }
      }
    }
  } catch {}
}, 3000);
