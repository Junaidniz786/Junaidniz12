const TelegramBot = require("node-telegram-bot-api");
const axios = require("axios");

/* ================= CONFIG ================= */

const BOT_TOKEN = "7815634776:AAHE9U0wlYB3m0bemuqgPx2Y9W7_gdWGE58";

const REQUIRED_CHANNELS = [
  "@Jndtech1",
  "@JndTech1"
];

// OTP GROUP
const OTP_GROUP_ID = -100XXXXXXXXXX; // ← apna group id

// APIs
const NUMBERS_API = "https://www.junaidniz.pw/api/tempotp?type=numbers";
const SMS_API     = "https://www.junaidniz.pw/api/tempotp?type=sms";

/* ============ FIXED COUNTRIES (20) ============ */

const COUNTRIES = [
  { code: "NG", name: "Nigeria", flag: "🇳🇬", dial: "+234" },
  { code: "VE", name: "Venezuela", flag: "🇻🇪", dial: "+58" },
  { code: "BY", name: "Belarus", flag: "🇧🇾", dial: "+375" },
  { code: "BI", name: "Burundi", flag: "🇧🇮", dial: "+257" },
  { code: "PK", name: "Pakistan", flag: "🇵🇰", dial: "+92" },
  { code: "IN", name: "India", flag: "🇮🇳", dial: "+91" },
  { code: "BD", name: "Bangladesh", flag: "🇧🇩", dial: "+880" },
  { code: "UA", name: "Ukraine", flag: "🇺🇦", dial: "+380" },
  { code: "MA", name: "Morocco", flag: "🇲🇦", dial: "+212" },
  { code: "ET", name: "Ethiopia", flag: "🇪🇹", dial: "+251" },
  { code: "AF", name: "Afghanistan", flag: "🇦🇫", dial: "+93" },
  { code: "NP", name: "Nepal", flag: "🇳🇵", dial: "+977" },
  { code: "TJ", name: "Tajikistan", flag: "🇹🇯", dial: "+992" },
  { code: "KG", name: "Kyrgyzstan", flag: "🇰🇬", dial: "+996" },
  { code: "CM", name: "Comoros", flag: "🇰🇲", dial: "+269" },
  { code: "BF", name: "Burkina Faso", flag: "🇧🇫", dial: "+226" },
  { code: "GH", name: "Ghana", flag: "🇬🇭", dial: "+233" },
  { code: "KE", name: "Kenya", flag: "🇰🇪", dial: "+254" },
  { code: "SN", name: "Senegal", flag: "🇸🇳", dial: "+221" },
  { code: "TZ", name: "Tanzania", flag: "🇹🇿", dial: "+255" },
];

/* ============================================ */

const bot = new TelegramBot(BOT_TOKEN, { polling: true });
console.log("✅ BOT STARTED");

/* USER STATE */
const userState = new Map();

/* ================= JOIN CHECK ================= */

async function isJoined(userId) {
  try {
    for (const ch of REQUIRED_CHANNELS) {
      const m = await bot.getChatMember(ch, userId);
      if (!["member", "administrator", "creator"].includes(m.status)) return false;
    }
    return true;
  } catch {
    return false;
  }
}

/* ================= START ================= */

bot.onText(/\/start/, async (msg) => {
  const chatId = msg.chat.id;
  const userId = msg.from.id;

  if (!(await isJoined(userId))) {
    return bot.sendMessage(chatId, "❌ Join channels first", {
      reply_markup: {
        inline_keyboard: [
          [{ text: "Join Channel", url: "https://t.me/mrchd112" }],
          [{ text: "Join Group", url: "https://t.me/mrchandiootpgroup" }],
          [{ text: "✅ Verify", callback_data: "verify_join" }]
        ]
      }
    });
  }

  showCountryMenu(chatId);
});

/* ================= VERIFY ================= */

bot.on("callback_query", async (q) => {
  const chatId = q.message.chat.id;
  const userId = q.from.id;

  if (q.data === "verify_join") {
    if (!(await isJoined(userId))) {
      return bot.answerCallbackQuery(q.id, { text: "Join first ❌", show_alert: true });
    }
    return showCountryMenu(chatId);
  }

  if (q.data.startsWith("country_")) {
    const code = q.data.replace("country_", "");
    userState.set(userId, { country: code });
    return assignNumber(chatId, userId);
  }

  if (q.data === "change_number") {
    return assignNumber(chatId, userId, true);
  }

  if (q.data === "change_country") {
    return showCountryMenu(chatId, true);
  }
});

/* ================= COUNTRY MENU ================= */

function showCountryMenu(chatId, edit = false) {
  const keyboard = [];

  COUNTRIES.forEach(c => {
    keyboard.push([{ text: `${c.flag} ${c.name}`, callback_data: `country_${c.code}` }]);
  });

  const opts = {
    reply_markup: { inline_keyboard: keyboard }
  };

  if (edit) {
    bot.editMessageText("🌍 Select Country:", {
      chat_id: chatId,
      message_id: chatId,
      ...opts
    });
  } else {
    bot.sendMessage(chatId, "🌍 Select Country:", opts);
  }
}

/* ================= ASSIGN NUMBER ================= */

async function assignNumber(chatId, userId) {
  try {
    const state = userState.get(userId);
    if (!state) return;

    const country = COUNTRIES.find(c => c.code === state.country);

    const { data } = await axios.get(NUMBERS_API);
    const rows = data.aaData || [];

    const filtered = rows.filter(r =>
      String(r[2]).startsWith(country.dial.replace("+", ""))
    );

    if (!filtered.length) {
      return bot.sendMessage(chatId, "❌ No number available");
    }

    const pick = filtered[Math.floor(Math.random() * filtered.length)];
    const fullNumber = "+" + String(pick[2]); // 🔥 FIXED HERE

    userState.set(userId, {
      ...state,
      number: fullNumber
    });

    bot.sendMessage(chatId,
`📱 *Your Number (${country.name})*
${country.flag} ${fullNumber}

⏳ Waiting for OTP…`,
      {
        parse_mode: "Markdown",
        reply_markup: {
          inline_keyboard: [
            [{ text: "🔁 Change Number", callback_data: "change_number" }],
            [{ text: "🌍 Change Country", callback_data: "change_country" }],
            [{ text: "📢 OTP Group", url: "https://t.me/mrchandiootpgroup" }]
          ]
        }
      });

  } catch (e) {
    console.log(e);
  }
}

/* ================= OTP LOOP ================= */

setInterval(async () => {
  try {
    const { data } = await axios.get(SMS_API);
    const rows = data.aaData || [];

    for (const r of rows) {
      const number = "+" + String(r[2]);
      const msg = r[4];

      for (const [uid, st] of userState.entries()) {
        if (st.number === number) {
          bot.sendMessage(uid, `🔑 OTP RECEIVED\n\n${msg}`);
        }
      }

      // GROUP FORMAT
      bot.sendMessage(OTP_GROUP_ID,
`📩 *New OTP*
📞 ${number}
🔑 ${msg}`,
        { parse_mode: "Markdown" }
      );
    }
  } catch {}
}, 3000);
