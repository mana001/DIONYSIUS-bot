const { buffer } = require('micro');
const { verifyKey } = require('discord-interactions');

// Tell Vercel not to parse the body so Discord signature check works
module.exports.config = {
  api: {
    bodyParser: false,
  },
};

const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

const HALLWAY_IMAGE_URL = 'https://i.imgur.com/your-dark-hallway-image.jpg'; 
const TRICK_GIF_URL = 'https://media.giphy.com/media/your-mocking-gif.gif'; 

const ALL_GAMES = [
  "Emojis Story", 
  "How Well Do You Know Your Clique?", 
  "Fact or Fiction?", 
  "Hot Seat?", 
  "Who Said It", 
  "Would You Rather?"
];

const SILLY_NAMES = ["Mr. POOTY", "Goblet Goblin", "Village Idiot", "Dionysius' Fool"];

module.exports = async function handler(req, res) {
  // 1. Get the exact raw body using Vercel's built-in buffer helper
  let rawBody;
  try {
    rawBody = await buffer(req);
  } catch (err) {
    return res.status(400).send('Invalid request body');
  }

  // 2. Verify the request comes from Discord
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  
  const isValidRequest = await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY);
  
  if (!isValidRequest) {
    return res.status(401).send('Bad request signature');
  }

  const body = JSON.parse(rawBody.toString('utf-8'));
  const { type, data, member, guild_id, token, application_id, message } = body;

  // 3. Handle Discord Ping (Type 1) - MUST return type 1 immediately
  if (type === 1) {
    return res.status(200).json({ type: 1 });
  }

  // 4. Handle Slash Command: /domain (Type 2)
  if (type === 2 && data.name === 'domain') {
    const selectedGames = ALL_GAMES.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    const doorContents = [
      ...selectedGames.map(game => `game_${game}`),
      ..."trick_trick_trick_trick_trick".split('_')
    ].sort(() => 0.5 - Math.random());

    const components = [];
    for (let i = 0; i < 2; i++) {
      const row = { type: 1, components: [] };
      for (let j = 0; j < 5; j++) {
        const doorNumber = (i * 5) + j + 1;
        const content = doorContents[(i * 5) + j];
        row.components.push({
          type: 2,
          style: 2, 
          label: `Door ${doorNumber}`,
          emoji: { name: '🚪' },
          custom_id: `door_${doorNumber}_${content}` 
        });
      }
      components.push(row);
    }

    return res.status(200).json({
      type: 4, 
      data: {
        embeds: [{
          title: "🎭 The Domain of Dionysius",
          description: "Welcome to the Domain of Dionysius. Before you lie several doors. Some lead to grand festivities... others lead to madness. Choose wisely, mortals.",
          color: 0x2b2d31, 
          image: { url: HALLWAY_IMAGE_URL }
        }],
        components: components
      }
    });
  }

  // 5. Handle Button Clicks (Type 3)
  if (type === 3 && data.custom_id.startsWith('door_')) {
    const clickedId = data.custom_id; 
    const userId = member.user.id;
    
    const updatedComponents = message.components.map(row => {
      return {
        type: 1,
        components: row.components.filter(btn => btn.custom_id !== clickedId)
      };
    }).filter(row => row.components.length > 0); 

    const isTrick = clickedId.includes('_trick');
    const gameName = !isTrick ? clickedId.split('_game_')[1] : null;

    const resultEmbed = isTrick 
      ? {
          title: "🩸 YOU'VE BEEN TRICKED! HAHA!",
          description: `<@${userId}> stumbled into madness!`,
          color: 0xff0000, 
          image: { url: TRICK_GIF_URL }
        }
      : {
          title: "🍷 A Feast of Fun!",
          description: `The door creaks open... <@${userId}> has selected: **${gameName}**!`,
          color: 0xffd700, 
        };

    fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [resultEmbed] })
    });

    if (isTrick) {
      const randomName = SILLY_NAMES[Math.floor(Math.random() * SILLY_NAMES.length)];
      fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${DISCORD_TOKEN}`,
        },
        body: JSON.stringify({ nick: randomName })
      }).catch(err => console.error("Could not change nickname"));
    }

    return res.status(200).json({
      type: 7, 
      data: {
        components: updatedComponents 
      }
    });
  }

  return res.status(400).send('Unknown interaction');
};
