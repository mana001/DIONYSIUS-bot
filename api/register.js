// api/register.js
export default async function handler(req, res) {
  const TOKEN = process.env.DISCORD_TOKEN;
  const APP_ID = process.env.DISCORD_APP_ID;

  const command = {
    name: 'domain',
    description: 'Summon the hallway of Dionysius.',
    type: 1, 
  };

  const response = await fetch(
    `https://discord.com/api/v10/applications/${APP_ID}/commands`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bot ${TOKEN}`,
      },
      body: JSON.stringify(command),
    }
  );

  if (response.ok) {
    res.status(200).send('Command /domain registered successfully! You can close this page.');
  } else {
    const error = await response.text();
    res.status(500).send(`Failed to register: ${error}`);
  }
}
