const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

// ================= CONFIG =================
const BOT_TOKEN = process.env.BOT_TOKEN || "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

const REQUIRED_CHANNELS = [
  "@jndtech1",
  "@jndtech1"
];

const NUMBERS_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=numbers",
  "https://www.junaidniz.pw/api/tempotp?type=numbers"
];

const SMS_APIS = [
  "https://www.junaidniz.pw/api/tempotps?type=sms",
  "https://www.junaidniz.pw/api/tempotp?type=sms"
];

// ===== COUNTRY MAP =====
const COUNTRY_MAP = {
  "234": { name: "Nigeria", flag: "🇳🇬" },
  "257": { name: "Burundi", flag: "🇧🇮" },
  "584": { name: "Venezuela", flag: "🇻🇪" },
  "375": { name: "Belarus", flag: "🇧🇾" }
};
// ========================================

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ Bot Started");

const userSelected = new Map();

// ========= CHANNEL CHECK =========
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

// ========= START =========
bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;

  if (!(await isJoined(msg.from.id))) {
    return bot.sendMessage(chatId, "❌ Join required channels first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel", url: "https://t.me/mrchd112" }],
          [{ text: "Join Group", url: "https://t.me/mrchandiootpgroup" }],
          [{ text: "✅ Verify", callback_data: "verify" }]
        ]
      }
    });
  }

  showCountries(chatId);
});

// ========= VERIFY =========
bot.on("callback_query", async (q) => {
  if (q.data === "verify") {
    if (!(await isJoined(q.from.id))) {
      return bot.answerCallbackQuery(q.id, { text: "❌ Join first", show_alert: true });
    }
    showCountries(q.message.chat.id);
  }
});

// ========= SHOW COUNTRIES =========
async function showCountries(chatId) {
  const buttons = Object.entries(COUNTRY_MAP).map(([code, c]) => [
    { text: `${c.flag} ${c.name}`, callback_data: `country_${code}` }
  ]);

  bot.sendMessage(chatId, "🌍 *Select Country*", {
    parse_mode: "Markdown",
    reply_markup: { inline_keyboard: buttons }
  });
}

// ========= COUNTRY SELECT =========
bot.on("callback_query", async (q) => {
  if (!q.data.startsWith("country_")) return;

  const code = q.data.split("_")[1];
  const country = COUNTRY_MAP[code];

  for (const api of NUMBERS_APIS) {
    try {
      const { data } = await axios.get(api);
      const rows = data.aaData || [];

      const row = rows.find(r => r[1] === code);
      if (!row) continue;

      const fullNumber = row[2];
      userSelected.set(q.from.id, fullNumber);

      bot.sendMessage(q.message.chat.id,
`📱 *Your Number (${country.name})*
📞 ${country.flag} +${fullNumber}

⏳ Waiting for OTP...
🔔 You'll get notified instantly!`,
{
  parse_mode: "Markdown",
  reply_markup: {
    inline_keyboard: [
      [{ text: "🔄 Change Number", callback_data: `country_${code}` }],
      [{ text: "🌍 Change Country", callback_data: "change_country" }],
      [{ text: "📢 OTP Group", url: "https://t.me/+Aqq6X6oRWCdhM2Q0" }]
    ]
  }
});
      break;
    } catch {}
  }
});

// ========= CHANGE COUNTRY =========
bot.on("callback_query", (q) => {
  if (q.data === "change_country") {
    showCountries(q.message.chat.id);
  }
});

// ========= OTP LOOP =========
setInterval(async () => {
  for (const api of SMS_APIS) {
    try {
      const { data } = await axios.get(api);
      const rows = data.aaData || [];

      for (const r of rows) {
        const number = r[2];
        const msg = r[4];

        for (const [uid, sel] of userSelected.entries()) {
          if (sel === number) {
            bot.sendMessage(uid, `🔑 *OTP Received*\n\n${msg}`, { parse_mode: "Markdown" });
            userSelected.delete(uid);
          }
        }
      }
    } catch {}
  }
}, 3000);
