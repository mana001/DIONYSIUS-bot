// api/index.js
const { verifyKey } = require('discord-interactions');

// ==========================================
// 🛠️ CONFIGURATION & MEDIA (EDIT THESE!) 
// ==========================================
const DISCORD_TOKEN = process.env.DISCORD_TOKEN;
const PUBLIC_KEY = process.env.DISCORD_PUBLIC_KEY;

// 🖼️ IMAGES AND GIFS
const HALLWAY_IMAGE_URL = 'https://i.imgur.com/your-dark-hallway-image.jpg'; // The grand hallway
const TRICK_GIF_URL = 'https://media.giphy.com/media/your-mocking-gif.gif'; // The laughing GIF

// 🎭 THE GAMES (6 provided, bot picks 5 randomly per session)
const ALL_GAMES = [
  "Emojis Story", 
  "How Well Do You Know Your Clique?", 
  "Fact or Fiction?", 
  "Hot Seat?", 
  "Who Said It", 
  "Would You Rather?"
];

// 🤡 SILLY NICKNAMES FOR TRICK DOORS
const SILLY_NAMES = ["Mr. POOTY", "Goblet Goblin", "Village Idiot", "Dionysius' Fool"];

// ==========================================
// 🧠 MAIN SERVERLESS FUNCTION
// ==========================================
export default async function handler(req, res) {
  // 1. Verify the request comes from Discord (REQUIRED for serverless)
  const signature = req.headers['x-signature-ed25519'];
  const timestamp = req.headers['x-signature-timestamp'];
  const isValidRequest = verifyKey(JSON.stringify(req.body), signature, timestamp, PUBLIC_KEY);
  
  if (!isValidRequest) {
    return res.status(401).send('Bad request signature');
  }

  const { type, data, member, guild_id, token, application_id, message } = req.body;

  // 2. Handle Discord Ping (Type 1)
  if (type === 1) {
    return res.send({ type: 1 });
  }

  // 3. Handle Slash Command: /domain (Type 2)
  if (type === 2 && data.name === 'domain') {
    // Pick 5 random games from the list of 6
    const selectedGames = ALL_GAMES.sort(() => 0.5 - Math.random()).slice(0, 5);
    
    // Create an array of 10 items: 5 games, 5 tricks, then shuffle them
    const doorContents = [
      ...selectedGames.map(game => `game_${game}`),
      ..."trick_trick_trick_trick_trick".split('_')
    ].sort(() => 0.5 - Math.random());

    // Generate Discord Action Rows (Buttons). Max 5 buttons per row.
    const components = [];
    for (let i = 0; i < 2; i++) {
      const row = { type: 1, components: [] };
      for (let j = 0; j < 5; j++) {
        const doorNumber = (i * 5) + j + 1;
        const content = doorContents[(i * 5) + j];
        row.components.push({
          type: 2,
          style: 2, // Secondary (Gray) button
          label: `Door ${doorNumber}`,
          emoji: { name: '🚪' },
          // We hide the game/trick data right inside the button's custom_id!
          custom_id: `door_${doorNumber}_${content}` 
        });
      }
      components.push(row);
    }

    // Send the Hallway Embed
    return res.send({
      type: 4, // Respond with a message
      data: {
        embeds: [{
          title: "🎭 The Domain of Dionysius",
          description: "Welcome to the Domain of Dionysius. Before you lie several doors. Some lead to grand festivities... others lead to madness. Choose wisely, mortals.",
          color: 0x2b2d31, // Dark gray/black
          image: { url: HALLWAY_IMAGE_URL }
        }],
        components: components
      }
    });
  }

  // 4. Handle Button Clicks (Type 3)
  if (type === 3 && data.custom_id.startsWith('door_')) {
    const clickedId = data.custom_id; // e.g., "door_3_game_Hot Seat?" or "door_5_trick"
    const userId = member.user.id;
    
    // Parse the current buttons and REMOVE the one that was just clicked
    const updatedComponents = message.components.map(row => {
      return {
        type: 1,
        components: row.components.filter(btn => btn.custom_id !== clickedId)
      };
    }).filter(row => row.components.length > 0); // Keep rows that still have buttons

    // Check what was behind the door
    const isTrick = clickedId.includes('_trick');
    const gameName = !isTrick ? clickedId.split('_game_')[1] : null;

    // --- BACKGROUND TASKS ---
    // In serverless, we return the message update immediately, 
    // but fire off fetch requests to send the result and change nicknames.

    // Task A: Send the Result Message (Game or Trick)
    const resultEmbed = isTrick 
      ? {
          title: "🩸 YOU'VE BEEN TRICKED! HAHA!",
          description: `<@${userId}> stumbled into madness!`,
          color: 0xff0000, // Red
          image: { url: TRICK_GIF_URL }
        }
      : {
          title: "🍷 A Feast of Fun!",
          description: `The door creaks open... <@${userId}> has selected: **${gameName}**!`,
          color: 0xffd700, // Gold
        };

    fetch(`https://discord.com/api/v10/webhooks/${application_id}/${token}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ embeds: [resultEmbed] })
    });

    // Task B: Change Nickname if Tricked
    if (isTrick) {
      const randomName = SILLY_NAMES[Math.floor(Math.random() * SILLY_NAMES.length)];
      fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${DISCORD_TOKEN}`,
        },
        body: JSON.stringify({ nick: randomName })
      }).catch(err => console.error("Could not change nickname (check permissions)"));
    }

    // Task C: Move to VC (Optional feature for Game wins)
    // Uncomment and add your Voice Channel ID if you want to force-move them.
    // Note: The user MUST already be in a voice channel for this to work.
    /*
    if (!isTrick) {
      const VOICE_CHANNEL_ID = '123456789012345678';
      fetch(`https://discord.com/api/v10/guilds/${guild_id}/members/${userId}`, {
        method: 'PATCH',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bot ${DISCORD_TOKEN}`,
        },
        body: JSON.stringify({ channel_id: VOICE_CHANNEL_ID })
      });
    }
    */

    // Finally, respond to the button click by updating the original message (removing the door)
    return res.send({
      type: 7, // UPDATE_MESSAGE
      data: {
        components: updatedComponents // The new buttons without the clicked door
      }
    });
  }

  // Fallback
  return res.status(400).send('Unknown interaction');
}
