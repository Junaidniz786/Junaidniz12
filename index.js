const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// ================= CONFIG =================

const BOT_TOKEN = "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

const REQUIRED_CHANNELS = [
  "@Jndtech1",
  "@Jndtech1"
];

const NUMBERS_API = "https://www.junaidniz.pw/api/tempotps?type=numbers";
const SMS_API = "https://www.junaidniz.pw/api/tempotps?type=sms";

// OPTIONAL OTP GROUP
// const OTP_GROUP_ID = -1003361941052;

// =========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });

const userState = new Map(); 
// userId => { country, number, messageId }

// ================= CHANNEL CHECK =================
async function isJoined(userId) {
  try {
    for (const ch of REQUIRED_CHANNELS) {
      const m = await bot.getChatMember(ch, userId);
      if (!["member", "administrator", "creator"].includes(m.status)) {
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
    return bot.sendMessage(chatId, "❌ Join required channels first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel 1", url: "https://t.me/jndtech1" }],
          [{ text: "Join Channel 2", url: "https://t.me/+c4VCxBCT3-QzZGFk" }],
          [{ text: "✅ Verify", callback_data: "verify_join" }]
        ]
      }
    });
  }

  showCountries(chatId);
});

// ================= VERIFY =================
bot.on("callback_query", async (q) => {
  if (q.data === "verify_join") {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, {
        text: "❌ Join channels first",
        show_alert: true
      });
    }
    showCountries(q.message.chat.id);
  }
});

// ================= SHOW COUNTRIES =================
async function showCountries(chatId) {
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const map = {};
  rows.forEach(r => {
    const code = r[1];      // country code like 584
    const name = r[2];      // country name
    if (!map[code]) map[code] = name;
  });

  const keyboard = Object.keys(map).map(code => ([
    {
      text: `🌍 ${map[code]}`,
      callback_data: `country_${code}`
    }
  ]));

  bot.sendMessage(chatId, "🌍 Select Country:", {
    reply_markup: { inline_keyboard: keyboard }
  });
}

// ================= SELECT COUNTRY =================
bot.on("callback_query", async (q) => {
  if (!q.data.startsWith("country_")) return;

  const countryCode = q.data.replace("country_", "");
  sendNumber(q.from.id, q.message.chat.id, countryCode, null);
});

// ================= SEND NUMBER =================
async function sendNumber(userId, chatId, countryCode, editMessageId) {
  const { data } = await axios.get(NUMBERS_API);
  const rows = data.aaData || [];

  const filtered = rows.filter(r => r[1] == countryCode);
  if (!filtered.length) return;

  const pick = filtered[Math.floor(Math.random() * filtered.length)];
  const fullNumber = `+${pick[1]}${pick[0]}`;
  const countryName = pick[2];

  const text =
`📱 *Your Number (${countryName})*
📞 \`${fullNumber}\`

⏳ Waiting for OTP...
🔔 You’ll get notified instantly!`;

  const keyboard = {
    inline_keyboard: [
      [{ text: "🔄 Change Number", callback_data: "change_number" }],
      [{ text: "🌍 Change Country", callback_data: "change_country" }],
      [{ text: "📢 OTP Group", url: "https://t.me/+Aqq6X6oRWCdhM2Q0" }]
    ]
  };

  if (editMessageId) {
    const m = await bot.editMessageText(text, {
      chat_id: chatId,
      message_id: editMessageId,
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    userState.set(userId, { countryCode, number: fullNumber, messageId: editMessageId });
  } else {
    const m = await bot.sendMessage(chatId, text, {
      parse_mode: "Markdown",
      reply_markup: keyboard
    });
    userState.set(userId, { countryCode, number: fullNumber, messageId: m.message_id });
  }
}

// ================= BUTTON ACTIONS =================
bot.on("callback_query", async (q) => {
  const state = userState.get(q.from.id);
  if (!state) return;

  if (q.data === "change_number") {
    sendNumber(q.from.id, q.message.chat.id, state.countryCode, state.messageId);
  }

  if (q.data === "change_country") {
    showCountries(q.message.chat.id);
  }
});

// ================= OTP LOOP =================
setInterval(async () => {
  const { data } = await axios.get(SMS_API);
  const rows = data.aaData || [];

  rows.forEach(r => {
    const number = `+${r[2]}`;
    const message = r[4];

    for (const [uid, st] of userState.entries()) {
      if (st.number === number) {
        bot.sendMessage(uid, `🔑 *OTP Received*\n\n${message}`, {
          parse_mode: "Markdown"
        });
        userState.delete(uid);
      }
    }

    // OPTIONAL GROUP OTP
    /*
    bot.sendMessage(OTP_GROUP_ID,
      `📢 New OTP\n📞 ${number}\n${message}`
    );
    */
  });
}, 3000);

console.log("✅ Bot Running");
