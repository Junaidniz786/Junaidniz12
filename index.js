const TelegramBot = require('node-telegram-bot-api');
const axios = require('axios');

// ================= CONFIG =================

// ✅ BOT TOKEN (direct – Railway / Termux dono me chalega)
const BOT_TOKEN = '7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58';

// Channels user must join
const REQUIRED_CHANNELS = [
  '@Jndtech1',
  '@Jndtech1'
];

// APIs
const NUMBERS_API = 'https://www.junaidniz.pw/api/tempotps?type=numbers';
const SMS_API = 'https://www.junaidniz.pw/api/tempotps?type=sms';

// OPTIONAL OTP GROUP
// const OTP_GROUP_ID = -100xxxxxxxxxx;

// =========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log('✅ Bot Started');

const userState = new Map(); 
// userId => { country, number, msgId }

// ================= FLAGS =================
const FLAGS = {
  Nigeria: '🇳🇬',
  Burundi: '🇧🇮',
  Belarus: '🇧🇾',
  Venezuela: '🇻🇪'
};

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

// ================= START =================
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, '❌ Join required channels first:', {
      reply_markup: {
        inline_keyboard: [
          [{ text: 'Join Junaid Niz', url: 'https://t.me/jndtech1' }],
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
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === 'verify') {
    if (!(await isJoined(userId))) {
      return bot.answerCallbackQuery(q.id, {
        text: 'Join channels first',
        show_alert: true
      });
    }
    sendCountryList(chatId);
  }
});

// ================= COUNTRY LIST =================
async function sendCountryList(chatId) {
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const countries = {};
  rows.forEach(r => {
    const country = r[1];
    if (!countries[country]) countries[country] = 0;
    countries[country]++;
  });

  const keyboard = Object.keys(countries).map(c => ([
    {
      text: `${FLAGS[c] || '🌍'} ${c} (${countries[c]})`,
      callback_data: `country_${c}`
    }
  ]));

  bot.sendMessage(chatId,
    `🌍 *Select Country*\n⚡ Fast delivery\n🔐 Secure numbers`,
    {
      parse_mode: 'Markdown',
      reply_markup: { inline_keyboard: keyboard }
    }
  );
}

// ================= COUNTRY SELECT =================
bot.on('callback_query', async (q) => {
  if (!q.data.startsWith('country_')) return;

  const chatId = q.message.chat.id;
  const country = q.data.replace('country_', '');

  await sendNumber(chatId, country, true);
});

// ================= SEND NUMBER =================
async function sendNumber(chatId, country, newMessage) {
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData.filter(r => r[1] === country);

  if (!rows.length) return;

  const pick = rows[Math.floor(Math.random() * rows.length)];
  const number = `+${pick[2]}`;

  const text =
`📱 *Your Number (${country})*
${FLAGS[country] || '🌍'} ${number}

⏳ Waiting for OTP…
🔔 You’ll get notified instantly!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '🔄 Change Number', callback_data: 'change_number' }],
      [{ text: '🌍 Change Country', callback_data: 'change_country' }],
      [{ text: '📣 OTP Group', url: 'https://t.me/+Aqq6X6oRWCdhM2Q0' }]
    ]
  };

  if (newMessage) {
    const m = await bot.sendMessage(chatId, text, {
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    userState.set(chatId, { country, number, msgId: m.message_id });
  } else {
    const st = userState.get(chatId);
    await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: st.msgId,
      parse_mode: 'Markdown',
      reply_markup: keyboard
    });
    st.number = number;
  }
}

// ================= BUTTONS =================
bot.on('callback_query', async (q) => {
  const chatId = q.message.chat.id;
  const st = userState.get(chatId);
  if (!st) return;

  if (q.data === 'change_number') {
    await sendNumber(chatId, st.country, false);
  }

  if (q.data === 'change_country') {
    sendCountryList(chatId);
  }
});

// ================= OTP LOOP =================
setInterval(async () => {
  const { data } = await axios.get(SMS_API);
  const rows = data.aaData || [];

  for (const r of rows) {
    const number = `+${r[2]}`;
    const message = r[4];
    const service = r[3];
    const country = r[1];

    for (const [uid, st] of userState.entries()) {
      if (st.number === number) {

        await bot.sendMessage(uid,
`🔐 *New ${service} OTP*
🌍 ${country}
📞 ${number}

🔑 *OTP:* ${message.match(/\d{4,6}/)?.[0] || '----'}

📩 ${message}`,
          { parse_mode: 'Markdown' }
        );

        // OPTIONAL GROUP FORMAT
        /*
        bot.sendMessage(OTP_GROUP_ID,
`🇳🇬 New ${service} OTP
📞 ${number.replace(/.(?=.{4})/g,'*')}
🔑 ${message}`);
        */

        userState.delete(uid);
      }
    }
  }
}, 3000);
