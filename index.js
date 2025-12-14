const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

/* ================== CONFIG ================== */

// ✅ BOT TOKEN (direct, sahi syntax)
const BOT_TOKEN = '7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58';

// Channels must join
const REQUIRED_CHANNELS = [
  '@jndtech1',
  '@Junaidniz'
];

// Numbers API (country + numbers)
const NUMBERS_APIS = [
  'https://www.junaidniz.pw/api/tempotps?type=numbers',
  'https://www.junaidniz.pw/api/tempotp?type=numbers'
];

// SMS / OTP API
const SMS_APIS = [
  'https://www.junaidniz.pw/api/tempotps?type=sms',
  'https://www.junaidniz.pw/api/tempotp?type=sms'
];

// OPTIONAL: group for all OTPs
// const GROUP_ID = -100XXXXXXXXXX;

/* ============================================ */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ OTP Bot Started');

// userId -> selected number
const waitingUsers = new Map();

/* ================= CHANNEL CHECK ================= */
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

/* ================= /start ================= */
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(
      chatId,
      '🚫 *Please join channels first*',
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: 'Join Channel 1', url: 'https://t.me/jndtech1' }],
            [{ text: 'Join Channel 2', url: 'https://t.me/Junaidniz' }],
            [{ text: '✅ I Joined', callback_data: 'recheck' }]
          ]
        }
      }
    );
  }

  bot.sendMessage(
    chatId,
    '🌍 *Welcome to OTP Bot*\n\nUse /numbers to select country & number',
    { parse_mode: 'Markdown' }
  );
});

/* ================= RECHECK ================= */
bot.on('callback_query', async (q) => {
  if (q.data === 'recheck') {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, {
        text: '❌ Join channels first',
        show_alert: true
      });
    }

    bot.editMessageText(
      '✅ Access granted!\n\nUse /numbers',
      {
        chat_id: q.message.chat.id,
        message_id: q.message.message_id
      }
    );
  }
});

/* ================= /numbers ================= */
bot.onText(/\/numbers/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) return;

  for (const api of NUMBERS_APIS) {
    try {
      const { data } = await axios.get(api, { timeout: 15000 });
      const rows = data.aaData || [];

      if (!rows.length) {
        return bot.sendMessage(chatId, '❌ No numbers available');
      }

      // show first 10 numbers
      for (const r of rows.slice(0, 10)) {
        const number = r[0];

        await bot.sendMessage(
          chatId,
          `📞 *${number}*\n⏳ Waiting for OTP…`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔔 Get OTP', callback_data: `otp_${number}` }]
              ]
            }
          }
        );
      }
      break;
    } catch (e) {
      console.log('Numbers API error:', e.message);
    }
  }
});

/* ================= USER CLICKED OTP ================= */
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('otp_')) return;

  const number = q.data.replace('otp_', '');
  waitingUsers.set(q.from.id, number);

  bot.answerCallbackQuery(q.id, {
    text: `⏳ Waiting OTP for ${number}`,
    show_alert: true
  });
});

/* ================= OTP FETCH LOOP ================= */
setInterval(async () => {
  for (const api of SMS_APIS) {
    try {
      const { data } = await axios.get(api, { timeout: 15000 });
      const rows = data.aaData || [];

      for (const r of rows) {
        const number = r[2];
        const message = r[4];

        // 🔔 Send OTP ONLY to user who selected this number
        for (const [uid, sel] of waitingUsers.entries()) {
          if (sel === number) {
            await bot.sendMessage(
              uid,
              `🔑 *OTP Received*\n\n📞 ${number}\n\n${message}`,
              { parse_mode: 'Markdown' }
            );
            waitingUsers.delete(uid);
          }
        }

        // 📢 OPTIONAL: send all OTPs to group
        // if (GROUP_ID) {
        //   bot.sendMessage(GROUP_ID, `📩 OTP\n${number}\n${message}`);
        // }
      }
    } catch (e) {
      console.log('SMS API error:', e.message);
    }
  }
}, 3000);
