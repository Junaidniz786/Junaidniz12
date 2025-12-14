const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= CONFIG =================

// ✅ BOT TOKEN (DIRECT STRING – WORKING)
const BOT_TOKEN = "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

// Channels user must join
const REQUIRED_CHANNELS = [
  '@jndtech1',
  '@Junaidniz'
];

// Numbers APIs
const NUMBERS_APIS = [
  'https://www.junaidniz.pw/api/tempotps?type=numbers',
  'https://www.junaidniz.pw/api/tempotp?type=numbers'
];

// SMS APIs
const SMS_APIS = [
  'https://www.junaidniz.pw/api/tempotps?type=sms',
  'https://www.junaidniz.pw/api/tempotp?type=sms'
];

// ==========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot Started');

// userId => selected number
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
  } catch (e) {
    return false;
  }
}

// ================= /start =================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  const joined = await isJoined(userId);
  if (!joined) {
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

  bot.sendMessage(chatId, '✅ Welcome!\n\nUse /numbers to get numbers');
});

// ================= RECHECK =================
bot.on('callback_query', async (q) => {
  if (q.data === 'recheck') {
    const ok = await isJoined(q.from.id);
    if (!ok) {
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

// ================= /numbers =================
bot.onText(/\/numbers/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) return;

  for (const api of NUMBERS_APIS) {
    try {
      const { data } = await axios.get(api, { timeout: 10000 });
      const rows = data.aaData || [];

      for (const r of rows.slice(0, 5)) {
        const number = r[0];

        await bot.sendMessage(
          chatId,
          `📞 *${number}*`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔑 Get OTP', callback_data: `otp_${number}` }]
              ]
            }
          }
        );
      }
      break;
    } catch (e) {}
  }
});

// ================= GET OTP =================
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('otp_')) return;

  const number = q.data.replace('otp_', '');
  userSelectedNumber.set(q.from.id, number);

  bot.answerCallbackQuery(q.id, {
    text: `Waiting OTP for ${number}`,
    show_alert: true
  });
});

// ================= OTP LOOP =================
setInterval(async () => {
  for (const api of SMS_APIS) {
    try {
      const { data } = await axios.get(api, { timeout: 10000 });
      const rows = data.aaData || [];

      for (const r of rows) {
        const number = r[2];
        const message = r[4];

        // ===== USER OTP (only selected number) =====
        for (const [uid, sel] of userSelectedNumber.entries()) {
          if (sel === number) {
            await bot.sendMessage(
              uid,
              `🔑 *OTP Received*\n\n📞 ${number}\n\n${message}`,
              { parse_mode: 'Markdown' }
            );
            userSelectedNumber.delete(uid);
          }
        }
      }
    } catch (e) {}
  }
}, 3000);
