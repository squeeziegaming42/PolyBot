const { PermissionFlagsBits } = require('discord.js');

const MOD_ROLE_NAME = 'polybot moderator'; // case-insensitive

/**
 * Returns true if the member is a server admin OR has the polybot moderator role.
 */
function isPolyMod(member) {
  if (member.permissions.has(PermissionFlagsBits.ManageGuild)) return true;
  return member.roles.cache.some(r => r.name.toLowerCase() === MOD_ROLE_NAME);
}

/**
 * Replies with an error and returns false if the member is not a mod.
 * Use like: if (!await requireMod(interaction)) return;
 */
async function requireMod(interaction) {
  if (isPolyMod(interaction.member)) return true;
  await interaction.reply({
    content: `❌ You need the **${MOD_ROLE_NAME}** role or Manage Server permission to use this command.`,
    flags: 64,
  });
  return false;
}

module.exports = { isPolyMod, requireMod };
